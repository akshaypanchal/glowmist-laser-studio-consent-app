// Creates the studio organization, its owner login and the GlowMist consent
// template. Safe to run more than once: it does nothing if the owner exists.
//
//   SEED_OWNER_EMAIL=you@example.com SEED_OWNER_PASSWORD='...' npm run db:seed
import "dotenv/config";
import { eq } from "drizzle-orm";
import { GLOWMIST_CONSENT_V1 } from "@/lib/consent-template";
import { hashPassword } from "@/lib/password";
import { db } from "@/server/db";
import { organizations, users } from "@/server/db/schema";
import { createTemplate } from "@/server/templates/service";

const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_OWNER_PASSWORD;
const name = process.env.SEED_OWNER_NAME ?? "Studio Owner";

if (!email || !password || password.length < 12) {
  console.error("Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD (at least 12 characters).");
  process.exit(1);
}

const [existing] = await db().select().from(users).where(eq(users.email, email)).limit(1);
if (existing) {
  console.log(`Owner ${email} already exists; nothing to do.`);
  process.exit(0);
}

const [organization] = await db()
  .insert(organizations)
  .values({ name: "GlowMist Laser Studio", recordsEmail: process.env.STUDIO_RECORDS_EMAIL ?? null })
  .returning();

const [owner] = await db()
  .insert(users)
  .values({ organizationId: organization.id, name, email, role: "OWNER", passwordHash: await hashPassword(password) })
  .returning();

await createTemplate(
  organization.id,
  { name: "Treatment Consent", description: "GlowMist Laser Studio treatment consent form", content: GLOWMIST_CONSENT_V1 },
  owner.id,
);

console.log(`Created organization, owner ${email} and the Treatment Consent template.`);
