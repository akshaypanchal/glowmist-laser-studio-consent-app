import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlowMist Laser Studio",
  description: "Treatment consent forms for GlowMist Laser Studio",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
