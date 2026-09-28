// Creates a client's consent form (pinned to the current template version) with its signing link, and issues replacement links.

import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { documentReference } from "@/lib/crypto";
import { recordEvent, type RequestContext } from "@/server/audit/service";
import { db } from "@/server/db";
import { clients, consentDocuments, consentTemplates, documentSigners } from "@/server/db/schema";
import { SIGNABLE_STATUSES } from "@/server/documents/status";
import { env } from "@/server/env";
import { createSigningSession, revokeSigningSessions } from "@/server/signing/sessions";
import { latestVersion } from "@/server/templates/service";
import { transitionDocument } from "./transition";

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

type Actor = { userId: string; organizationId: string; context: RequestContext };

/**
 * Creates a consent document from the template's latest (immutable) version,
 * plus its signer and a signing link, and marks it SENT.
 * The raw signing URL is returned once and never stored.
 */
export async function createConsentDocument(actor: Actor, input: { clientId: string; templateId: string }) {
  const ttlMs = env().SIGNING_LINK_TTL_HOURS * 3600_000;

  return db().transaction(async (tx) => {
    const [client] = await tx
      .select()
      .from(clients)
      .where(and(eq(clients.id, input.clientId), eq(clients.organizationId, actor.organizationId)))
      .limit(1);
    if (!client) throw new NotFoundError("Client");

    const latest = await latestVersion(actor.organizationId, input.templateId, tx);
    if (!latest || latest.template.status !== "ACTIVE") throw new NotFoundError("Template");

    const expiresAt = new Date(Date.now() + ttlMs);
    const [document] = await tx
      .insert(consentDocuments)
      .values({
        reference: documentReference(),
        organizationId: actor.organizationId,
        clientId: client.id,
        templateId: latest.template.id,
        templateVersionId: latest.version.id,
        documentHash: latest.version.contentHash,
        createdBy: actor.userId,
        expiresAt,
      })
      .returning();

    const [signer] = await tx
      .insert(documentSigners)
      .values({ documentId: document.id, clientId: client.id, email: client.email })
      .returning();

    await recordEvent(
      {
        organizationId: actor.organizationId,
        documentId: document.id,
        eventType: "DOCUMENT_CREATED",
        actorType: "USER",
        actorId: actor.userId,
        context: actor.context,
        metadata: {
          reference: document.reference,
          templateId: latest.template.id,
          templateVersion: latest.version.version,
          templateVersionId: latest.version.id,
          contentHash: latest.version.contentHash,
        },
      },
      tx,
    );

    const link = await createSigningSession(tx, {
      documentId: document.id,
      clientId: client.id,
      signerId: signer.id,
      expiresAt,
    });
    await transitionDocument(tx, document.id, "DRAFT", "SENT");
    await recordEvent(
      {
        organizationId: actor.organizationId,
        documentId: document.id,
        eventType: "DOCUMENT_SENT",
        actorType: "USER",
        actorId: actor.userId,
        context: actor.context,
        metadata: { signingSessionId: link.session.id, expiresAt: expiresAt.toISOString() },
      },
      tx,
    );

    return { document: { ...document, status: "SENT" as const }, client, signingUrl: link.url };
  });
}

/**
 * Revokes the current link and issues a fresh one (for a lost or expired
 * email). Only for documents that have not been completed.
 */
export async function reissueSigningLink(actor: Actor, documentId: string) {
  const ttlMs = env().SIGNING_LINK_TTL_HOURS * 3600_000;
  return db().transaction(async (tx) => {
    const [document] = await tx
      .select()
      .from(consentDocuments)
      .where(and(eq(consentDocuments.id, documentId), eq(consentDocuments.organizationId, actor.organizationId)))
      .limit(1);
    if (!document) throw new NotFoundError("Document");
    if (!SIGNABLE_STATUSES.includes(document.status)) {
      throw new Error(`A new link cannot be issued for a ${document.status.toLowerCase()} document`);
    }
    const [signer] = await tx.select().from(documentSigners).where(eq(documentSigners.documentId, document.id)).limit(1);

    const revoked = await revokeSigningSessions(tx, document.id);
    if (revoked > 0) {
      await recordEvent(
        {
          organizationId: actor.organizationId,
          documentId: document.id,
          eventType: "SIGNING_LINK_REVOKED",
          actorType: "USER",
          actorId: actor.userId,
          context: actor.context,
          metadata: { revoked },
        },
        tx,
      );
    }

    const expiresAt = new Date(Date.now() + ttlMs);
    await tx.update(consentDocuments).set({ expiresAt }).where(eq(consentDocuments.id, document.id));
    const link = await createSigningSession(tx, {
      documentId: document.id,
      clientId: document.clientId,
      signerId: signer.id,
      expiresAt,
    });
    await recordEvent(
      {
        organizationId: actor.organizationId,
        documentId: document.id,
        eventType: "DOCUMENT_SENT",
        actorType: "USER",
        actorId: actor.userId,
        context: actor.context,
        metadata: { signingSessionId: link.session.id, expiresAt: expiresAt.toISOString(), reissued: true },
      },
      tx,
    );
    return { document, signingUrl: link.url };
  });
}

export async function listClientDocuments(organizationId: string, clientId: string) {
  return db()
    .select({
      id: consentDocuments.id,
      reference: consentDocuments.reference,
      status: consentDocuments.status,
      createdAt: consentDocuments.createdAt,
      completedAt: consentDocuments.completedAt,
      templateName: consentTemplates.name,
    })
    .from(consentDocuments)
    .innerJoin(consentTemplates, eq(consentTemplates.id, consentDocuments.templateId))
    .where(and(eq(consentDocuments.organizationId, organizationId), eq(consentDocuments.clientId, clientId)))
    .orderBy(desc(consentDocuments.createdAt));
}
