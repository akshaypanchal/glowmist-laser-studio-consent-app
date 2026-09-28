// Writes audit events (who did what, when, from which IP/browser) and reads/verifies a document's audit trail.

import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { auditEvents } from "@/server/db/schema";
import type { DbOrTx, Transaction } from "@/server/db/types";
import type { AuditEventType } from "./events";
import { computeEventHash, verifyChain, type ChainVerification } from "./hash";

export type RequestContext = { ipAddress: string | null; userAgent: string | null };

export type RecordEventInput = {
  organizationId: string;
  documentId?: string | null;
  eventType: AuditEventType;
  actorType: "USER" | "SIGNER" | "SYSTEM";
  actorId?: string | null;
  context?: RequestContext;
  metadata?: Record<string, unknown>;
};

const ORGANIZATION_CHAIN = "organization";

function chainScope(organizationId: string, documentId: string | null) {
  return and(eq(auditEvents.organizationId, organizationId), eq(auditEvents.chainKey, documentId ?? ORGANIZATION_CHAIN));
}

async function appendEvent(tx: Transaction, input: RecordEventInput) {
  const documentId = input.documentId ?? null;
  const [last] = await tx
    .select({ sequence: auditEvents.sequence, eventHash: auditEvents.eventHash })
    .from(auditEvents)
    .where(chainScope(input.organizationId, documentId))
    .orderBy(desc(auditEvents.sequence))
    .limit(1);

  const event = {
    organizationId: input.organizationId,
    documentId,
    sequence: (last?.sequence ?? 0) + 1,
    eventType: input.eventType,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    timestamp: new Date(),
    ipAddress: input.context?.ipAddress ?? null,
    userAgent: input.context?.userAgent ?? null,
    metadata: input.metadata ?? {},
    previousEventHash: last?.eventHash ?? null,
  };
  const eventHash = computeEventHash(event);
  await tx
    .insert(auditEvents)
    .values({ ...event, chainKey: documentId ?? ORGANIZATION_CHAIN, metadata: JSON.stringify(event.metadata), eventHash });
  return eventHash;
}

/**
 * Appends an event to the audit chain of its document (or the organization's
 * chain for events not tied to a document). Pass a transaction to make the
 * event part of a larger atomic write; otherwise a write transaction is opened
 * so concurrent events cannot fork the chain.
 */
export async function recordEvent(input: RecordEventInput, tx?: Transaction): Promise<string> {
  if (tx) return appendEvent(tx, input);
  for (let attempt = 1; ; attempt++) {
    try {
      return await db().transaction((t) => appendEvent(t, input), { behavior: "immediate" });
    } catch (error) {
      // Another writer got there first (locked database, or it took our
      // sequence number). The unique chain index guarantees no fork, so retry.
      if (attempt >= 10 || !isRetryableWriteConflict(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt + Math.random() * 20));
    }
  }
}

function isRetryableWriteConflict(error: unknown): boolean {
  const text = [error, (error as { cause?: unknown })?.cause]
    .map((e) => (e instanceof Error ? `${e.message} ${(e as { code?: string }).code ?? ""}` : String(e)))
    .join(" ");
  return /SQLITE_BUSY|database is locked|UNIQUE constraint failed: audit_events/.test(text);
}

export async function listDocumentEvents(organizationId: string, documentId: string, conn: DbOrTx = db()) {
  return conn
    .select()
    .from(auditEvents)
    .where(chainScope(organizationId, documentId))
    .orderBy(asc(auditEvents.sequence));
}

export async function verifyDocumentChain(organizationId: string, documentId: string): Promise<ChainVerification> {
  const rows = await listDocumentEvents(organizationId, documentId);
  return verifyChain(rows.map((r) => ({ ...r, metadata: JSON.parse(r.metadata) as Record<string, unknown> })));
}
