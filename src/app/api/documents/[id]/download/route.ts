// GET /api/documents/:id/download. Staff only: checks the login and that the document belongs to their studio, records DOCUMENT_DOWNLOADED, then serves the signed PDF. With R2 it redirects to a link that expires after 60 seconds; the bucket itself is never public.

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { recordEvent } from "@/server/audit/service";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { consentDocuments } from "@/server/db/schema";
import { contextFromHeaders } from "@/server/http";
import { storage } from "@/server/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [document] = await db()
    .select()
    .from(consentDocuments)
    .where(and(eq(consentDocuments.id, id), eq(consentDocuments.organizationId, user.organizationId)))
    .limit(1);
  // Another studio's document gets the same answer as a missing one.
  if (!document?.signedFileKey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inline = new URL(request.url).searchParams.get("inline") === "1";
  const filename = `signed-consent-${document.reference}.pdf`;

  await recordEvent({
    organizationId: user.organizationId,
    documentId: document.id,
    eventType: "DOCUMENT_DOWNLOADED",
    actorType: "USER",
    actorId: user.id,
    context: contextFromHeaders(request.headers),
    metadata: { inline },
  });

  const signedUrl = await storage().createSignedUrl(document.signedFileKey, 60, inline ? undefined : filename);
  if (signedUrl) return NextResponse.redirect(signedUrl, { headers: { "Cache-Control": "no-store" } });

  const bytes = await storage().download(document.signedFileKey);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
