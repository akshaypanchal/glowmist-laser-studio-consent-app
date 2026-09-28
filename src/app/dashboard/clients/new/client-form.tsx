// The add-a-client form.

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClientAction, type FormState } from "../actions";

const FIELDS = [
  { name: "firstName", label: "First name", type: "text", required: true, autoComplete: "given-name" },
  { name: "lastName", label: "Last name", type: "text", required: true, autoComplete: "family-name" },
  { name: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
  { name: "phone", label: "Phone", type: "tel", required: false, autoComplete: "tel" },
  { name: "externalReference", label: "Reference (optional)", type: "text", required: false, autoComplete: "off" },
] as const;

export function ClientForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createClientAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((f) => (
        <div key={f.name}>
          <Label htmlFor={f.name}>{f.label}</Label>
          <Input id={f.name} name={f.name} type={f.type} required={f.required} autoComplete={f.autoComplete} />
          {state.fieldErrors?.[f.name] && <p className="mt-1 text-sm text-red-700">{state.fieldErrors[f.name]![0]}</p>}
        </div>
      ))}
      <div className="sm:col-span-2">
        {state.error && <p className="mb-3 text-sm text-red-700">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save client"}
        </Button>
      </div>
    </form>
  );
}
