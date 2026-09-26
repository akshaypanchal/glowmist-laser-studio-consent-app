// Staff login sessions: sets the session cookie, looks up the signed-in user, and requireUser() protects every dashboard page and action.

import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { db } from "@/server/db";
import { organizations, userSessions, users, type UserRole } from "@/server/db/schema";

const COOKIE_NAME = "gm_session";
const SESSION_HOURS = 12;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
};

function hashSessionToken(token: string) {
  return sha256Hex(`user-session:${token}`);
}

export async function startSession(userId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await db().insert(userSessions).values({ userId, tokenHash: hashSessionToken(token), expiresAt });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await db().delete(userSessions).where(eq(userSessions.tokenHash, hashSessionToken(token)));
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [row] = await db()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      organizationId: users.organizationId,
      organizationName: organizations.name,
    })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .where(and(eq(userSessions.tokenHash, hashSessionToken(token)), gt(userSessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

/**
 * Every dashboard page and server action calls this. Authorization is always
 * checked on the server; hiding a button in the UI is never the only guard.
 */
export async function requireUser(roles?: readonly UserRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) throw new Error("Not allowed");
  return user;
}
