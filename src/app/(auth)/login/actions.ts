// Server action behind the staff sign-in form.

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { startSession } from "@/server/auth/session";
import { verifyCredentials } from "@/server/auth/login";
import { requestContext } from "@/server/http";
import { hitAll, LIMITS } from "@/server/rate-limit";

const schema = z.object({ email: z.string().trim().min(1).max(254), password: z.string().min(1).max(200) });

export type LoginState = { error?: string };

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };

  // Slow down password guessing: per IP address and per account.
  const { ipAddress } = await requestContext();
  const limit = await hitAll([
    { key: `login-ip:${ipAddress ?? "unknown"}`, rule: LIMITS.loginPerIp },
    { key: `login-email:${parsed.data.email.toLowerCase()}`, rule: LIMITS.loginPerEmail },
  ]);
  if (!limit.allowed) return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) return { error: "That email and password don't match." };

  await startSession(user.id);
  redirect("/dashboard");
}
