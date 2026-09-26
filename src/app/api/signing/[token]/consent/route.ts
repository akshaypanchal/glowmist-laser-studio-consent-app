// POST /api/signing/:token/consent. Called when the client ticks "I agree to use an electronic signature"; records CONSENT_CHECKED in the audit trail.

import { NextResponse } from "next/server";
import { contextFromHeaders } from "@/server/http";
import { recordConsentChecked } from "@/server/signing/complete";
import { signingErrorResponse } from "@/server/signing/http";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    await recordConsentChecked(token, contextFromHeaders(request.headers));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return signingErrorResponse(error);
  }
}
