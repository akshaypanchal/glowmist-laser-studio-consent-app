// Tests the dashboard's server logic: document details and counts stay within one studio, voiding, and staff account management.

import { beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "@/lib/password";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { dashboardSummary, getDocumentDetail, listDocuments, recentAuditEvents } from "@/server/documents/queries";
import { createConsentDocument, NotFoundError, voidDocument } from "@/server/documents/service";
import { completeSigning } from "@/server/signing/complete";
import { validateSigningSession } from "@/server/signing/sessions";
import { addUser, changePassword } from "@/server/users/service";
import { eq } from "drizzle-orm";
import { createStudio, testContext, tokenFromUrl } from "./helpers/fixtures";
import { useFreshDatabase } from "./helpers/db";
import { validSubmission } from "./helpers/png";

beforeAll(useFreshDatabase);

describe("document queries", () => {
  it("returns details and counts only for the user's studio", async () => {
    const a = await createStudio("A");
    const b = await createStudio("B");
    const signed = await createConsentDocument(a.actor, { clientId: a.client.id, templateId: a.template.id });
    await completeSigning(tokenFromUrl(signed.signingUrl), validSubmission(), testContext);
    await createConsentDocument(a.actor, { clientId: a.client.id, templateId: a.template.id });

    const detail = await getDocumentDetail(a.org.id, signed.document.id);
    expect(detail?.document.status).toBe("SIGNED");
    expect(detail?.chain).toEqual({ valid: true });
    expect(detail?.signature?.signerName).toBe("Jane Doe");
    expect(await getDocumentDetail(b.org.id, signed.document.id)).toBeUndefined();

    expect(await dashboardSummary(a.org.id)).toMatchObject({ signedThisMonth: 1, awaiting: 1, failedEmails: 0 });
    expect(await dashboardSummary(b.org.id)).toMatchObject({ signedThisMonth: 0, awaiting: 0 });
    expect(await listDocuments(b.org.id)).toHaveLength(0);
    expect((await listDocuments(a.org.id, { status: "SIGNED" })).map((d) => d.id)).toEqual([signed.document.id]);
    expect((await recentAuditEvents(b.org.id)).length).toBe(0);
  });
});

describe("voiding", () => {
  it("voids a signed document and records why", async () => {
    const s = await createStudio();
    const doc = await createConsentDocument(s.actor, { clientId: s.client.id, templateId: s.template.id });
    await completeSigning(tokenFromUrl(doc.signingUrl), validSubmission(), testContext);
    await voidDocument(s.actor, doc.document.id, "Signed by mistake");
    const detail = await getDocumentDetail(s.org.id, doc.document.id);
    expect(detail?.document.status).toBe("VOIDED");
    expect(detail?.events.at(-1)?.eventType).toBe("DOCUMENT_VOIDED");
    expect(detail?.chain).toEqual({ valid: true });
    await expect(voidDocument(s.actor, doc.document.id, "again")).rejects.toThrow();
  });

  it("revokes the link of an unsigned document", async () => {
    const s = await createStudio();
    const doc = await createConsentDocument(s.actor, { clientId: s.client.id, templateId: s.template.id });
    await voidDocument(s.actor, doc.document.id, "Client cancelled");
    expect(await validateSigningSession(tokenFromUrl(doc.signingUrl))).toMatchObject({ ok: false, reason: "REVOKED" });
  });

  it("refuses another studio", async () => {
    const a = await createStudio();
    const b = await createStudio();
    const doc = await createConsentDocument(a.actor, { clientId: a.client.id, templateId: a.template.id });
    await expect(voidDocument(b.actor, doc.document.id, "nope")).rejects.toThrow(NotFoundError);
  });
});

describe("staff accounts", () => {
  it("adds users, rejects duplicates and changes passwords", async () => {
    const s = await createStudio();
    await addUser(s.org.id, { name: "Sam", email: "sam@example.com", role: "STAFF", password: "a-temporary-password" });
    await expect(
      addUser(s.org.id, { name: "Sam", email: "sam@example.com", role: "STAFF", password: "a-temporary-password" }),
    ).rejects.toThrow(/already exists/);

    const [sam] = await db().select().from(users).where(eq(users.email, "sam@example.com"));
    await expect(changePassword(sam.id, "wrong", "a-brand-new-password")).rejects.toThrow(/incorrect/);
    await changePassword(sam.id, "a-temporary-password", "a-brand-new-password");
    const [updated] = await db().select().from(users).where(eq(users.id, sam.id));
    expect(await verifyPassword("a-brand-new-password", updated.passwordHash)).toBe(true);
  });
});
