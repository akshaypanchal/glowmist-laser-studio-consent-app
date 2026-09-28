// Buttons on a client's page that open a consent form on this device (a new one, or an unsigned one to continue) so the client can fill it in and sign at the studio.

"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { continueConsentAction, startConsentAction } from "../actions";

function SubmitButton({ label, variant }: { label: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Opening…" : label}
    </Button>
  );
}

export function StartConsentForm({ clientId, templates }: { clientId: string; templates: { id: string; name: string }[] }) {
  return (
    <form action={startConsentAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <Label htmlFor="templateId">Consent form</Label>
      <div className="flex flex-wrap gap-2">
        <select
          id="templateId"
          name="templateId"
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          defaultValue={templates[0]?.id}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {templates.length > 0 && <SubmitButton label="Start consent form" />}
      </div>
      <p className="mt-3 text-sm text-stone-600">
        The form opens on this screen. Fill it in with the client or hand them the device to complete and sign.
      </p>
    </form>
  );
}

export function ContinueConsentForm({ documentId }: { documentId: string }) {
  return (
    <form action={continueConsentAction}>
      <input type="hidden" name="documentId" value={documentId} />
      <SubmitButton label="Continue" variant="secondary" />
    </form>
  );
}
