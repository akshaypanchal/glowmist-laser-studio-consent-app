// One template: the current version's wording, and (for owners and admins) an editor that saves changes as a new version.

import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { getTemplate } from "@/server/templates/queries";
import { parseTemplateContent } from "@/server/templates/service";
import { VersionEditor } from "./version-editor";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const template = await getTemplate(user.organizationId, id);
  if (!template || template.versions.length === 0) notFound();
  const current = template.versions[0];
  const content = parseTemplateContent(current.content);
  const canEdit = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        {template.name} <span className="text-base font-normal text-stone-500">version {current.version}</span>
      </h1>
      <Card>
        <CardTitle>{content.title}</CardTitle>
        <div className="grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <h3 className="mb-1 font-semibold">Treatments</h3>
            <ul className="list-disc pl-5">{content.treatments.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Medical history</h3>
            <ul className="list-disc pl-5">{content.medicalConditions.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div className="sm:col-span-2">
            <h3 className="mb-1 font-semibold">I understand that</h3>
            <ul className="list-disc pl-5">{content.understandings.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      </Card>
      {canEdit && (
        <Card>
          <CardTitle>Change the wording</CardTitle>
          <p className="mb-3 text-sm text-stone-600">
            Edit the text below and save. This creates version {current.version + 1}. Forms already sent or signed keep the
            version they were created with.
          </p>
          <VersionEditor templateId={template.id} initial={JSON.stringify(content, null, 2)} />
        </Card>
      )}
    </div>
  );
}
