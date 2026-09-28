// Reads and validates server-only settings (database, email, storage). None of these reach the browser.

import "server-only";
import { z } from "zod";

// Server-side configuration. Nothing here is ever sent to the browser; none of
// these variables use the NEXT_PUBLIC_ prefix.
const schema = z.object({
  TURSO_DATABASE_URL: z.string().default("file:local.db"),
  TURSO_AUTH_TOKEN: z.string().optional(),

  APP_URL: z.string().url().default("http://localhost:3000"),

  // "r2" stores PDFs and signatures in a private Cloudflare R2 bucket.
  // "database" stores them in Turso (fine for a single studio on the free tier).
  STORAGE_DRIVER: z.enum(["r2", "database"]).default("database"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  // "resend" sends real email; "console" only logs that an email would be sent.
  EMAIL_DRIVER: z.enum(["resend", "console"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("GlowMist Laser Studio <onboarding@resend.dev>"),
  STUDIO_RECORDS_EMAIL: z.string().email().optional(),

  STUDIO_TIMEZONE: z.string().default("America/Toronto"),
  SIGNING_LINK_TTL_HOURS: z.coerce.number().int().positive().default(72),
  CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
    }
    const value = parsed.data;
    if (value.STORAGE_DRIVER === "r2") {
      for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const) {
        if (!value[key]) throw new Error(`${key} is required when STORAGE_DRIVER=r2`);
      }
    }
    if (value.EMAIL_DRIVER === "resend" && !value.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is required when EMAIL_DRIVER=resend");
    }
    cached = value;
  }
  return cached;
}

/** Test helper: forget the parsed config so a changed process.env is re-read. */
export function resetEnvCache() {
  cached = undefined;
}
