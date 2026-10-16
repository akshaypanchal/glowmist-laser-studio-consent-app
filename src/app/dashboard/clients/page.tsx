// Client list at `/dashboard/clients`, with a search box (`?q=`) that filters by name, email, phone or reference.

import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cleanSearch } from "@/lib/list-filters";
import { requireUser } from "@/server/auth/session";
import { listClients } from "@/server/clients/service";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const search = cleanSearch((await searchParams).q);
  const clients = await listClients(user.organizationId, { search });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Link href="/dashboard/clients/new" className={buttonClass()}>
          Add client
        </Link>
      </div>
      <form method="get" role="search" className="flex flex-wrap items-center gap-2">
        <label htmlFor="client-search" className="sr-only">
          Search clients
        </label>
        <Input
          id="client-search"
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search by name, email or phone"
          className="max-w-sm"
        />
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
        {search && (
          <Link href="/dashboard/clients" className={buttonClass("ghost")}>
            Clear
          </Link>
        )}
      </form>
      <Card padded={false} className="overflow-x-auto">
        {clients.length === 0 ? (
          <p className="p-6 text-stone-600">{search ? `No clients match “${search}”.` : "No clients yet."}</p>
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
