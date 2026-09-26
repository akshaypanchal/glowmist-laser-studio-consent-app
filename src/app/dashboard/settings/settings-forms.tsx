// The three forms on the Settings page (studio details, add staff, change password).

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { addUserAction, changePasswordAction, saveStudioAction, type SettingsState } from "./actions";

function Result({ state }: { state: SettingsState }) {
  if (state.error) return <p className="text-sm text-red-700">{state.error}</p>;
  if (state.message) return <p className="text-sm text-emerald-800">{state.message}</p>;
  return null;
}

export function StudioForm({ name, recordsEmail, fallbackEmail }: { name: string; recordsEmail: string; fallbackEmail?: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveStudioAction, {});
  return (
    <form action={action} className="grid gap-4 sm:max-w-md">
      <div>
        <Label htmlFor="name">Studio name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div>
        <Label htmlFor="recordsEmail">Records email</Label>
        <Input id="recordsEmail" name="recordsEmail" type="email" defaultValue={recordsEmail} placeholder={fallbackEmail} />
        <p className="mt-1 text-xs text-stone-500">Every signed consent PDF is emailed here.</p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Save
        </Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function AddUserForm({ canAddOwner }: { canAddOwner: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(addUserAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="newName">Name</Label>
        <Input id="newName" name="name" required />
      </div>
      <div>
        <Label htmlFor="newEmail">Email</Label>
        <Input id="newEmail" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <select id="role" name="role" defaultValue="STAFF" className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
          {canAddOwner && <option value="OWNER">Owner</option>}
        </select>
      </div>
      <div>
        <Label htmlFor="tempPassword">Temporary password</Label>
        <Input id="tempPassword" name="password" type="text" minLength={12} autoComplete="off" required />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Add user
        </Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="grid gap-4 sm:max-w-md">
      <div>
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} required />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Change password
        </Button>
        <Result state={state} />
      </div>
    </form>
  );
}
