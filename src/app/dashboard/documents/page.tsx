// Documents page at /dashboard/documents: every consent form for the studio, filterable by status, search text (`?q=`) and a date range (`?from=` / `?to=`, as YYYY-MM-DD in the studio's time zone).

import Link from "next/link";
import { DocumentTable } from "@/components/documents/document-table";
import { STATUS_LABELS } from "@/components/documents/status-badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { cleanDay, cleanSearch, studioDayRange } from "@/lib/list-filters";
import { requireUser } from "@/server/auth/session";
import { DOCUMENT_STATUSES, type DocumentStatus } from "@/server/db/schema";
import { listDocuments } from "@/server/documents/queries";
import { env } from "@/server/env";

const FILTERS: DocumentStatus[] = ["SENT", "VIEWED", "IN_PROGRESS", "SIGNED", "VOIDED"];

type Filters = { status?: DocumentStatus; q?: string; from?: string; to?: string };

/** Builds a Documents page link that keeps the current filters, with any given ones changed. */
function documentsHref(filters: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/dashboard/documents?${query}` : "/dashboard/documents";
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const timeZone = env().STUDIO_TIMEZONE;
  const status = DOCUMENT_STATUSES.find((s) => s === params.status);
  const search = cleanSearch(params.q);
  let fromDay = cleanDay(params.from);
  let toDay = cleanDay(params.to);
  // A range picked backwards (From after To) is treated as the same range the right way round.
  if (fromDay && toDay && fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
  const filters: Filters = { status, q: search, from: fromDay, to: toDay };
  const rows = await listDocuments(user.organizationId, {
    status,
    search,
    ...studioDayRange(fromDay, toDay, timeZone),
  });
  const narrowed = Boolean(search || fromDay || toDay);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Documents</h1>
      <form method="get" role="search" className="flex flex-wrap items-end gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="w-full sm:w-72">
          <label htmlFor="document-search" className="mb-1 block text-sm font-medium text-stone-700">
            Search
          </label>
          <Input
            id="document-search"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Client, email, form or reference"
          />
        </div>
        <div>
          <label htmlFor="document-from" className="mb-1 block text-sm font-medium text-stone-700">
            From
          </label>
          <Input id="document-from" type="date" name="from" defaultValue={fromDay} max={toDay} />
        </div>
        <div>
          <label htmlFor="document-to" className="mb-1 block text-sm font-medium text-stone-700">
            To
          </label>
          <Input id="document-to" type="date" name="to" defaultValue={toDay} min={fromDay} />
        </div>
        <button type="submit" className={buttonClass("secondary")}>
          Apply
        </button>
        {narrowed && (
          <Link href={documentsHref({ status })} className={buttonClass("ghost")}>
            Clear
          </Link>
        )}
      </form>
      <p className="-mt-3 text-xs text-stone-500">Dates are the signed date, or the sent date for forms not signed yet.</p>
      <div className="flex flex-wrap gap-2 text-sm">
        {[undefined, ...FILTERS].map((s) => (
          <Link
            key={s ?? "all"}
            href={documentsHref({ ...filters, status: s })}
            className={cn(
              "rounded-full border px-3 py-1",
              status === s ? "border-brand-600 bg-brand-100 text-brand-700" : "border-stone-300 text-stone-600 hover:bg-stone-100",
            )}
          >
            {s ? STATUS_LABELS[s] : "All"}
          </Link>
        ))}
      </div>
      <Card padded={false} className="overflow-x-auto">
        <DocumentTable
          rows={rows}
          timeZone={timeZone}
          emptyMessage={narrowed || status ? "No documents match these filters." : "No documents yet."}
        />
      </Card>
    </div>
  );
}
