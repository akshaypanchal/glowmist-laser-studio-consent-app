// The list of audit trail event types and their human-readable labels.

export const AUDIT_EVENT_TYPES = [
  "DOCUMENT_CREATED",
  "DOCUMENT_SENT",
  "DOCUMENT_VIEWED",
  "SIGNING_STARTED",
  "CONSENT_CHECKED",
  "SIGNATURE_CREATED",
  "DOCUMENT_SIGNED",
  "PDF_GENERATED",
  "DOCUMENT_STORED",
  "EMAIL_SENT",
  "EMAIL_FAILED",
  "DOCUMENT_DOWNLOADED",
  "DOCUMENT_VOIDED",
  "DOCUMENT_DECLINED",
  "SIGNING_LINK_REVOKED",
  "SIGNING_REJECTED",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  DOCUMENT_CREATED: "Document created",
  DOCUMENT_SENT: "Ready to sign",
  DOCUMENT_VIEWED: "Document viewed",
  SIGNING_STARTED: "Signing started",
  CONSENT_CHECKED: "Consent accepted",
  SIGNATURE_CREATED: "Signature created",
  DOCUMENT_SIGNED: "Document signed",
  PDF_GENERATED: "PDF generated",
  DOCUMENT_STORED: "PDF stored",
  EMAIL_SENT: "Email sent",
  EMAIL_FAILED: "Email failed",
  DOCUMENT_DOWNLOADED: "Document downloaded",
  DOCUMENT_VOIDED: "Document voided",
  DOCUMENT_DECLINED: "Document declined",
  SIGNING_LINK_REVOKED: "Earlier signing session closed",
  SIGNING_REJECTED: "Signing attempt rejected",
};
