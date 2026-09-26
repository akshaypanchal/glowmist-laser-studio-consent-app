import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { listClients } from "@/server/clients/service";

export default async function ClientsPage() {
  const user = await requireUser();
  const clients = await listClients(user.organizationId);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Link href="/dashboard/clients/new" className={buttonClass()}>
          Add client
        </Link>
      </div>
      <Card padded={false} className="overflow-x-auto">
        {clients.length === 0 ? (
          <p className="p-6 text-stone-600">No clients yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/clients/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3">{c.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
