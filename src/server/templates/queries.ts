// Read-only template queries: active templates for new forms, and every template with its version history.

import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { consentTemplates, consentTemplateVersions } from "@/server/db/schema";

export async function listActiveTemplates(organizationId: string) {
  return db()
    .select()
    .from(consentTemplates)
    .where(and(eq(consentTemplates.organizationId, organizationId), eq(consentTemplates.status, "ACTIVE")));
}

export async function listTemplatesWithVersions(organizationId: string) {
  const templates = await db()
    .select()
    .from(consentTemplates)
    .where(eq(consentTemplates.organizationId, organizationId))
    .orderBy(asc(consentTemplates.name));
  const versions = templates.length
    ? await db()
        .select()
        .from(consentTemplateVersions)
        .where(inArray(consentTemplateVersions.templateId, templates.map((t) => t.id)))
        .orderBy(desc(consentTemplateVersions.version))
    : [];
  return templates.map((t) => ({ ...t, versions: versions.filter((v) => v.templateId === t.id) }));
}

export async function getTemplate(organizationId: string, templateId: string) {
  return (await listTemplatesWithVersions(organizationId)).find((t) => t.id === templateId);
}
