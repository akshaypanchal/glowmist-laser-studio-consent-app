import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Staff sign in · GlowMist Laser Studio" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-center font-serif text-2xl text-brand-700">GlowMist staff sign in</h1>
      <Card>
        <LoginForm />
      </Card>
    </main>
  );
}
