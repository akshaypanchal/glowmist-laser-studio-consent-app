// Sends the app's emails and records every attempt in email_events and the audit trail. The signed PDF goes only to the studio's records inbox, never to the client. Email is a convenience copy: a failed email never undoes a signature, and failed signed-copy emails are retried later.

import "server-only";
import { and, eq, lt } from "drizzle-orm";
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
import { signedCopyOrganizationEmail, signingInvitationEmail } from "./templates";

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

function signedCopyEmail(row: SignedRow, pdf: Uint8Array, to: string): OutgoingEmail {
  const signedAt = row.document.completedAt!;
  const answers = row.document.formData ? (JSON.parse(row.document.formData) as { client?: { fullName?: string } }) : {};
  const clientName = answers.client?.fullName || `${row.client.firstName} ${row.client.lastName}`;
  const attachments = [{ filename: `signed-consent-${row.document.reference}.pdf`, content: pdf, contentType: "application/pdf" }];
  const content = parseTemplateContent(row.version.content);

  const message = signedCopyOrganizationEmail({
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
 * Emails the signed PDF to the studio's records inbox (the address set in
 * Settings, or STUDIO_RECORDS_EMAIL). The client is not emailed. Returns true
 * when sent, false when it failed (retried later by retryFailedEmails()), and
 * null when no records inbox is configured. Never throws.
 */
export async function sendSignedCopy(documentId: string): Promise<boolean | null> {
  try {
    const row = await loadSignedDocument(documentId);
    const recordsEmail = recordsEmailFor(row);
    if (!recordsEmail) {
      console.warn(`No records email configured for organization ${row.organization.id}; signed copy of ${documentId} not emailed`);
      return null;
    }
    const pdf = await storage().download(row.document.signedFileKey!);
    return await deliver(row.document, "SIGNED_COPY_ORGANIZATION", signedCopyEmail(row, pdf, recordsEmail));
  } catch (error) {
    console.error(`Sending signed copy for ${documentId} failed: ${shortError(error)}`);
    return false;
  }
}

/**
 * Retries failed studio signed-copy emails, oldest first, up to
 * MAX_EMAIL_ATTEMPTS each. Old failed client copies (SIGNED_COPY_CLIENT, from
 * before clients stopped being emailed) are left alone so they are never sent.
 * Called daily by the cron route and from the dashboard.
 */
export async function retryFailedEmails(options: { documentId?: string; limit?: number } = {}) {
  const failed = await db()
    .select()
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.status, "FAILED"),
        eq(emailEvents.type, "SIGNED_COPY_ORGANIZATION"),
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
      // Send to the current address in case it was corrected since the failure.
      const to = recordsEmailFor(row) ?? event.recipient;
      if (await deliver(row.document, "SIGNED_COPY_ORGANIZATION", signedCopyEmail(row, pdf, to), event.id)) sent++;
    } catch (error) {
      console.error(`Retrying email ${event.id} failed: ${shortError(error)}`);
    }
  }
  return { attempted: failed.length, sent };
}
