// Home page at `/`. Clients fill in their form at the studio; this page just points staff to sign in.

import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-serif text-3xl text-brand-700">GlowMist Laser Studio</h1>
      <p className="text-stone-600">
        Treatment consent forms are completed at the studio. Studio staff can sign in to manage clients and consent
        forms.
      </p>
      <Link href="/login" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        Staff sign in
      </Link>
    </main>
  );
}
