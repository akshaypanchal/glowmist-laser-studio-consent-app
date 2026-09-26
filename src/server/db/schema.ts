import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// All ids are random UUIDs (never sequential). Timestamps are unix milliseconds.
const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date());

export const organizations = sqliteTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  // Where the studio's copy of every signed consent is emailed.
  recordsEmail: text("records_email"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const USER_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = sqliteTable(
  "users",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull().default("STAFF"),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

// Staff login sessions. Only the SHA-256 of the cookie token is stored.
export const userSessions = sqliteTable(
  "user_sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("user_sessions_token_idx").on(t.tokenHash)],
);

export const clients = sqliteTable(
  "clients",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    externalReference: text("external_reference"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("clients_org_idx").on(t.organizationId)],
);

export const TEMPLATE_STATUSES = ["ACTIVE", "ARCHIVED"] as const;

export const consentTemplates = sqliteTable(
  "consent_templates",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status", { enum: TEMPLATE_STATUSES }).notNull().default("ACTIVE"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("templates_org_idx").on(t.organizationId)],
);

// Immutable once created. Wording changes always produce a new version.
export const consentTemplateVersions = sqliteTable(
  "consent_template_versions",
  {
    id: id(),
    templateId: text("template_id")
      .notNull()
      .references(() => consentTemplates.id),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: createdAt(),
    createdBy: text("created_by").references(() => users.id),
  },
  (t) => [uniqueIndex("template_versions_unique_idx").on(t.templateId, t.version)],
);

export const DOCUMENT_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "IN_PROGRESS",
  "SIGNED",
  "EXPIRED",
  "DECLINED",
  "VOIDED",
  "ARCHIVED",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const consentDocuments = sqliteTable(
  "consent_documents",
  {
    id: id(),
    // Human-friendly id shown on the PDF and in emails, e.g. DOC-7K3F9Q2A.
    reference: text("reference").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    templateId: text("template_id")
      .notNull()
      .references(() => consentTemplates.id),
    templateVersionId: text("template_version_id")
      .notNull()
      .references(() => consentTemplateVersions.id),
    status: text("status", { enum: DOCUMENT_STATUSES }).notNull().default("DRAFT"),
    // SHA-256 of the template version content the client was shown.
    documentHash: text("document_hash").notNull(),
    // The client's answers (treatments, medical history, etc.) as JSON, set at signing.
    formData: text("form_data"),
    formDataHash: text("form_data_hash"),
    signedDocumentHash: text("signed_document_hash"),
    originalFileKey: text("original_file_key"),
    signedFileKey: text("signed_file_key"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("documents_org_idx").on(t.organizationId),
    uniqueIndex("documents_reference_idx").on(t.reference),
  ],
);

export const documentSigners = sqliteTable("document_signers", {
  id: id(),
  documentId: text("document_id")
    .notNull()
    .references(() => consentDocuments.id),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  name: text("name"),
  email: text("email").notNull(),
  signedAt: integer("signed_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const signingSessions = sqliteTable(
  "signing_sessions",
  {
    id: id(),
    documentId: text("document_id")
      .notNull()
      .references(() => consentDocuments.id),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    signerId: text("signer_id")
      .notNull()
      .references(() => documentSigners.id),
    // Only the SHA-256 of the token is stored; the raw token lives only in the URL.
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("signing_sessions_token_idx").on(t.tokenHash)],
);

export const signatures = sqliteTable("signatures", {
  id: id(),
  documentId: text("document_id")
    .notNull()
    .references(() => consentDocuments.id),
  signerId: text("signer_id")
    .notNull()
    .references(() => documentSigners.id),
  signerName: text("signer_name").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  signatureHash: text("signature_hash").notNull(),
  createdAt: createdAt(),
});

export const FILE_KINDS = ["SIGNED_PDF", "SIGNATURE"] as const;

export const documentFiles = sqliteTable("document_files", {
  id: id(),
  documentId: text("document_id")
    .notNull()
    .references(() => consentDocuments.id),
  kind: text("kind", { enum: FILE_KINDS }).notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: createdAt(),
});

// Used only by the "database" storage driver (see src/server/storage). With R2
// configured this table stays empty.
export const storedBlobs = sqliteTable("stored_blobs", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  data: text("data").notNull(), // base64
  createdAt: createdAt(),
});

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    documentId: text("document_id").references(() => consentDocuments.id),
    // Which chain the event belongs to: the document id, or "organization" for
    // events not tied to a document. Not nullable so the unique index below holds.
    chainKey: text("chain_key").notNull(),
    // Position in the chain.
    sequence: integer("sequence").notNull(),
    eventType: text("event_type").notNull(),
    actorType: text("actor_type", { enum: ["USER", "SIGNER", "SYSTEM"] }).notNull(),
    actorId: text("actor_id"),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: text("metadata").notNull().default("{}"),
    previousEventHash: text("previous_event_hash"),
    eventHash: text("event_hash").notNull(),
  },
  (t) => [
    index("audit_org_doc_idx").on(t.organizationId, t.documentId),
    uniqueIndex("audit_chain_idx").on(t.organizationId, t.chainKey, t.sequence),
  ],
);

export const EMAIL_TYPES = ["SIGNING_INVITATION", "SIGNED_COPY_CLIENT", "SIGNED_COPY_ORGANIZATION"] as const;
export const EMAIL_STATUSES = ["SENT", "FAILED"] as const;

export const emailEvents = sqliteTable(
  "email_events",
  {
    id: id(),
    documentId: text("document_id")
      .notNull()
      .references(() => consentDocuments.id),
    recipient: text("recipient").notNull(),
    type: text("type", { enum: EMAIL_TYPES }).notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status", { enum: EMAIL_STATUSES }).notNull(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(1),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("email_events_doc_idx").on(t.documentId)],
);

// Fixed-window counters for rate limiting public endpoints. Kept in the
// database because serverless instances don't share memory.
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
});
