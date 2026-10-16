// Strips secrets from a page URL before it is sent to Vercel Analytics: the signing token in /sign/<token>, query strings and hashes.

// Turns "https://host/sign/abc123?x=1" into "https://host/sign/[token]".
export function redactAnalyticsUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.pathname = url.pathname.replace(/^\/sign\/[^/]+/, "/sign/[token]");
  url.search = "";
  url.hash = "";
  return url.toString();
}
