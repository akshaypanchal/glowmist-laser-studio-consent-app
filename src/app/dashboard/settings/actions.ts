// Server actions for the Settings page: studio details, adding staff, and changing your own password.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, startSession } from "@/server/auth/session";
import { addUser, changePassword, newUserSchema, PASSWORD_RULE, settingsSchema, updateOrganization } from "@/server/users/service";

export type SettingsState = { error?: string; message?: string };

export async function saveStudioAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser(["OWNER", "ADMIN"]);
  const parsed = settingsSchema.safeParse({ name: formData.get("name"), recordsEmail: formData.get("recordsEmail") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await updateOrganization(user.organizationId, parsed.data);
  revalidatePath("/dashboard", "layout");
  return { message: "Saved." };
}

export async function addUserAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser(["OWNER", "ADMIN"]);
  const parsed = newUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Only an owner can create another owner.
  if (parsed.data.role === "OWNER" && user.role !== "OWNER") return { error: "Only an owner can add another owner." };
  try {
    await addUser(user.organizationId, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add the user." };
  }
  revalidatePath("/dashboard/settings");
  return { message: `Added ${parsed.data.email}. Share the temporary password with them privately.` };
}

export async function changePasswordAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const next = PASSWORD_RULE.safeParse(formData.get("newPassword"));
  if (!next.success) return { error: next.error.issues[0].message };
  try {
    await changePassword(user.id, String(formData.get("currentPassword") ?? ""), next.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not change the password." };
  }
  await startSession(user.id);
  redirect("/dashboard/settings?password=changed");
}
