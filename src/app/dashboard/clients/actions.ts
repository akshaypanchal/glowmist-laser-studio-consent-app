// Server actions for clients: add a client, create a consent form and signing link (optionally emailing it), issue a new link.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { clientInputSchema, createClient, type ClientInput } from "@/server/clients/service";
import { createConsentDocument, NotFoundError, reissueSigningLink } from "@/server/documents/service";
import { sendSigningInvitation } from "@/server/email/delivery";
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

export type LinkState = { error?: string; signingUrl?: string; reference?: string; emailed?: boolean | null; email?: string };

const createDocumentSchema = z.object({ clientId: z.string().min(1), templateId: z.string().min(1) });

export async function createConsentAction(_: LinkState, formData: FormData): Promise<LinkState> {
  const user = await requireUser();
  const parsed = createDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose a consent form." };
  try {
    const result = await createConsentDocument(
      { userId: user.id, organizationId: user.organizationId, context: await requestContext() },
      parsed.data,
    );
    const emailed = formData.get("sendEmail") === "on" ? await sendSigningInvitation(result.document.id, result.signingUrl) : null;
    revalidatePath(`/dashboard/clients/${parsed.data.clientId}`);
    return { signingUrl: result.signingUrl, reference: result.document.reference, emailed, email: result.client.email };
  } catch (error) {
    if (error instanceof NotFoundError) return { error: error.message };
    throw error;
  }
}

export async function reissueLinkAction(_: LinkState, formData: FormData): Promise<LinkState> {
  const user = await requireUser();
  const documentId = z.string().min(1).parse(formData.get("documentId"));
  try {
    const result = await reissueSigningLink(
      { userId: user.id, organizationId: user.organizationId, context: await requestContext() },
      documentId,
    );
    const emailed = formData.get("sendEmail") === "on" ? await sendSigningInvitation(result.document.id, result.signingUrl) : null;
    return { signingUrl: result.signingUrl, reference: result.document.reference, emailed };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create a new link." };
  }
}
