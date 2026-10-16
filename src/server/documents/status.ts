// The allowed document status changes (e.g. SENT -> VIEWED -> IN_PROGRESS -> SIGNED, or an unsigned form -> DELETED). Anything else is rejected.

import type { DocumentStatus } from "@/server/db/schema";

// The only status changes the application allows. Anything else is a bug.
export const ALLOWED_TRANSITIONS: Record<DocumentStatus, readonly DocumentStatus[]> = {
  DRAFT: ["SENT", "VOIDED", "DELETED"],
  SENT: ["VIEWED", "EXPIRED", "VOIDED", "DELETED"],
  VIEWED: ["IN_PROGRESS", "EXPIRED", "VOIDED", "DELETED"],
  IN_PROGRESS: ["SIGNED", "DECLINED", "EXPIRED", "VOIDED", "DELETED"],
  SIGNED: ["VOIDED", "ARCHIVED"],
  EXPIRED: ["ARCHIVED", "DELETED"],
  DECLINED: ["ARCHIVED"],
  VOIDED: ["ARCHIVED"],
  ARCHIVED: [],
  DELETED: [],
};

export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(from: DocumentStatus, to: DocumentStatus) {
    super(`Document cannot move from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: DocumentStatus, to: DocumentStatus) {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** Statuses in which the signer may still open the link and sign. */
export const SIGNABLE_STATUSES: readonly DocumentStatus[] = ["SENT", "VIEWED", "IN_PROGRESS"];

/**
 * Statuses in which staff may delete a document: it was created or opened but
 * never signed. Signed, declined and voided documents are records and are never deletable.
 */
export const DELETABLE_STATUSES: readonly DocumentStatus[] = ["DRAFT", "SENT", "VIEWED", "IN_PROGRESS", "EXPIRED"];
