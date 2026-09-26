// Changes a document's status safely: only if the change is allowed and the document is still in the expected status.

import "server-only";
import { and, eq } from "drizzle-orm";
import { consentDocuments, type DocumentStatus } from "@/server/db/schema";
import type { DbOrTx } from "@/server/db/types";
import { assertTransition } from "./status";

/**
 * Moves a document from one status to another. The UPDATE is conditional on
 * the current status, so two concurrent requests cannot both win.
 * Returns false if the document was not in `from` any more.
 */
export async function transitionDocument(
  tx: DbOrTx,
  documentId: string,
  from: DocumentStatus,
  to: DocumentStatus,
  extra: Partial<typeof consentDocuments.$inferInsert> = {},
): Promise<boolean> {
  assertTransition(from, to);
  const result = await tx
    .update(consentDocuments)
    .set({ ...extra, status: to })
    .where(and(eq(consentDocuments.id, documentId), eq(consentDocuments.status, from)));
  return result.rowsAffected === 1;
}
