// Next.js settings for the whole app (build options, HTTP security headers). The Content Security Policy is set per request in src/proxy.ts.

import type { NextConfig } from "next";

const securityHeaders = [
  // Don't let other sites put our pages in a frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Signing links carry a secret token in the URL, so never send it to other sites.
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// Pages and API responses that contain health data or signing links must not be cached.
const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@libsql/client", "libsql"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/sign/:path*", headers: noStore },
      { source: "/dashboard/:path*", headers: noStore },
      { source: "/api/:path*", headers: noStore },
    ];
  },
};

export default nextConfig;
