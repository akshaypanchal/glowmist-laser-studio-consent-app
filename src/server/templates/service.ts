import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { canonicalJson, sha256Hex } from "@/lib/crypto";
import { templateContentSchema, type TemplateContent } from "@/lib/consent-template";
import { db } from "@/server/db";
import { consentTemplates, consentTemplateVersions } from "@/server/db/schema";
import type { DbOrTx } from "@/server/db/types";

export function hashTemplateContent(content: TemplateContent): string {
  return sha256Hex(canonicalJson(content));
}

/**
 * Adds a new immutable version. Existing versions are never updated, so every
 * signed document keeps pointing at exactly the wording that was signed.
 */
export async function createTemplateVersion(
  templateId: string,
  rawContent: unknown,
  createdBy: string | null,
  conn: DbOrTx = db(),
) {
  const content = templateContentSchema.parse(rawContent);
  const [latest] = await conn
    .select({ version: consentTemplateVersions.version })
    .from(consentTemplateVersions)
    .where(eq(consentTemplateVersions.templateId, templateId))
    .orderBy(desc(consentTemplateVersions.version))
    .limit(1);

  const [row] = await conn
    .insert(consentTemplateVersions)
    .values({
      templateId,
      version: (latest?.version ?? 0) + 1,
      content: canonicalJson(content),
      contentHash: hashTemplateContent(content),
      createdBy,
    })
    .returning();
  return row;
}

export async function createTemplate(
  organizationId: string,
  input: { name: string; description?: string; content: unknown },
  createdBy: string | null,
) {
  return db().transaction(async (tx) => {
    const [template] = await tx
      .insert(consentTemplates)
      .values({ organizationId, name: input.name, description: input.description })
      .returning();
    const version = await createTemplateVersion(template.id, input.content, createdBy, tx);
    return { template, version };
  });
}

export async function latestVersion(organizationId: string, templateId: string, conn: DbOrTx = db()) {
  const [row] = await conn
    .select({ version: consentTemplateVersions, template: consentTemplates })
    .from(consentTemplateVersions)
    .innerJoin(consentTemplates, eq(consentTemplates.id, consentTemplateVersions.templateId))
    .where(and(eq(consentTemplates.id, templateId), eq(consentTemplates.organizationId, organizationId)))
    .orderBy(desc(consentTemplateVersions.version))
    .limit(1);
  return row;
}

export function parseTemplateContent(stored: string): TemplateContent {
  return templateContentSchema.parse(JSON.parse(stored));
}
