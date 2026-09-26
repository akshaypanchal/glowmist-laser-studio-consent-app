// A client's page: their details, their consent forms and a button to create a new one.

import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/documents/status-badge";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getClient } from "@/server/clients/service";
import { SIGNABLE_STATUSES } from "@/server/documents/status";
import { listClientDocuments } from "@/server/documents/service";
import { listActiveTemplates } from "@/server/templates/queries";
import { CreateConsentForm, ReissueLinkForm } from "./signing-link-forms";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const client = await getClient(user.organizationId, id);
  if (!client) notFound();

  const [documents, templates] = await Promise.all([
    listClientDocuments(user.organizationId, client.id),
    listActiveTemplates(user.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {client.firstName} {client.lastName}
        </h1>
        <p className="text-stone-600">
          {client.email}
          {client.phone ? ` · ${client.phone}` : ""}
        </p>
      </div>

      <Card>
        <CardTitle>New consent form</CardTitle>
        <CreateConsentForm clientId={client.id} templates={templates.map((t) => ({ id: t.id, name: t.name }))} />
      </Card>

      <Card padded={false} className="overflow-x-auto">
        <h2 className="px-6 pt-6 pb-2 text-lg font-semibold">Consent forms</h2>
        {documents.length === 0 ? (
          <p className="px-6 pb-6 text-stone-600">None yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-y border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Form</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b border-stone-100 align-top last:border-0">
                  <td className="px-4 py-3 font-mono">
                    <Link href={`/dashboard/documents/${d.id}`} className="text-brand-700 hover:underline">
                      {d.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{d.templateName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3">{formatDateTime(d.createdAt)}</td>
                  <td className="px-4 py-3">{SIGNABLE_STATUSES.includes(d.status) && <ReissueLinkForm documentId={d.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
