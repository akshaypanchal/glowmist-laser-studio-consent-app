// The signing flow on the server: recording that the client opened the link and ticked the e-signature consent, and completing the signature. The server decides whether a form is signed; the browser never can.

import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { answersSchema, type ConsentAnswers } from "@/lib/consent-answers";
import { canonicalJson, sha256Hex } from "@/lib/crypto";
import { decodeSignatureDataUrl } from "@/lib/signature-image";
import { recordEvent, type RequestContext } from "@/server/audit/service";
import { db } from "@/server/db";
import {
  clients,
  consentDocuments,
  consentTemplateVersions,
  documentFiles,
  documentSigners,
  signatures,
  signingSessions,
} from "@/server/db/schema";
import type { DbOrTx } from "@/server/db/types";
import { transitionDocument } from "@/server/documents/transition";
import { env } from "@/server/env";
import { generateSignedPdf } from "@/server/pdf/generate";
import { storage, storageKeys } from "@/server/storage";
import { parseTemplateContent } from "@/server/templates/service";
import { validateSigningSession, type SessionRejection, type ValidSession } from "./sessions";

export class SigningError extends Error {
  constructor(
    public code: SessionRejection | "CONSENT_REQUIRED" | "SIGNATURE_INVALID" | "ANSWERS_INVALID" | "REQUEST_INVALID",
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "SigningError";
  }
}

const REJECTION_MESSAGES: Record<SessionRejection, string> = {
  INVALID: "This signing link is not valid.",
  EXPIRED: "This form has expired. Please ask the studio to open it again.",
  USED: "This form has already been signed.",
  REVOKED: "This form was reopened on another screen. Please ask the studio to continue it.",
  NOT_SIGNABLE: "This form can no longer be signed. Please contact the studio.",
};

export const completeSigningSchema = z.object({
  consentAccepted: z.literal(true, { error: "You must agree to sign electronically." }),
  signature: z.string().min(1, "Please draw your signature.").max(800_000),
  signerName: z.string().trim().min(1, "Please type your full name.").max(200),
  answers: z.unknown(),
});

async function requireSession(token: string, context: RequestContext, conn: DbOrTx = db()): Promise<ValidSession> {
  const result = await validateSigningSession(token, conn);
  if (!result.ok) {
    if (result.document) {
      await recordEvent({
        organizationId: result.document.organizationId,
        documentId: result.document.id,
        eventType: "SIGNING_REJECTED",
        actorType: "SIGNER",
        context,
        metadata: { reason: result.reason },
      });
    }
    throw new SigningError(result.reason, REJECTION_MESSAGES[result.reason]);
  }
  return result;
}

/** Everything the signing page needs to show the form. */
export async function loadSigningPage(token: string, context: RequestContext) {
  const { session, document } = await requireSession(token, context);

  // First view moves SENT -> VIEWED. Every view is logged.
  if (document.status === "SENT") await transitionDocument(db(), document.id, "SENT", "VIEWED");
  await recordEvent({
    organizationId: document.organizationId,
    documentId: document.id,
    eventType: "DOCUMENT_VIEWED",
    actorType: "SIGNER",
    actorId: session.signerId,
    context,
    metadata: { signingSessionId: session.id },
  });

  const [row] = await db()
    .select({ client: clients, version: consentTemplateVersions })
    .from(clients)
    .innerJoin(consentTemplateVersions, eq(consentTemplateVersions.id, document.templateVersionId))
    .where(eq(clients.id, document.clientId))
    .limit(1);

  return {
    reference: document.reference,
    clientId: document.clientId,
    content: parseTemplateContent(row.version.content),
    client: {
      firstName: row.client.firstName,
      lastName: row.client.lastName,
      email: row.client.email,
      phone: row.client.phone ?? "",
    },
  };
}

/** Called when the client ticks the e-signature box: logs CONSENT_CHECKED and moves VIEWED -> IN_PROGRESS. */
export async function recordConsentChecked(token: string, context: RequestContext) {
  const { session, document } = await requireSession(token, context);
  await moveToInProgress(document);
  await recordEvent({
    organizationId: document.organizationId,
    documentId: document.id,
    eventType: "CONSENT_CHECKED",
    actorType: "SIGNER",
    actorId: session.signerId,
    context,
    metadata: { source: "checkbox" },
  });
}

async function moveToInProgress(document: typeof consentDocuments.$inferSelect, conn: DbOrTx = db()) {
  if (document.status === "SENT") await transitionDocument(conn, document.id, "SENT", "VIEWED");
  if (document.status === "SENT" || document.status === "VIEWED") {
    const moved = await transitionDocument(conn, document.id, "VIEWED", "IN_PROGRESS");
    if (moved) {
      await recordEvent({
        organizationId: document.organizationId,
        documentId: document.id,
        eventType: "SIGNING_STARTED",
        actorType: "SIGNER",
        metadata: {},
      });
    }
  }
}

export type CompletedSigning = {
  documentId: string;
  organizationId: string;
  reference: string;
  signedAt: Date;
  signedDocumentHash: string;
};

/**
 * Completes a signature. In order: validate the request and the link, claim
 * the link so it can never be used twice, build the PDF, hash it, store the
 * signature and PDF, then write the database records, audit events and SIGNED
 * status in one transaction. If anything fails before that transaction
 * commits, the link is released so the client can try again.
 */
export async function completeSigning(token: string, body: unknown, context: RequestContext): Promise<CompletedSigning> {
  // 1. Request shape (consent box, signature, name).
  const parsed = completeSigningSchema.safeParse(body);
  if (!parsed.success) {
    const consentIssue = parsed.error.issues.find((i) => i.path[0] === "consentAccepted");
    if (consentIssue) throw new SigningError("CONSENT_REQUIRED", "You must agree to sign electronically.");
    throw new SigningError("REQUEST_INVALID", parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  // 2. The link: exists, not expired, not used, not revoked, document signable.
  const { session, document } = await requireSession(token, context);

  // 3. The drawn signature.
  const signaturePng = decodeSignatureDataUrl(parsed.data.signature);
  if (!signaturePng) throw new SigningError("SIGNATURE_INVALID", "Please draw your signature.");

  // 4. The form answers, checked against the exact template version shown.
  const [version] = await db()
    .select()
    .from(consentTemplateVersions)
    .where(eq(consentTemplateVersions.id, document.templateVersionId))
    .limit(1);
  const content = parseTemplateContent(version.content);
  if (sha256Hex(canonicalJson(content)) !== document.documentHash) {
    throw new Error(`Template version ${version.id} no longer matches the hash recorded on ${document.reference}`);
  }
  const answersResult = answersSchema(content).safeParse(parsed.data.answers);
  if (!answersResult.success) {
    throw new SigningError(
      "ANSWERS_INVALID",
      answersResult.error.issues[0]?.message ?? "Please check the form.",
      z.flattenError(answersResult.error).fieldErrors,
    );
  }
  const answers: ConsentAnswers = answersResult.data;

  // 5. Claim the link. The conditional UPDATE means two simultaneous submits
  //    can't both succeed.
  const claimedAt = new Date();
  const claim = await db()
    .update(signingSessions)
    .set({ usedAt: claimedAt })
    .where(and(eq(signingSessions.id, session.id), isNull(signingSessions.usedAt), isNull(signingSessions.revokedAt)));
  if (claim.rowsAffected !== 1) throw new SigningError("USED", REJECTION_MESSAGES.USED);

  const uploaded: string[] = [];
  try {
    await moveToInProgress(document);

    // 6. Build and hash the PDF.
    const signedAt = claimedAt;
    const pdf = await generateSignedPdf({
      content,
      templateVersion: version.version,
      answers,
      signaturePng,
      signerName: parsed.data.signerName,
      signedAt,
      reference: document.reference,
      timeZone: env().STUDIO_TIMEZONE,
    });
    const signedDocumentHash = sha256Hex(pdf);
    const signatureHash = sha256Hex(signaturePng);
    const formData = canonicalJson(answers);

    // 7. Store the files (R2 or database, see src/server/storage).
    const signatureId = crypto.randomUUID();
    const signatureKey = storageKeys.signature(document.organizationId, document.id, signatureId);
    const pdfKey = storageKeys.signedPdf(document.organizationId, document.id);
    await storage().upload(signatureKey, signaturePng, "image/png");
    uploaded.push(signatureKey);
    await storage().upload(pdfKey, pdf, "application/pdf");
    uploaded.push(pdfKey);

    // 8. Records, audit trail and status, all or nothing.
    await db().transaction(async (tx) => {
      const audit = (eventType: Parameters<typeof recordEvent>[0]["eventType"], metadata: Record<string, unknown>) =>
        recordEvent(
          {
            organizationId: document.organizationId,
            documentId: document.id,
            eventType,
            actorType: "SIGNER",
            actorId: session.signerId,
            context,
            metadata,
          },
          tx,
        );

      await tx.insert(signatures).values({
        id: signatureId,
        documentId: document.id,
        signerId: session.signerId,
        signerName: parsed.data.signerName,
        storageKey: signatureKey,
        mimeType: "image/png",
        signatureHash,
      });
      await tx.insert(documentFiles).values([
        {
          documentId: document.id,
          kind: "SIGNATURE",
          storageKey: signatureKey,
          mimeType: "image/png",
          sizeBytes: signaturePng.length,
          sha256: signatureHash,
        },
        {
          documentId: document.id,
          kind: "SIGNED_PDF",
          storageKey: pdfKey,
          mimeType: "application/pdf",
          sizeBytes: pdf.length,
          sha256: signedDocumentHash,
        },
      ]);
      await tx
        .update(documentSigners)
        .set({ name: parsed.data.signerName, signedAt })
        .where(eq(documentSigners.id, session.signerId));

      await audit("CONSENT_CHECKED", { source: "submission" });
      await audit("SIGNATURE_CREATED", { signatureId, signatureHash, signerName: parsed.data.signerName });

      const signed = await transitionDocument(tx, document.id, "IN_PROGRESS", "SIGNED", {
        formData,
        formDataHash: sha256Hex(formData),
        signedDocumentHash,
        signedFileKey: pdfKey,
        completedAt: signedAt,
      });
      if (!signed) throw new SigningError("NOT_SIGNABLE", REJECTION_MESSAGES.NOT_SIGNABLE);

      await audit("DOCUMENT_SIGNED", {
        templateVersionId: version.id,
        templateVersion: version.version,
        documentHash: document.documentHash,
        formDataHash: sha256Hex(formData),
      });
      await audit("PDF_GENERATED", { signedDocumentHash, sizeBytes: pdf.length });
      await audit("DOCUMENT_STORED", { storageKey: pdfKey, driver: env().STORAGE_DRIVER });
    });

    return {
      documentId: document.id,
      organizationId: document.organizationId,
      reference: document.reference,
      signedAt,
      signedDocumentHash,
    };
  } catch (error) {
    // Nothing was committed: release the link and remove any uploaded files.
    await db().update(signingSessions).set({ usedAt: null }).where(eq(signingSessions.id, session.id));
    await Promise.allSettled(uploaded.map((key) => storage().delete(key)));
    throw error;
  }
}
