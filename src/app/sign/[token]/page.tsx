// The client's signing page at /sign/:token. Checks the link on the server, records that it was viewed, and shows the consent form. An invalid or used link shows a friendly message instead.

import type { Metadata } from "next";
import { SigningForm } from "@/components/signing/signing-form";
import { requestContext } from "@/server/http";
import { loadSigningPage, SigningError } from "@/server/signing/complete";
import { allowSigningRequest } from "@/server/signing/http";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consent form · GlowMist Laser Studio",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await requestContext();
  let page;
  try {
    const limit = await allowSigningRequest(token, context.ipAddress, "view");
    if (!limit.allowed) throw new SigningError("REQUEST_INVALID", "Too many attempts. Please wait a few minutes and try again.");
    page = await loadSigningPage(token, context);
  } catch (error) {
    if (!(error instanceof SigningError)) throw error;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-serif text-2xl text-brand-700">GlowMist Laser Studio</h1>
        <p className="text-stone-700">{error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="font-serif text-3xl text-brand-700">{page.content.studio.name}</h1>
        <p className="text-sm text-stone-500">{page.content.studio.address}</p>
        <p className="text-sm text-stone-500">{page.content.studio.email}</p>
        <h2 className="mt-4 text-lg font-semibold tracking-wide uppercase">{page.content.title}</h2>
      </header>
      <p className="mb-6 text-stone-700">
        Hello {page.client.firstName}, please review and complete the form below carefully.
      </p>
      <SigningForm token={token} content={page.content} client={page.client} reference={page.reference} />
    </main>
  );
}
