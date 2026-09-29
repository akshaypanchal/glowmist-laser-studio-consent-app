// GET /api/cron/retry-emails. Run once a day by Vercel Cron (see vercel.json) to resend signed-copy emails that failed. Requires the CRON_SECRET bearer token.

import { NextResponse } from "next/server";
import { safeEqualHex, sha256Hex } from "@/lib/crypto";
import { retryFailedEmails } from "@/server/email/delivery";
import { env } from "@/server/env";

export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !safeEqualHex(sha256Hex(supplied), sha256Hex(secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await retryFailedEmails());
}
