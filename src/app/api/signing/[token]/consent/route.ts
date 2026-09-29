// POST /api/signing/:token/consent. Called when the client ticks "I agree to use an electronic signature"; records CONSENT_CHECKED in the audit trail.

import { NextResponse } from "next/server";
import { contextFromHeaders } from "@/server/http";
import { recordConsentChecked } from "@/server/signing/complete";
import { allowSigningRequest, rateLimitedResponse, signingErrorResponse } from "@/server/signing/http";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = contextFromHeaders(request.headers);
  const limit = await allowSigningRequest(token, context.ipAddress, "consent");
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);
  try {
    await recordConsentChecked(token, context);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return signingErrorResponse(error);
  }
}
