// Documents page at /dashboard/documents: every consent form for the studio, filterable by status.

import Link from "next/link";
import { DocumentTable } from "@/components/documents/document-table";
import { STATUS_LABELS } from "@/components/documents/status-badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { requireUser } from "@/server/auth/session";
import { DOCUMENT_STATUSES, type DocumentStatus } from "@/server/db/schema";
import { listDocuments } from "@/server/documents/queries";
import { env } from "@/server/env";

const FILTERS: DocumentStatus[] = ["SENT", "VIEWED", "IN_PROGRESS", "SIGNED", "VOIDED"];

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser();
  const { status } = await searchParams;
  const filter = DOCUMENT_STATUSES.find((s) => s === status);
  const rows = await listDocuments(user.organizationId, { status: filter });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Documents</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {[undefined, ...FILTERS].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/dashboard/documents?status=${s}` : "/dashboard/documents"}
            className={cn(
              "rounded-full border px-3 py-1",
              filter === s ? "border-brand-600 bg-brand-100 text-brand-700" : "border-stone-300 text-stone-600 hover:bg-stone-100",
            )}
          >
            {s ? STATUS_LABELS[s] : "All"}
          </Link>
        ))}
      </div>
      <Card padded={false} className="overflow-x-auto">
        <DocumentTable rows={rows} timeZone={env().STUDIO_TIMEZONE} />
      </Card>
    </div>
  );
}
