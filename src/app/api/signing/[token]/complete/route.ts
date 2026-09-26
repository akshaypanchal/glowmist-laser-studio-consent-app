// POST /api/signing/:token/complete. The critical signing endpoint: validates everything on the server, creates the signed PDF and marks the form SIGNED, then emails the PDF to the client and the studio.

import { after, NextResponse } from "next/server";
import { sendSignedCopies } from "@/server/email/delivery";
import { contextFromHeaders } from "@/server/http";
import { completeSigning, SigningError } from "@/server/signing/complete";
import { signingErrorResponse } from "@/server/signing/http";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return signingErrorResponse(new SigningError("REQUEST_INVALID", "Invalid request."));
  }
  try {
    const result = await completeSigning(token, body, contextFromHeaders(request.headers));
    // The form is already SIGNED and stored. Emailing happens after the
    // response is sent, and a failure there never undoes the signature.
    after(() => sendSignedCopies(result.documentId));
    return NextResponse.json({ ok: true, reference: result.reference, signedAt: result.signedAt.toISOString() });
  } catch (error) {
    return signingErrorResponse(error);
  }
}
