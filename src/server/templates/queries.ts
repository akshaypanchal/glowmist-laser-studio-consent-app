import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { consentTemplates } from "@/server/db/schema";

export async function listActiveTemplates(organizationId: string) {
  return db()
    .select()
    .from(consentTemplates)
    .where(and(eq(consentTemplates.organizationId, organizationId), eq(consentTemplates.status, "ACTIVE")));
}
