// A document's page: status, template version, hashes, the client's answers, PDF view/download, email history, the audit trail with its integrity check, and actions (void, retry emails).

import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/documents/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { ConsentAnswers } from "@/lib/consent-answers";
import { formatDateTime } from "@/lib/format";
import { AUDIT_EVENT_LABELS, type AuditEventType } from "@/server/audit/events";
import { requireUser } from "@/server/auth/session";
import { getDocumentDetail } from "@/server/documents/queries";
import { SIGNABLE_STATUSES } from "@/server/documents/status";
import { env } from "@/server/env";
import { RetryEmailsButton, VerifyPdfButton, VoidDocumentForm } from "../document-actions";

const PHOTO_LABELS: Record<string, string> = {
  record: "Photos for client record",
  marketing: "Photos for education or marketing",
  none: "No photography",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-all">{children}</dd>
    </div>
  );
}

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const detail = await getDocumentDetail(user.organizationId, id);
  if (!detail) notFound();

  const tz = env().STUDIO_TIMEZONE;
  const { document, client } = detail;
  const answers = document.formData ? (JSON.parse(document.formData) as ConsentAnswers) : null;
  const canManage = user.role === "OWNER" || user.role === "ADMIN";
  const canVoid = canManage && (document.status === "SIGNED" || SIGNABLE_STATUSES.includes(document.status) || document.status === "DRAFT");
  const failedEmails = detail.emails.filter((e) => e.status === "FAILED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {detail.templateName} for {client.firstName} {client.lastName}
          </h1>
          <p className="font-mono text-sm text-stone-500">{document.reference}</p>
        </div>
        {document.signedFileKey && (
          <div className="flex gap-2">
            <a href={`/api/documents/${document.id}/download?inline=1`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
              View PDF
            </a>
            <a href={`/api/documents/${document.id}/download`} className={buttonClass()}>
              Download PDF
            </a>
          </div>
        )}
      </div>

      <Card>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Field label="Status">
            <StatusBadge status={document.status} />
          </Field>
          <Field label="Template">{detail.templateName}</Field>
          <Field label="Version">{detail.templateVersion}</Field>
          <Field label="Client">
            <Link href={`/dashboard/clients/${client.id}`} className="text-brand-700 hover:underline">
              {client.firstName} {client.lastName}
            </Link>{" "}
            · {client.email}
          </Field>
          <Field label="Created">{formatDateTime(document.createdAt, tz)}</Field>
          <Field label="Signed">{formatDateTime(document.completedAt, tz)}</Field>
          {detail.signature && <Field label="Signed by">{detail.signature.signerName}</Field>}
          <Field label="Link expires">{formatDateTime(document.expiresAt, tz)}</Field>
        </dl>
        <dl className="mt-6 grid gap-4 border-t border-stone-100 pt-4">
          <Field label="Consent wording hash (SHA-256)">
            <code className="text-xs">{document.documentHash}</code>
          </Field>
          {document.signedDocumentHash && (
            <Field label="Signed PDF hash (SHA-256)">
              <code className="text-xs">{document.signedDocumentHash}</code>
            </Field>
          )}
        </dl>
        {document.signedFileKey && (
          <div className="mt-4">
            <VerifyPdfButton documentId={document.id} />
          </div>
        )}
      </Card>

      {answers && (
        <Card>
          <CardTitle>Client&apos;s answers</CardTitle>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">{answers.client.fullName}</Field>
            <Field label="Date of birth">{answers.client.dateOfBirth}</Field>
            <Field label="Phone">{answers.client.phone}</Field>
            <Field label="Email">{answers.client.email}</Field>
            <Field label="Mailing address">{answers.client.mailingAddress}</Field>
            <Field label="Emergency contact">
              {answers.client.emergencyContact} · {answers.client.emergencyPhone}
            </Field>
            <Field label="Date of service">{answers.client.dateOfService}</Field>
            <Field label="Treatments">{answers.treatments.join(", ")}</Field>
            <Field label="Medical history">{answers.medicalConditions.length ? answers.medicalConditions.join(", ") : "None checked"}</Field>
            <Field label="Allergies">{answers.allergies || "None listed"}</Field>
            <Field label="Other conditions">{answers.otherConditions || "None listed"}</Field>
            <Field label="Photography">{answers.photography.map((id) => PHOTO_LABELS[id] ?? id).join(", ")}</Field>
          </dl>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Audit trail</h2>
          {detail.chain.valid ? (
            <Badge tone="positive">Hash chain verified</Badge>
          ) : (
            <Badge tone="negative">Chain broken at event {detail.chain.brokenAtSequence}: {detail.chain.reason}</Badge>
          )}
        </div>
        <ol className="space-y-3">
          {detail.events.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className={e.eventType.includes("FAILED") || e.eventType === "SIGNING_REJECTED" ? "text-red-600" : "text-emerald-600"}>
                {e.eventType.includes("FAILED") || e.eventType === "SIGNING_REJECTED" ? "✗" : "✓"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{AUDIT_EVENT_LABELS[e.eventType as AuditEventType] ?? e.eventType}</p>
                <p className="text-xs text-stone-500">
                  {formatDateTime(e.timestamp, tz)} · {e.actorType.toLowerCase()}
                  {e.ipAddress ? ` · ${e.ipAddress}` : ""}
                  {e.userAgent ? ` · ${e.userAgent.slice(0, 80)}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Emails</h2>
          {failedEmails > 0 && <RetryEmailsButton documentId={document.id} />}
        </div>
        {detail.emails.length === 0 ? (
          <p className="text-sm text-stone-600">No emails sent for this document.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.emails.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <Badge tone={e.status === "SENT" ? "positive" : "negative"}>{e.status}</Badge>
                <span>{e.type.replaceAll("_", " ").toLowerCase()}</span>
                <span className="text-stone-500">to {e.recipient}</span>
                <span className="text-stone-500">· {formatDateTime(e.sentAt ?? e.createdAt, tz)}</span>
                {e.attempts > 1 && <span className="text-stone-500">· {e.attempts} attempts</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canVoid && (
        <Card>
          <CardTitle>Void document</CardTitle>
          <p className="mb-3 text-sm text-stone-600">
            Voiding marks the document as no longer valid and cancels any open signing link. The PDF and history are kept.
          </p>
          <VoidDocumentForm documentId={document.id} />
        </Card>
      )}
    </div>
  );
}
