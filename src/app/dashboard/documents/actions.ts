// Server actions on a document page: void it, retry failed emails, and check the stored PDF still matches its hash.

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sha256Hex } from "@/lib/crypto";
import { requireUser } from "@/server/auth/session";
import { getDocumentDetail } from "@/server/documents/queries";
import { voidDocument } from "@/server/documents/service";
import { retryFailedEmails } from "@/server/email/delivery";
import { requestContext } from "@/server/http";
import { storage } from "@/server/storage";

export type ActionState = { error?: string; message?: string };

export async function voidDocumentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(["OWNER", "ADMIN"]);
  const parsed = z
    .object({ documentId: z.string().min(1), reason: z.string().trim().min(3, "Give a short reason.").max(500) })
    .safeParse({ documentId: formData.get("documentId"), reason: formData.get("reason") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await voidDocument(
      { userId: user.id, organizationId: user.organizationId, context: await requestContext() },
      parsed.data.documentId,
      parsed.data.reason,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not void the document." };
  }
  revalidatePath(`/dashboard/documents/${parsed.data.documentId}`);
  return { message: "Document voided." };
}

export async function retryEmailsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const documentId = z.string().min(1).parse(formData.get("documentId"));
  if (!(await getDocumentDetail(user.organizationId, documentId))) return { error: "Document not found." };
  const result = await retryFailedEmails({ documentId });
  revalidatePath(`/dashboard/documents/${documentId}`);
  return { message: `Resent ${result.sent} of ${result.attempted} failed emails.` };
}

export async function verifyPdfAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const documentId = z.string().min(1).parse(formData.get("documentId"));
  const detail = await getDocumentDetail(user.organizationId, documentId);
  if (!detail?.document.signedFileKey) return { error: "There is no signed PDF to check." };
  const actual = sha256Hex(await storage().download(detail.document.signedFileKey));
  return actual === detail.document.signedDocumentHash
    ? { message: "The stored PDF matches the hash recorded at signing. It has not been changed." }
    : { error: "The stored PDF does NOT match the hash recorded at signing. It may have been altered." };
}
