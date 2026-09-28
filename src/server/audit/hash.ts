// Tamper-evident audit chain: each event's hash covers its contents plus the previous event's hash, and verifyChain() re-checks a whole chain.

import { canonicalJson, sha256Hex } from "@/lib/crypto";

export type AuditHashInput = {
  organizationId: string;
  documentId: string | null;
  sequence: number;
  eventType: string;
  actorType: string;
  actorId: string | null;
  timestamp: Date;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  previousEventHash: string | null;
};

/**
 * Hash of the canonical event contents plus the previous event's hash. Editing
 * or deleting any earlier event breaks every hash after it. This is a simple
 * tamper-evident hash chain, not a blockchain.
 */
export function computeEventHash(event: AuditHashInput): string {
  return sha256Hex(
    canonicalJson({
      organizationId: event.organizationId,
      documentId: event.documentId,
      sequence: event.sequence,
      eventType: event.eventType,
      actorType: event.actorType,
      actorId: event.actorId,
      timestamp: event.timestamp.getTime(),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: event.metadata,
      previousEventHash: event.previousEventHash,
    }),
  );
}

export type ChainEvent = AuditHashInput & { eventHash: string };

export type ChainVerification = { valid: true } | { valid: false; brokenAtSequence: number; reason: string };

/** Checks a chain ordered by sequence. */
export function verifyChain(events: ChainEvent[]): ChainVerification {
  let previous: string | null = null;
  for (const [index, event] of events.entries()) {
    if (event.sequence !== index + 1) {
      return { valid: false, brokenAtSequence: event.sequence, reason: "missing or reordered event" };
    }
    if (event.previousEventHash !== previous) {
      return { valid: false, brokenAtSequence: event.sequence, reason: "previous hash does not match" };
    }
    if (computeEventHash(event) !== event.eventHash) {
      return { valid: false, brokenAtSequence: event.sequence, reason: "event contents were modified" };
    }
    previous = event.eventHash;
  }
  return { valid: true };
}
