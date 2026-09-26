import "server-only";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/password";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const dummyHash = hashPassword("not-a-real-password");

export async function verifyCredentials(email: string, password: string) {
  const [user] = await db().select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  return ok && user ? user : null;
}
