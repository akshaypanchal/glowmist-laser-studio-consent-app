import "server-only";
import { headers } from "next/headers";
import type { RequestContext } from "@/server/audit/service";

/** Client IP and user agent for the audit trail. On Vercel, x-forwarded-for is set by the platform. */
export async function requestContext(): Promise<RequestContext> {
  return contextFromHeaders(await headers());
}

export function contextFromHeaders(h: Headers): RequestContext {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
  };
}
