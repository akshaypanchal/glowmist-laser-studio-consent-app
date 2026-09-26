// Editor for creating a new template version from the current wording (as JSON).

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { createVersionAction, type VersionState } from "../actions";

export function VersionEditor({ templateId, initial }: { templateId: string; initial: string }) {
  const [state, action, pending] = useActionState<VersionState, FormData>(createVersionAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="templateId" value={templateId} />
      <Textarea name="content" rows={24} defaultValue={initial} className="font-mono text-xs" spellCheck={false} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          Save as new version
        </Button>
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state.message && <p className="text-sm text-emerald-800">{state.message}</p>}
      </div>
    </form>
  );
}
