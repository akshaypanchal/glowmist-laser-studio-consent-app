// Tests deleting unsigned documents: password required, signed documents refused, link revoked, deletion audited and hidden from lists.

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { listDocumentEvents, verifyDocumentChain } from "@/server/audit/service";
import { db } from "@/server/db";
import { consentDocuments } from "@/server/db/schema";
import { listDocuments } from "@/server/documents/queries";
import {
  createConsentDocument,
  deleteUnsignedDocument,
  listClientDocuments,
  NotFoundError,
  WrongPasswordError,
} from "@/server/documents/service";
import { validateSigningSession } from "@/server/signing/sessions";
import { createStudio, tokenFromUrl } from "./helpers/fixtures";
import { useFreshDatabase } from "./helpers/db";

beforeAll(useFreshDatabase);

const PASSWORD = "password-for-tests";

describe("deleting an unsigned document", () => {
  it("needs the user's correct password", async () => {
    const studio = await createStudio();
    const { document } = await createConsentDocument(studio.actor, { clientId: studio.client.id, templateId: studio.template.id });
    await expect(deleteUnsignedDocument(studio.actor, document.id, "wrong-password")).rejects.toThrow(WrongPasswordError);
    const [stored] = await db().select().from(consentDocuments).where(eq(consentDocuments.id, document.id));
    expect(stored.status).toBe("SENT");
  });

  it("marks it DELETED, revokes the link, records it and hides it from lists", async () => {
    const studio = await createStudio();
    const created = await createConsentDocument(studio.actor, { clientId: studio.client.id, templateId: studio.template.id });
    await db().update(consentDocuments).set({ status: "VIEWED" }).where(eq(consentDocuments.id, created.document.id));

    await deleteUnsignedDocument(studio.actor, created.document.id, PASSWORD);

    const [stored] = await db().select().from(consentDocuments).where(eq(consentDocuments.id, created.document.id));
    expect(stored.status).toBe("DELETED");
    expect(await validateSigningSession(tokenFromUrl(created.signingUrl))).toMatchObject({ ok: false, reason: "NOT_SIGNABLE" });

    const events = await listDocumentEvents(studio.org.id, created.document.id);
    const deleted = events.at(-1)!;
    expect(deleted.eventType).toBe("DOCUMENT_DELETED");
    expect(deleted.actorId).toBe(studio.owner.id);
    expect(JSON.parse(deleted.metadata)).toMatchObject({ previousStatus: "VIEWED", signingLinksRevoked: 1 });
    expect(await verifyDocumentChain(studio.org.id, created.document.id)).toEqual({ valid: true });

    expect((await listDocuments(studio.org.id)).map((d) => d.id)).not.toContain(created.document.id);
    expect((await listClientDocuments(studio.org.id, studio.client.id)).map((d) => d.id)).not.toContain(created.document.id);
  });

  it("refuses signed, declined and voided documents", async () => {
    const studio = await createStudio();
    for (const status of ["SIGNED", "DECLINED", "VOIDED"] as const) {
      const { document } = await createConsentDocument(studio.actor, { clientId: studio.client.id, templateId: studio.template.id });
      await db().update(consentDocuments).set({ status }).where(eq(consentDocuments.id, document.id));
      await expect(deleteUnsignedDocument(studio.actor, document.id, PASSWORD)).rejects.toThrow(/cannot be deleted/);
      const [stored] = await db().select().from(consentDocuments).where(eq(consentDocuments.id, document.id));
      expect(stored.status).toBe(status);
    }
  });

  it("does not let another studio delete a document", async () => {
    const a = await createStudio("A");
    const b = await createStudio("B");
    const { document } = await createConsentDocument(a.actor, { clientId: a.client.id, templateId: a.template.id });
    await expect(deleteUnsignedDocument(b.actor, document.id, PASSWORD)).rejects.toThrow(NotFoundError);
  });
});
