import type { DocumentStatus } from "@/server/db/schema";

// The only status changes the application allows. Anything else is a bug.
export const ALLOWED_TRANSITIONS: Record<DocumentStatus, readonly DocumentStatus[]> = {
  DRAFT: ["SENT", "VOIDED"],
  SENT: ["VIEWED", "EXPIRED", "VOIDED"],
  VIEWED: ["IN_PROGRESS", "EXPIRED", "VOIDED"],
  IN_PROGRESS: ["SIGNED", "DECLINED", "EXPIRED", "VOIDED"],
  SIGNED: ["VOIDED", "ARCHIVED"],
  EXPIRED: ["ARCHIVED"],
  DECLINED: ["ARCHIVED"],
  VOIDED: ["ARCHIVED"],
  ARCHIVED: [],
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
