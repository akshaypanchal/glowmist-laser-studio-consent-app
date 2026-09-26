// Staff accounts and studio settings: adding staff, changing a password, and updating the studio's name and records email. Only owners and admins can change these.

import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/password";
import { db } from "@/server/db";
import { organizations, USER_ROLES, userSessions, users } from "@/server/db/schema";

export const PASSWORD_RULE = z.string().min(12, "Use at least 12 characters.").max(200);

export const newUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  role: z.enum(USER_ROLES),
  password: PASSWORD_RULE,
});

export async function listUsers(organizationId: string) {
  return db()
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.organizationId, organizationId))
    .orderBy(asc(users.name));
}

export async function addUser(organizationId: string, input: z.infer<typeof newUserSchema>) {
  const [existing] = await db().select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing) throw new Error("A user with that email already exists.");
  await db()
    .insert(users)
    .values({ organizationId, name: input.name, email: input.email, role: input.role, passwordHash: await hashPassword(input.password) });
}

/** Changing a password signs the user out everywhere else. */
export async function changePassword(userId: string, current: string, next: string) {
  const [user] = await db().select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !(await verifyPassword(current, user.passwordHash))) throw new Error("Your current password is incorrect.");
  await db().update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
  await db().delete(userSessions).where(eq(userSessions.userId, userId));
}

export const settingsSchema = z.object({
  name: z.string().trim().min(1, "Studio name is required").max(200),
  recordsEmail: z.union([z.literal(""), z.email("Enter a valid email")]).transform((v) => v || null),
});

export async function getOrganization(organizationId: string) {
  const [org] = await db().select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  return org;
}

export async function updateOrganization(organizationId: string, input: z.infer<typeof settingsSchema>) {
  await db()
    .update(organizations)
    .set({ name: input.name, recordsEmail: input.recordsEmail })
    .where(and(eq(organizations.id, organizationId)));
}
