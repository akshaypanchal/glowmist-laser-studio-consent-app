// Audit Trail page: the studio's 100 most recent audit events across all documents, newest first.

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { AUDIT_EVENT_LABELS, type AuditEventType } from "@/server/audit/events";
import { requireUser } from "@/server/auth/session";
import { recentAuditEvents } from "@/server/documents/queries";
import { env } from "@/server/env";

export default async function AuditPage() {
  const user = await requireUser();
  const rows = await recentAuditEvents(user.organizationId);
  const tz = env().STUDIO_TIMEZONE;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit trail</h1>
        <p className="text-sm text-stone-600">
          The latest 100 events. Open a document to see its full trail and the hash chain check.
        </p>
      </div>
      <Card padded={false} className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">By</th>
              <th className="px-4 py-3 font-medium">IP address</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ event, reference }) => (
              <tr key={event.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(event.timestamp, tz)}</td>
                <td className="px-4 py-2">{AUDIT_EVENT_LABELS[event.eventType as AuditEventType] ?? event.eventType}</td>
                <td className="px-4 py-2 font-mono text-xs">
                  {event.documentId && reference ? (
                    <Link href={`/dashboard/documents/${event.documentId}`} className="text-brand-700 hover:underline">
                      {reference}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">{event.actorType.toLowerCase()}</td>
                <td className="px-4 py-2">{event.ipAddress ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
