// Buttons that create a signing link or a replacement link and show it once with a Copy button.

"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { createConsentAction, reissueLinkAction, type LinkState } from "../actions";

function LinkResult({ state }: { state: LinkState }) {
  const [copied, setCopied] = useState(false);
  if (state.error) return <p className="mt-3 text-sm text-red-700">{state.error}</p>;
  if (!state.signingUrl) return null;
  return (
    <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <p className="mb-2 font-medium text-emerald-900">
        {state.reference}: signing link ready. It is shown only once, so copy it now if you need it.
      </p>
      {state.emailed === true && <p className="mb-2 text-emerald-900">The link was emailed to the client.</p>}
      {state.emailed === false && (
        <p className="mb-2 text-amber-800">The email could not be sent. Copy the link and send it to the client yourself.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 rounded bg-white px-2 py-1 break-all" data-testid="signing-url">
          {state.signingUrl}
        </code>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(state.signingUrl!);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}

export function CreateConsentForm({ clientId, templates }: { clientId: string; templates: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(createConsentAction, {});
  return (
    <form action={action}>
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
        <Button type="submit" disabled={pending || templates.length === 0}>
          {pending ? "Creating…" : "Create signing link"}
        </Button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" name="sendEmail" defaultChecked className="h-4 w-4 accent-brand-600" />
        Email the link to the client
      </label>
      <LinkResult state={state} />
    </form>
  );
}

export function ReissueLinkForm({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(reissueLinkAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="sendEmail" value="on" />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Creating…" : "New link"}
      </Button>
      <LinkResult state={state} />
    </form>
  );
}
