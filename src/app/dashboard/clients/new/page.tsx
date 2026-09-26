// Add-a-client page.

import { Card, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { ClientForm } from "./client-form";

export default async function NewClientPage() {
  await requireUser();
  return (
    <Card className="max-w-2xl">
      <CardTitle>Add a client</CardTitle>
      <ClientForm />
    </Card>
  );
}
