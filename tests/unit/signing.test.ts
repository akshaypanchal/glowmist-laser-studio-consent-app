// Tests the full server-side signing flow, including every rejection the spec asks for.

import { eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/crypto";
import { listDocumentEvents, verifyDocumentChain } from "@/server/audit/service";
import { db } from "@/server/db";
import { consentDocuments, consentTemplateVersions, signatures, signingSessions } from "@/server/db/schema";
import { createConsentDocument, reissueSigningLink } from "@/server/documents/service";
import { completeSigning, loadSigningPage, recordConsentChecked, SigningError } from "@/server/signing/complete";
import { storage } from "@/server/storage";
import { createStudio, testContext, tokenFromUrl } from "./helpers/fixtures";
import { useFreshDatabase } from "./helpers/db";
import { validSubmission } from "./helpers/png";

beforeAll(useFreshDatabase);

async function newDocument() {
  const studio = await createStudio();
  const created = await createConsentDocument(studio.actor, { clientId: studio.client.id, templateId: studio.template.id });
  return { studio, document: created.document, token: tokenFromUrl(created.signingUrl) };
}

async function expectCode(promise: Promise<unknown>, code: SigningError["code"]) {
  await expect(promise).rejects.toMatchObject({ name: "SigningError", code });
}

describe("happy path", () => {
  it("views, consents, signs, stores a hashed PDF and a verifiable audit trail", async () => {
    const { studio, document, token } = await newDocument();

    const page = await loadSigningPage(token, testContext);
    expect(page.reference).toBe(document.reference);
    expect(page.content.treatments.length).toBeGreaterThan(0);

    await recordConsentChecked(token, testContext);
    const result = await completeSigning(token, validSubmission(), testContext);

    const [stored] = await db().select().from(consentDocuments).where(eq(consentDocuments.id, document.id));
    expect(stored.status).toBe("SIGNED");
    expect(stored.completedAt).toBeInstanceOf(Date);
    expect(JSON.parse(stored.formData!).allergies).toBe("Latex");

    const pdf = await storage().download(stored.signedFileKey!);
    expect(sha256Hex(pdf)).toBe(stored.signedDocumentHash);
    expect(result.signedDocumentHash).toBe(stored.signedDocumentHash);
    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(parsed.getTitle()).toContain(document.reference);

    const [signature] = await db().select().from(signatures).where(eq(signatures.documentId, document.id));
    expect(sha256Hex(await storage().download(signature.storageKey))).toBe(signature.signatureHash);

    const events = (await listDocumentEvents(studio.org.id, document.id)).map((e) => e.eventType);
    expect(events).toEqual([
      "DOCUMENT_CREATED",
      "DOCUMENT_SENT",
      "DOCUMENT_VIEWED",
      "SIGNING_STARTED",
      "CONSENT_CHECKED",
      "CONSENT_CHECKED",
      "SIGNATURE_CREATED",
      "DOCUMENT_SIGNED",
      "PDF_GENERATED",
      "DOCUMENT_STORED",
    ]);
    expect(await verifyDocumentChain(studio.org.id, document.id)).toEqual({ valid: true });
    const viewed = (await listDocumentEvents(studio.org.id, document.id)).find((e) => e.eventType === "DOCUMENT_VIEWED");
    expect(viewed?.ipAddress).toBe(testContext.ipAddress);
  });
});

describe("rejections", () => {
  it("rejects an invalid token", async () => {
    await expectCode(completeSigning("x".repeat(43), validSubmission(), testContext), "INVALID");
  });

  it("rejects a used token", async () => {
    const { token } = await newDocument();
    await completeSigning(token, validSubmission(), testContext);
    await expectCode(completeSigning(token, validSubmission(), testContext), "USED");
    await expectCode(loadSigningPage(token, testContext), "USED");
  });

  it("rejects an expired token", async () => {
    const { document, token } = await newDocument();
    await db().update(signingSessions).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(signingSessions.documentId, document.id));
    await expectCode(completeSigning(token, validSubmission(), testContext), "EXPIRED");
  });

  it("rejects a replaced link", async () => {
    const { studio, document, token } = await newDocument();
    await reissueSigningLink(studio.actor, document.id);
    await expectCode(completeSigning(token, validSubmission(), testContext), "REVOKED");
  });

  it("rejects a missing consent checkbox", async () => {
    const { token } = await newDocument();
    await expectCode(completeSigning(token, { ...validSubmission(), consentAccepted: false }, testContext), "CONSENT_REQUIRED");
    const withoutConsent: Record<string, unknown> = validSubmission();
    delete withoutConsent.consentAccepted;
    await expectCode(completeSigning(token, withoutConsent, testContext), "CONSENT_REQUIRED");
  });

  it("rejects a missing or fake signature", async () => {
    const { token } = await newDocument();
    await expectCode(completeSigning(token, { ...validSubmission(), signature: "" }, testContext), "REQUEST_INVALID");
    await expectCode(
      completeSigning(token, { ...validSubmission(), signature: "data:image/png;base64,aGVsbG8=" }, testContext),
      "SIGNATURE_INVALID",
    );
  });

  it("rejects answers that don't match the template", async () => {
    const { token } = await newDocument();
    const bad = validSubmission();
    bad.answers.treatments = ["Tattoo removal"];
    await expectCode(completeSigning(token, bad, testContext), "ANSWERS_INVALID");
    const none = validSubmission();
    none.answers.photography = ["none", "record"];
    await expectCode(completeSigning(token, none, testContext), "ANSWERS_INVALID");
  });

  it("lets only one of two simultaneous submissions succeed", async () => {
    const { document, token } = await newDocument();
    const results = await Promise.allSettled([
      completeSigning(token, validSubmission(), testContext),
      completeSigning(token, validSubmission(), testContext),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const sigs = await db().select().from(signatures).where(eq(signatures.documentId, document.id));
    expect(sigs).toHaveLength(1);
  });

  it("refuses to sign if the template wording was changed in the database", async () => {
    const { document, token } = await newDocument();
    const [version] = await db().select().from(consentTemplateVersions).where(eq(consentTemplateVersions.id, document.templateVersionId));
    await db()
      .update(consentTemplateVersions)
      .set({ content: version.content.replace("Individual results vary", "Results are guaranteed") })
      .where(eq(consentTemplateVersions.id, version.id));
    await expect(completeSigning(token, validSubmission(), testContext)).rejects.toThrow(/no longer matches/);
    // The failed attempt released the link.
    const [session] = await db().select().from(signingSessions).where(eq(signingSessions.documentId, document.id));
    expect(session.usedAt).toBeNull();
  });
});
