// Tests emailing: the signed copy going only to the studio, email failure not undoing a signature, and retries.

import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { listDocumentEvents, verifyDocumentChain } from "@/server/audit/service";
import { db } from "@/server/db";
import { consentDocuments, emailEvents, organizations } from "@/server/db/schema";
import { createConsentDocument } from "@/server/documents/service";
import { setEmailService, type EmailService, type OutgoingEmail } from "@/server/email";
import { MAX_EMAIL_ATTEMPTS, retryFailedEmails, sendSignedCopy, sendSigningInvitation } from "@/server/email/delivery";
import { signingInvitationEmail } from "@/server/email/templates";
import { completeSigning } from "@/server/signing/complete";
import { createStudio, testContext, tokenFromUrl } from "./helpers/fixtures";
import { useFreshDatabase } from "./helpers/db";
import { validSubmission } from "./helpers/png";

class FakeEmail implements EmailService {
  sent: OutgoingEmail[] = [];
  failing = false;
  async send(email: OutgoingEmail) {
    if (this.failing) throw new Error("Resend is down");
    this.sent.push(email);
    return { id: `msg-${this.sent.length}` };
  }
}

let fake: FakeEmail;

beforeAll(useFreshDatabase);
afterEach(() => setEmailService(undefined));

async function signedDocument() {
  fake = new FakeEmail();
  setEmailService(fake);
  const studio = await createStudio();
  const created = await createConsentDocument(studio.actor, { clientId: studio.client.id, templateId: studio.template.id });
  const signed = await completeSigning(tokenFromUrl(created.signingUrl), validSubmission(), testContext);
  return { studio, created, signed };
}

describe("signed copies", () => {
  it("emails the PDF only to the studio, with client name and document ID in the subject", async () => {
    const { studio, signed } = await signedDocument();
    expect(await sendSignedCopy(signed.documentId)).toBe(true);

    expect(fake.sent.map((e) => e.to)).toEqual(["records@example.com"]);
    expect(fake.sent[0].subject).toBe(`Signed Consent: Jane Doe, Document ${signed.reference}`);
    expect(fake.sent[0].text).toContain(signed.signedDocumentHash);
    expect(fake.sent[0].attachments?.[0].filename).toBe(`signed-consent-${signed.reference}.pdf`);
    expect(fake.sent[0].attachments?.[0].content.length).toBeGreaterThan(1000);

    const events = await db().select().from(emailEvents).where(eq(emailEvents.documentId, signed.documentId));
    expect(events.map((e) => [e.type, e.status])).toEqual([["SIGNED_COPY_ORGANIZATION", "SENT"]]);
    const audit = (await listDocumentEvents(studio.org.id, signed.documentId)).map((e) => e.eventType);
    expect(audit.filter((t) => t === "EMAIL_SENT")).toHaveLength(1);
    expect(await verifyDocumentChain(studio.org.id, signed.documentId)).toEqual({ valid: true });
  });

  it("keeps the document SIGNED when email fails, then retries", async () => {
    const { studio, signed } = await signedDocument();
    fake.failing = true;
    expect(await sendSignedCopy(signed.documentId)).toBe(false);

    const [doc] = await db().select().from(consentDocuments).where(eq(consentDocuments.id, signed.documentId));
    expect(doc.status).toBe("SIGNED");
    let events = await db().select().from(emailEvents).where(eq(emailEvents.documentId, signed.documentId));
    expect(events.every((e) => e.status === "FAILED" && e.error?.includes("Resend is down"))).toBe(true);

    fake.failing = false;
    expect(await retryFailedEmails({ documentId: signed.documentId })).toEqual({ attempted: 1, sent: 1 });
    events = await db().select().from(emailEvents).where(eq(emailEvents.documentId, signed.documentId));
    expect(events).toHaveLength(1);
    expect(events.every((e) => e.status === "SENT" && e.attempts === 2)).toBe(true);
    expect(await retryFailedEmails({ documentId: signed.documentId })).toEqual({ attempted: 0, sent: 0 });
    expect(await verifyDocumentChain(studio.org.id, signed.documentId)).toEqual({ valid: true });
  });

  it("never retries an old failed client copy", async () => {
    const { signed } = await signedDocument();
    await db().insert(emailEvents).values({
      documentId: signed.documentId,
      recipient: "jane@example.com",
      type: "SIGNED_COPY_CLIENT",
      status: "FAILED",
      error: "old failure",
    });
    expect(await retryFailedEmails({ documentId: signed.documentId })).toEqual({ attempted: 0, sent: 0 });
    expect(fake.sent).toHaveLength(0);
  });

  it("stops retrying after the attempt limit", async () => {
    const { signed } = await signedDocument();
    fake.failing = true;
    await sendSignedCopy(signed.documentId);
    for (let i = 1; i < MAX_EMAIL_ATTEMPTS + 2; i++) await retryFailedEmails({ documentId: signed.documentId });
    const events = await db().select().from(emailEvents).where(eq(emailEvents.documentId, signed.documentId));
    expect(events.every((e) => e.attempts === MAX_EMAIL_ATTEMPTS)).toBe(true);
  });

  it("sends nothing when no records email is configured", async () => {
    const { studio, signed } = await signedDocument();
    await db().update(organizations).set({ recordsEmail: null }).where(eq(organizations.id, studio.org.id));
    expect(await sendSignedCopy(signed.documentId)).toBeNull();
    expect(fake.sent).toHaveLength(0);
  });
});

describe("signing invitation", () => {
  it("emails the link and records it", async () => {
    fake = new FakeEmail();
    setEmailService(fake);
    const studio = await createStudio();
    const created = await createConsentDocument(studio.actor, { clientId: studio.client.id, templateId: studio.template.id });
    expect(await sendSigningInvitation(created.document.id, created.signingUrl)).toBe(true);
    expect(fake.sent[0].to).toBe("jane@example.com");
    expect(fake.sent[0].text).toContain(created.signingUrl);
  });

  it("escapes client-supplied text in HTML", () => {
    const email = signingInvitationEmail({ studioName: "S", firstName: "<script>x</script>", url: "https://x/sign/a", expiresAt: "soon" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});
