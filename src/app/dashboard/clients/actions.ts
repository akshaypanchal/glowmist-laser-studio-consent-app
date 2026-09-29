// Server actions for clients: add a client, start a consent form on this device, and reopen an unsigned one.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { clientInputSchema, createClient, type ClientInput } from "@/server/clients/service";
import { createConsentDocument, reissueSigningLink } from "@/server/documents/service";
import { requestContext } from "@/server/http";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

export async function createClientAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const input = Object.fromEntries(formData) as Record<string, string>;
  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const client = await createClient(user.organizationId, input as ClientInput);
  revalidatePath("/dashboard/clients");
  redirect(`/dashboard/clients/${client.id}`);
}

const createDocumentSchema = z.object({ clientId: z.string().min(1), templateId: z.string().min(1) });

/**
 * Creates the consent form and opens it straight away on this device, so the
 * client can fill it in and sign at the studio. Nothing is emailed; the
 * one-time signing link never leaves this browser.
 */
export async function startConsentAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createDocumentSchema.parse(Object.fromEntries(formData));
  const result = await createConsentDocument(
    { userId: user.id, organizationId: user.organizationId, context: await requestContext() },
    parsed,
  );
  revalidatePath(`/dashboard/clients/${parsed.clientId}`);
  redirect(signingPath(result.signingUrl));
}

/** Reopens an unsigned form on this device. The previous signing session is closed first. */
export async function continueConsentAction(formData: FormData) {
  const user = await requireUser();
  const documentId = z.string().min(1).parse(formData.get("documentId"));
  const result = await reissueSigningLink(
    { userId: user.id, organizationId: user.organizationId, context: await requestContext() },
    documentId,
  );
  redirect(signingPath(result.signingUrl));
}

// Redirect within this app (same host the staff member is on), whatever APP_URL is set to.
function signingPath(url: string) {
  return new URL(url).pathname;
}
