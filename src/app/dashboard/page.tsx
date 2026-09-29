// Dashboard home: counts of forms signed this month, forms awaiting signature and failed emails, plus the most recent forms.

import Link from "next/link";
import { DocumentTable } from "@/components/documents/document-table";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { dashboardSummary } from "@/server/documents/queries";
import { env } from "@/server/env";

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm hover:border-brand-500">
      <p className="text-3xl font-semibold text-stone-900">{value}</p>
      <p className="text-sm text-stone-600">{label}</p>
    </Link>
  );
}

export default async function DashboardHome() {
  const user = await requireUser();
  const summary = await dashboardSummary(user.organizationId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <Link href="/dashboard/clients/new" className={buttonClass()}>
          Add a client
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Signed this month" value={summary.signedThisMonth} href="/dashboard/documents?status=SIGNED" />
        <Stat label="Awaiting signature" value={summary.awaiting} href="/dashboard/documents?status=SENT" />
        <Stat label="Failed emails" value={summary.failedEmails} href="/dashboard/documents" />
      </div>
      <Card padded={false} className="overflow-x-auto">
        <h2 className="px-6 pt-6 pb-2 text-lg font-semibold">Recent consent forms</h2>
        <DocumentTable rows={summary.recent} timeZone={env().STUDIO_TIMEZONE} />
      </Card>
    </div>
  );
}
