// Root HTML layout shared by every page (public signing pages and the staff dashboard).

import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlowMist Laser Studio",
  description: "Treatment consent forms for GlowMist Laser Studio",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render every page per request so each one gets its own CSP nonce (see src/proxy.ts).
  await connection();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
