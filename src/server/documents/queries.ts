// Read-only queries for the dashboard: document lists, a document's full details, dashboard counts and recent audit events. Every query is limited to one studio.

import "server-only";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditEvents,
  clients,
  consentDocuments,
  consentTemplates,
  consentTemplateVersions,
  documentFiles,
  emailEvents,
  signatures,
  type DocumentStatus,
} from "@/server/db/schema";
import { listDocumentEvents, verifyDocumentChain } from "@/server/audit/service";

const documentRow = {
  id: consentDocuments.id,
  reference: consentDocuments.reference,
  status: consentDocuments.status,
  createdAt: consentDocuments.createdAt,
  completedAt: consentDocuments.completedAt,
  clientId: clients.id,
  clientName: clients.firstName,
  clientLastName: clients.lastName,
  templateName: consentTemplates.name,
};

export async function listDocuments(organizationId: string, options: { status?: DocumentStatus; limit?: number } = {}) {
  return db()
    .select(documentRow)
    .from(consentDocuments)
    .innerJoin(clients, eq(clients.id, consentDocuments.clientId))
    .innerJoin(consentTemplates, eq(consentTemplates.id, consentDocuments.templateId))
    .where(
      and(
        eq(consentDocuments.organizationId, organizationId),
        options.status ? eq(consentDocuments.status, options.status) : undefined,
      ),
    )
    .orderBy(desc(consentDocuments.createdAt))
    .limit(options.limit ?? 200);
}

export async function getDocumentDetail(organizationId: string, documentId: string) {
  const [row] = await db()
    .select({
      document: consentDocuments,
      client: clients,
      templateName: consentTemplates.name,
      templateVersion: consentTemplateVersions.version,
    })
    .from(consentDocuments)
    .innerJoin(clients, eq(clients.id, consentDocuments.clientId))
    .innerJoin(consentTemplates, eq(consentTemplates.id, consentDocuments.templateId))
    .innerJoin(consentTemplateVersions, eq(consentTemplateVersions.id, consentDocuments.templateVersionId))
    .where(and(eq(consentDocuments.id, documentId), eq(consentDocuments.organizationId, organizationId)))
    .limit(1);
  if (!row) return undefined;

  const [events, chain, emails, files, signatureRows] = await Promise.all([
    listDocumentEvents(organizationId, documentId),
    verifyDocumentChain(organizationId, documentId),
    db().select().from(emailEvents).where(eq(emailEvents.documentId, documentId)).orderBy(emailEvents.createdAt),
    db().select().from(documentFiles).where(eq(documentFiles.documentId, documentId)),
    db().select().from(signatures).where(eq(signatures.documentId, documentId)),
  ]);
  return { ...row, events, chain, emails, files, signature: signatureRows[0] };
}

export async function dashboardSummary(organizationId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [[signedThisMonth], [awaiting], [failedEmails], recent] = await Promise.all([
    db()
      .select({ n: count() })
      .from(consentDocuments)
      .where(
        and(
          eq(consentDocuments.organizationId, organizationId),
          eq(consentDocuments.status, "SIGNED"),
          gte(consentDocuments.completedAt, monthStart),
        ),
      ),
    db()
      .select({ n: count() })
      .from(consentDocuments)
      .where(
        and(
          eq(consentDocuments.organizationId, organizationId),
          inArray(consentDocuments.status, ["SENT", "VIEWED", "IN_PROGRESS"]),
        ),
      ),
    db()
      .select({ n: count() })
      .from(emailEvents)
      .innerJoin(consentDocuments, eq(consentDocuments.id, emailEvents.documentId))
      .where(and(eq(consentDocuments.organizationId, organizationId), eq(emailEvents.status, "FAILED"))),
    listDocuments(organizationId, { limit: 8 }),
  ]);
  return { signedThisMonth: signedThisMonth.n, awaiting: awaiting.n, failedEmails: failedEmails.n, recent };
}

export async function recentAuditEvents(organizationId: string, limit = 100) {
  return db()
    .select({ event: auditEvents, reference: consentDocuments.reference })
    .from(auditEvents)
    .leftJoin(consentDocuments, eq(consentDocuments.id, auditEvents.documentId))
    .where(eq(auditEvents.organizationId, organizationId))
    .orderBy(desc(auditEvents.timestamp))
    .limit(limit);
}
