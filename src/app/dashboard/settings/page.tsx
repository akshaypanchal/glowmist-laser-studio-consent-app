// Settings page: studio name and records email, staff accounts, and changing your password. Owners and admins manage the studio; everyone can change their own password.

import { Card, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { getOrganization, listUsers } from "@/server/users/service";
import { AddUserForm, ChangePasswordForm, StudioForm } from "./settings-forms";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const user = await requireUser();
  const { password } = await searchParams;
  const canManage = user.role === "OWNER" || user.role === "ADMIN";
  const [org, staff] = await Promise.all([getOrganization(user.organizationId), canManage ? listUsers(user.organizationId) : []]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      {canManage && (
        <Card>
          <CardTitle>Studio</CardTitle>
          <StudioForm name={org.name} recordsEmail={org.recordsEmail ?? ""} fallbackEmail={env().STUDIO_RECORDS_EMAIL} />
        </Card>
      )}
      {canManage && (
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
      )}
      <Card>
        <CardTitle>Your password</CardTitle>
        {password === "changed" && <p className="mb-3 text-sm text-emerald-800">Password changed. Other sessions were signed out.</p>}
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
