// Settings page: studio name and records email, staff accounts, and changing your password. Only the studio owner can open it; anyone else is sent back to the dashboard.

import { Card, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/server/auth/session";
import { env } from "@/server/env";
import { getOrganization, listUsers } from "@/server/users/service";
import { AddUserForm, ChangePasswordForm, StudioForm } from "./settings-forms";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const user = await requireOwner();
  const { password } = await searchParams;
  const [org, staff] = await Promise.all([getOrganization(user.organizationId), listUsers(user.organizationId)]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardTitle>Studio</CardTitle>
        <StudioForm name={org.name} recordsEmail={org.recordsEmail ?? ""} fallbackEmail={env().STUDIO_RECORDS_EMAIL} />
      </Card>
      <Card>
          <CardTitle>Staff</CardTitle>
          <ul className="mb-6 divide-y divide-stone-100 text-sm">
            {staff.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {s.name} · {s.email}
                </span>
                <span className="text-stone-500">{s.role.toLowerCase()}</span>
              </li>
            ))}
          </ul>
          <h3 className="mb-3 text-sm font-semibold">Add a staff member</h3>
          <AddUserForm canAddOwner={user.role === "OWNER"} />
      </Card>
      <Card>
        <CardTitle>Your password</CardTitle>
        {password === "changed" && <p className="mb-3 text-sm text-emerald-800">Password changed. Other sessions were signed out.</p>}
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
