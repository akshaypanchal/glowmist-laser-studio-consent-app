// Buttons on the document page (check PDF, retry emails, void) that show the result of each action inline.

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { retryEmailsAction, verifyPdfAction, voidDocumentAction, type ActionState } from "./actions";

function Result({ state }: { state: ActionState }) {
  if (state.error) return <p className="mt-2 text-sm text-red-700">{state.error}</p>;
  if (state.message) return <p className="mt-2 text-sm text-emerald-800">{state.message}</p>;
  return null;
}

export function VerifyPdfButton({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(verifyPdfAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="documentId" value={documentId} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Checking…" : "Check PDF integrity"}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function RetryEmailsButton({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(retryEmailsAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="documentId" value={documentId} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Retry failed emails"}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function VoidDocumentForm({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(voidDocumentAction, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Void this document? It will be marked as no longer valid. This can't be undone.")) e.preventDefault();
      }}
      className="flex flex-wrap items-start gap-2"
    >
      <input type="hidden" name="documentId" value={documentId} />
      <Input name="reason" placeholder="Reason for voiding" className="max-w-xs" required />
      <Button type="submit" variant="danger" disabled={pending}>
        Void document
      </Button>
      <div className="w-full">
        <Result state={state} />
      </div>
    </form>
  );
}
