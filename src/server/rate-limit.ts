// Simple fixed-window rate limiting kept in the database (serverless instances don't share memory). Used on the public signing endpoints and the login form to slow down guessing and abuse.

import "server-only";
import { sql } from "drizzle-orm";
import { sha256Hex } from "@/lib/crypto";
import { db } from "@/server/db";
import { rateLimits } from "@/server/db/schema";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };
export type RateLimitRule = { limit: number; windowSeconds: number };

export const LIMITS = {
  // Per IP address, across all signing links.
  signingPerIp: { limit: 60, windowSeconds: 600 },
  // Per signing link.
  signingPerToken: { limit: 30, windowSeconds: 600 },
  // Signing submissions per link (each builds a PDF, so it's the expensive call).
  completePerToken: { limit: 10, windowSeconds: 600 },
  loginPerIp: { limit: 20, windowSeconds: 900 },
  loginPerEmail: { limit: 8, windowSeconds: 900 },
} satisfies Record<string, RateLimitRule>;

/**
 * Counts one request against `key` and says whether it's allowed. The key is
 * hashed so raw IPs, emails and tokens aren't stored in this table.
 */
export async function hit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % rule.windowSeconds);
  const hashedKey = sha256Hex(`rate:${key}`);

  // One atomic upsert: start a new window, or add one to the current window.
  const [row] = await db()
    .insert(rateLimits)
    .values({ key: hashedKey, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStart} < ${windowStart} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${rateLimits.windowStart} < ${windowStart} THEN ${windowStart} ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning();

  return {
    allowed: row.count <= rule.limit,
    retryAfterSeconds: row.windowStart + rule.windowSeconds - now,
  };
}

export async function hitAll(checks: { key: string; rule: RateLimitRule }[]): Promise<RateLimitResult> {
  const results = await Promise.all(checks.map((c) => hit(c.key, c.rule)));
  const blocked = results.filter((r) => !r.allowed);
  return blocked.length
    ? { allowed: false, retryAfterSeconds: Math.max(...blocked.map((r) => r.retryAfterSeconds)) }
    : { allowed: true, retryAfterSeconds: 0 };
}

/** Removes counters from windows that have ended (run daily). */
export async function pruneRateLimits(olderThanSeconds = 86_400) {
  const cutoff = Math.floor(Date.now() / 1000) - olderThanSeconds;
  await db().delete(rateLimits).where(sql`${rateLimits.windowStart} < ${cutoff}`);
}
