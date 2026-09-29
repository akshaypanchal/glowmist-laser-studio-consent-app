// POST /api/signing/:token/complete. The critical signing endpoint: validates everything on the server, creates the signed PDF and marks the form SIGNED.

import { NextResponse } from "next/server";
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
    return NextResponse.json({ ok: true, reference: result.reference, signedAt: result.signedAt.toISOString() });
  } catch (error) {
    return signingErrorResponse(error);
  }
}
