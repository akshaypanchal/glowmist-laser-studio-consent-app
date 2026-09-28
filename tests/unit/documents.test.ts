// Tests creating consent forms and signing link checks, including another studio being refused.

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { listDocumentEvents, verifyDocumentChain } from "@/server/audit/service";
import { db } from "@/server/db";
import { consentDocuments, signingSessions } from "@/server/db/schema";
import { createConsentDocument, NotFoundError, reissueSigningLink } from "@/server/documents/service";
import { validateSigningSession } from "@/server/signing/sessions";
import { createStudio, tokenFromUrl } from "./helpers/fixtures";
import { useFreshDatabase } from "./helpers/db";

beforeAll(useFreshDatabase);

describe("creating a consent document", () => {
  it("pins the template version, creates a link and marks it SENT", async () => {
    const studio = await createStudio();
    const result = await createConsentDocument(studio.actor, { clientId: studio.client.id, templateId: studio.template.id });

    expect(result.document.status).toBe("SENT");
    expect(result.document.templateVersionId).toBe(studio.version.id);
    expect(result.document.documentHash).toBe(studio.version.contentHash);
    expect(result.signingUrl).toMatch(/\/sign\/[A-Za-z0-9_-]{43}$/);

    const [stored] = await db().select().from(signingSessions).where(eq(signingSessions.documentId, result.document.id));
    expect(stored.tokenHash).not.toContain(tokenFromUrl(result.signingUrl));

    const events = await listDocumentEvents(studio.org.id, result.document.id);
    expect(events.map((e) => e.eventType)).toEqual(["DOCUMENT_CREATED", "DOCUMENT_SENT"]);
    expect(await verifyDocumentChain(studio.org.id, result.document.id)).toEqual({ valid: true });

    const validation = await validateSigningSession(tokenFromUrl(result.signingUrl));
    expect(validation.ok).toBe(true);
  });

  it("refuses another organization's client or template", async () => {
    const a = await createStudio("A");
    const b = await createStudio("B");
    await expect(createConsentDocument(b.actor, { clientId: a.client.id, templateId: b.template.id })).rejects.toThrow(
      NotFoundError,
    );
    await expect(createConsentDocument(b.actor, { clientId: b.client.id, templateId: a.template.id })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("signing link validation", () => {
  it("rejects invalid, expired, revoked and non-signable links", async () => {
    const studio = await createStudio();
    expect(await validateSigningSession("nope")).toMatchObject({ ok: false, reason: "INVALID" });
    expect(await validateSigningSession("A".repeat(43))).toMatchObject({ ok: false, reason: "INVALID" });

    const first = await createConsentDocument(studio.actor, { clientId: studio.client.id, templateId: studio.template.id });
    const token = tokenFromUrl(first.signingUrl);

    const reissued = await reissueSigningLink(studio.actor, first.document.id);
    expect(await validateSigningSession(token)).toMatchObject({ ok: false, reason: "REVOKED" });
    const newToken = tokenFromUrl(reissued.signingUrl);
    expect((await validateSigningSession(newToken)).ok).toBe(true);

    await db()
      .update(signingSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(signingSessions.documentId, first.document.id));
    expect(await validateSigningSession(newToken)).toMatchObject({ ok: false, reason: "EXPIRED" });

    const second = await createConsentDocument(studio.actor, { clientId: studio.client.id, templateId: studio.template.id });
    await db().update(consentDocuments).set({ status: "VOIDED" }).where(eq(consentDocuments.id, second.document.id));
    expect(await validateSigningSession(tokenFromUrl(second.signingUrl))).toMatchObject({ ok: false, reason: "NOT_SIGNABLE" });
  });

  it("does not let another organization reissue a link", async () => {
    const a = await createStudio("A2");
    const b = await createStudio("B2");
    const doc = await createConsentDocument(a.actor, { clientId: a.client.id, templateId: a.template.id });
    await expect(reissueSigningLink(b.actor, doc.document.id)).rejects.toThrow(NotFoundError);
  });
});
