// Frame around every dashboard page: studio name, section tabs and the signed-in user's menu (Settings lives there, for the owner only). Redirects to /login if not signed in.

import { DashboardNav } from "@/components/dashboard/nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { canOpenSettings, requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/documents", label: "Documents" },
  { href: "/dashboard/templates", label: "Templates" },
  { href: "/dashboard/audit", label: "Audit trail" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-serif text-lg text-brand-700">{user.organizationName}</span>
            <DashboardNav items={NAV} />
          </div>
          <UserMenu name={user.name} role={user.role} showSettings={canOpenSettings(user.role)} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
