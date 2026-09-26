import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { createSigningToken, hashSigningToken, isWellFormedSigningToken } from "@/lib/signing-token";
import { db } from "@/server/db";
import { consentDocuments, signingSessions } from "@/server/db/schema";
import type { DbOrTx } from "@/server/db/types";
import { SIGNABLE_STATUSES } from "@/server/documents/status";
import { env } from "@/server/env";

export function signingUrl(token: string) {
  return new URL(`/sign/${token}`, env().APP_URL).toString();
}

/**
 * Creates a signing session for one document and signer. Returns the raw
 * token once; only its hash is stored.
 */
export async function createSigningSession(
  tx: DbOrTx,
  input: { documentId: string; clientId: string; signerId: string; expiresAt: Date },
) {
  const { token, tokenHash } = createSigningToken();
  const [session] = await tx
    .insert(signingSessions)
    .values({ ...input, tokenHash })
    .returning();
  return { session, token, url: signingUrl(token) };
}

/** Revokes every unused link for a document, e.g. before issuing a new one or voiding. */
export async function revokeSigningSessions(tx: DbOrTx, documentId: string) {
  const result = await tx
    .update(signingSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(signingSessions.documentId, documentId), isNull(signingSessions.usedAt), isNull(signingSessions.revokedAt)),
    );
  return result.rowsAffected;
}

export type SessionRejection = "INVALID" | "EXPIRED" | "USED" | "REVOKED" | "NOT_SIGNABLE";

export type ValidSession = {
  ok: true;
  session: typeof signingSessions.$inferSelect;
  document: typeof consentDocuments.$inferSelect;
};

/**
 * Looks up a signing link. A token only ever grants access to its own
 * document; it is never a general login.
 */
export async function validateSigningSession(
  token: string,
  conn: DbOrTx = db(),
): Promise<ValidSession | { ok: false; reason: SessionRejection; document?: typeof consentDocuments.$inferSelect }> {
  if (!isWellFormedSigningToken(token)) return { ok: false, reason: "INVALID" };
  const [row] = await conn
    .select({ session: signingSessions, document: consentDocuments })
    .from(signingSessions)
    .innerJoin(consentDocuments, eq(consentDocuments.id, signingSessions.documentId))
    .where(eq(signingSessions.tokenHash, hashSigningToken(token)))
    .limit(1);

  if (!row) return { ok: false, reason: "INVALID" };
  const { session, document } = row;
  if (session.clientId !== document.clientId) return { ok: false, reason: "INVALID" };
  if (session.usedAt) return { ok: false, reason: "USED", document };
  if (session.revokedAt) return { ok: false, reason: "REVOKED", document };
  if (session.expiresAt.getTime() <= Date.now() || document.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "EXPIRED", document };
  }
  if (!SIGNABLE_STATUSES.includes(document.status)) {
    return { ok: false, reason: "NOT_SIGNABLE", document };
  }
  return { ok: true, session, document };
}
