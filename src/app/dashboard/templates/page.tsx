// Consent Templates page: each template with its versions. Versions are never edited; changing the wording adds a new version.

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { listTemplatesWithVersions } from "@/server/templates/queries";

export default async function TemplatesPage() {
  const user = await requireUser();
  const templates = await listTemplatesWithVersions(user.organizationId);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Consent templates</h1>
      {templates.map((t) => (
        <Card key={t.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link href={`/dashboard/templates/${t.id}`} className="text-lg font-semibold text-brand-700 hover:underline">
                {t.name}
              </Link>
              {t.description && <p className="text-sm text-stone-600">{t.description}</p>}
            </div>
            <span className="text-sm text-stone-500">{t.status.toLowerCase()}</span>
          </div>
          <ul className="mt-3 text-sm text-stone-700">
            {t.versions.map((v, i) => (
              <li key={v.id}>
                Version {v.version}
                {i === 0 ? " (current)" : ""} · {formatDate(v.createdAt, env().STUDIO_TIMEZONE)} ·{" "}
                <code className="text-xs text-stone-500">{v.contentHash.slice(0, 16)}…</code>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
