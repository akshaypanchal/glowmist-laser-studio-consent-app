// Server action that saves edited template wording as a new version. Owners and admins only.

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { getTemplate } from "@/server/templates/queries";
import { createTemplateVersion } from "@/server/templates/service";

export type VersionState = { error?: string; message?: string };

export async function createVersionAction(_: VersionState, formData: FormData): Promise<VersionState> {
  const user = await requireUser(["OWNER", "ADMIN"]);
  const templateId = z.string().min(1).parse(formData.get("templateId"));
  if (!(await getTemplate(user.organizationId, templateId))) return { error: "Template not found." };

  let content: unknown;
  try {
    content = JSON.parse(String(formData.get("content") ?? ""));
  } catch {
    return { error: "The content is not valid JSON." };
  }
  try {
    const version = await createTemplateVersion(templateId, content, user.id);
    revalidatePath(`/dashboard/templates/${templateId}`);
    return { message: `Saved as version ${version.version}. New consent forms will use it; signed forms keep their original version.` };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: `Invalid template: ${error.issues[0].path.join(".")}: ${error.issues[0].message}` };
    throw error;
  }
}
