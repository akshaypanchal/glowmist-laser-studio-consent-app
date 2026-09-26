// Table of consent documents (client, form, status, date) used on the dashboard home and the Documents page.

import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { DocumentStatus } from "@/server/db/schema";
import { StatusBadge } from "./status-badge";

export type DocumentRow = {
  id: string;
  reference: string;
  status: DocumentStatus;
  createdAt: Date;
  completedAt: Date | null;
  clientName: string;
  clientLastName: string;
  templateName: string;
};

export function DocumentTable({ rows, timeZone }: { rows: DocumentRow[]; timeZone: string }) {
  if (rows.length === 0) return <p className="p-6 text-stone-600">No documents yet.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
        <tr>
          <th className="px-4 py-3 font-medium">Client</th>
          <th className="px-4 py-3 font-medium">Document</th>
          <th className="px-4 py-3 font-medium">Status</th>
          <th className="px-4 py-3 font-medium">Date</th>
          <th className="px-4 py-3 font-medium">Reference</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
            <td className="px-4 py-3">
              <Link href={`/dashboard/documents/${d.id}`} className="font-medium text-brand-700 hover:underline">
                {d.clientName} {d.clientLastName}
              </Link>
            </td>
            <td className="px-4 py-3">{d.templateName}</td>
            <td className="px-4 py-3">
              <StatusBadge status={d.status} />
            </td>
            <td className="px-4 py-3">{formatDate(d.completedAt ?? d.createdAt, timeZone)}</td>
            <td className="px-4 py-3 font-mono text-xs">{d.reference}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
