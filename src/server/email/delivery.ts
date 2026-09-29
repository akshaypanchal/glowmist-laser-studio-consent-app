// Sends the app's emails and records every attempt in email_events and the audit trail. Email is a convenience copy: a failed email never undoes a signature, and failed signed-copy emails are retried later.

import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { recordEvent } from "@/server/audit/service";
import { db } from "@/server/db";
import {
  clients,
  consentDocuments,
  consentTemplates,
  consentTemplateVersions,
  emailEvents,
  EMAIL_TYPES,
  organizations,
} from "@/server/db/schema";
import { env } from "@/server/env";
import { storage } from "@/server/storage";
import { parseTemplateContent } from "@/server/templates/service";
import { emailService, type OutgoingEmail } from "./index";
import { signedCopyClientEmail, signedCopyOrganizationEmail, signingInvitationEmail } from "./templates";

type EmailType = (typeof EMAIL_TYPES)[number];

export const MAX_EMAIL_ATTEMPTS = 5;

function shortError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

/**
 * Sends one email and records the result. `existingEventId` is set when
 * retrying, so the same email_events row is updated instead of adding a new one.
 */
async function deliver(
  document: { id: string; organizationId: string },
  type: EmailType,
  email: OutgoingEmail,
  existingEventId?: string,
): Promise<boolean> {
  let status: "SENT" | "FAILED";
  let providerMessageId: string | null = null;
  let error: string | null = null;
  try {
    providerMessageId = (await emailService().send(email)).id;
    status = "SENT";
  } catch (e) {
    status = "FAILED";
    error = shortError(e);
    console.error(`Email ${type} for document ${document.id} failed: ${error}`);
  }

  const now = new Date();
  if (existingEventId) {
    const [existing] = await db().select().from(emailEvents).where(eq(emailEvents.id, existingEventId));
    await db()
      .update(emailEvents)
      .set({ status, providerMessageId, error, attempts: existing.attempts + 1, sentAt: status === "SENT" ? now : null })
      .where(eq(emailEvents.id, existingEventId));
  } else {
    await db().insert(emailEvents).values({
      documentId: document.id,
      recipient: email.to,
      type,
      providerMessageId,
      status,
      error,
      sentAt: status === "SENT" ? now : null,
    });
  }

  await recordEvent({
    organizationId: document.organizationId,
    documentId: document.id,
    eventType: status === "SENT" ? "EMAIL_SENT" : "EMAIL_FAILED",
    actorType: "SYSTEM",
    metadata: { type, recipient: email.to, providerMessageId, retry: Boolean(existingEventId) },
  });
  return status === "SENT";
}

function formatInStudioTime(date: Date, withTime: boolean) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : {}),
    timeZone: env().STUDIO_TIMEZONE,
  }).format(date);
}

/** Emails the client their signing link. The raw link can't be recovered later, so this is not retried automatically. */
export async function sendSigningInvitation(documentId: string, signingUrl: string) {
  const [row] = await db()
    .select({ document: consentDocuments, client: clients, organization: organizations })
    .from(consentDocuments)
    .innerJoin(clients, eq(clients.id, consentDocuments.clientId))
    .innerJoin(organizations, eq(organizations.id, consentDocuments.organizationId))
    .where(eq(consentDocuments.id, documentId));

  const email = signingInvitationEmail({
    studioName: row.organization.name,
    firstName: row.client.firstName,
    url: signingUrl,
    expiresAt: formatInStudioTime(row.document.expiresAt, true),
  });
  return deliver(row.document, "SIGNING_INVITATION", { to: row.client.email, ...email });
}

async function loadSignedDocument(documentId: string) {
  const [row] = await db()
    .select({
      document: consentDocuments,
      client: clients,
      organization: organizations,
      templateName: consentTemplates.name,
      version: consentTemplateVersions,
    })
    .from(consentDocuments)
    .innerJoin(clients, eq(clients.id, consentDocuments.clientId))
    .innerJoin(organizations, eq(organizations.id, consentDocuments.organizationId))
    .innerJoin(consentTemplates, eq(consentTemplates.id, consentDocuments.templateId))
    .innerJoin(consentTemplateVersions, eq(consentTemplateVersions.id, consentDocuments.templateVersionId))
    .where(eq(consentDocuments.id, documentId));
  if (!row || row.document.status !== "SIGNED" || !row.document.signedFileKey) {
    throw new Error(`Document ${documentId} is not signed`);
  }
  return row;
}

type SignedRow = Awaited<ReturnType<typeof loadSignedDocument>>;

function signedCopyEmail(row: SignedRow, type: "SIGNED_COPY_CLIENT" | "SIGNED_COPY_ORGANIZATION", pdf: Uint8Array, to: string): OutgoingEmail {
  const signedAt = row.document.completedAt!;
  const answers = row.document.formData ? (JSON.parse(row.document.formData) as { client?: { fullName?: string } }) : {};
  const clientName = answers.client?.fullName || `${row.client.firstName} ${row.client.lastName}`;
  const attachments = [{ filename: `signed-consent-${row.document.reference}.pdf`, content: pdf, contentType: "application/pdf" }];
  const content = parseTemplateContent(row.version.content);

  const message =
    type === "SIGNED_COPY_CLIENT"
      ? signedCopyClientEmail({
          studioName: content.studio.name,
          firstName: row.client.firstName,
          reference: row.document.reference,
          signedOn: formatInStudioTime(signedAt, false),
        })
      : signedCopyOrganizationEmail({
          studioName: content.studio.name,
          clientName,
          templateLabel: `${row.templateName} v${row.version.version}`,
          reference: row.document.reference,
          signedAt: `${formatInStudioTime(signedAt, true)} (${signedAt.toISOString().replace("T", " ").slice(0, 16)} UTC)`,
          documentHash: row.document.signedDocumentHash!,
        });
  return { to, ...message, attachments };
}

function recordsEmailFor(row: SignedRow) {
  return row.organization.recordsEmail || env().STUDIO_RECORDS_EMAIL || null;
}

/**
 * Emails the signed PDF to the client and the studio. Never throws: a failure
 * is recorded as FAILED and retried later by retryFailedEmails().
 */
export async function sendSignedCopies(documentId: string) {
  try {
    const row = await loadSignedDocument(documentId);
    const pdf = await storage().download(row.document.signedFileKey!);
    const results = { client: await deliver(row.document, "SIGNED_COPY_CLIENT", signedCopyEmail(row, "SIGNED_COPY_CLIENT", pdf, row.client.email)) } as {
      client: boolean;
      organization: boolean | null;
    };
    const recordsEmail = recordsEmailFor(row);
    results.organization = recordsEmail
      ? await deliver(row.document, "SIGNED_COPY_ORGANIZATION", signedCopyEmail(row, "SIGNED_COPY_ORGANIZATION", pdf, recordsEmail))
      : null;
    if (!recordsEmail) console.warn(`No records email configured for organization ${row.organization.id}`);
    return results;
  } catch (error) {
    console.error(`Sending signed copies for ${documentId} failed: ${shortError(error)}`);
    return { client: false, organization: false };
  }
}

/**
 * Retries failed signed-copy emails, oldest first, up to MAX_EMAIL_ATTEMPTS
 * each. Called daily by the cron route and from the dashboard.
 */
export async function retryFailedEmails(options: { documentId?: string; limit?: number } = {}) {
  const failed = await db()
    .select()
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.status, "FAILED"),
        inArray(emailEvents.type, ["SIGNED_COPY_CLIENT", "SIGNED_COPY_ORGANIZATION"]),
        lt(emailEvents.attempts, MAX_EMAIL_ATTEMPTS),
        options.documentId ? eq(emailEvents.documentId, options.documentId) : undefined,
      ),
    )
    .orderBy(emailEvents.createdAt)
    .limit(options.limit ?? 25);

  let sent = 0;
  for (const event of failed) {
    try {
      const row = await loadSignedDocument(event.documentId);
      const pdf = await storage().download(row.document.signedFileKey!);
      const type = event.type as "SIGNED_COPY_CLIENT" | "SIGNED_COPY_ORGANIZATION";
      // Send to the current address in case it was corrected since the failure.
      const to = type === "SIGNED_COPY_CLIENT" ? row.client.email : (recordsEmailFor(row) ?? event.recipient);
      if (await deliver(row.document, type, signedCopyEmail(row, type, pdf, to), event.id)) sent++;
    } catch (error) {
      console.error(`Retrying email ${event.id} failed: ${shortError(error)}`);
    }
  }
  return { attempted: failed.length, sent };
}
