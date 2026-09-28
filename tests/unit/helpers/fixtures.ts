// Test helper: creates a studio with an owner, the GlowMist template and a client.

import { GLOWMIST_CONSENT_V1 } from "@/lib/consent-template";
import { hashPassword } from "@/lib/password";
import { db } from "@/server/db";
import { organizations, users } from "@/server/db/schema";
import { createClient } from "@/server/clients/service";
import { createTemplate } from "@/server/templates/service";

export const testContext = { ipAddress: "203.0.113.10", userAgent: "vitest" };

/** An organization with an owner, the GlowMist template and one client. */
export async function createStudio(name = "Studio") {
  const [org] = await db().insert(organizations).values({ name, recordsEmail: "records@example.com" }).returning();
  const [owner] = await db()
    .insert(users)
    .values({
      organizationId: org.id,
      name: "Owner",
      email: `owner-${org.id}@example.com`,
      role: "OWNER",
      passwordHash: await hashPassword("password-for-tests"),
    })
    .returning();
  const { template, version } = await createTemplate(org.id, { name: "Treatment Consent", content: GLOWMIST_CONSENT_V1 }, owner.id);
  const client = await createClient(org.id, { firstName: "Jane", lastName: "Doe", email: "jane@example.com" });
  const actor = { userId: owner.id, organizationId: org.id, context: testContext };
  return { org, owner, template, version, client, actor };
}

export function tokenFromUrl(url: string) {
  return url.split("/sign/")[1];
}
