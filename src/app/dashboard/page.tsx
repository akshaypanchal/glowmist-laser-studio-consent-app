import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";

export default async function DashboardHome() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <Card>
        <p className="mb-4 text-stone-600">
          Add a client, then create a consent form for them. You&apos;ll get a private signing link to share.
        </p>
        <Link href="/dashboard/clients/new" className={buttonClass()}>
          Add a client
        </Link>
      </Card>
    </div>
  );
}
