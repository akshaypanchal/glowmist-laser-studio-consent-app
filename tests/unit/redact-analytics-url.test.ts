// Checks that URLs sent to Vercel Analytics never contain signing tokens, query strings or hashes.

import { describe, expect, it } from "vitest";
import { redactAnalyticsUrl } from "@/lib/redact-analytics-url";

describe("redactAnalyticsUrl", () => {
  it("replaces the signing token", () => {
    expect(redactAnalyticsUrl("https://app.example/sign/s3cr3tT0ken")).toBe("https://app.example/sign/[token]");
  });

  it("drops query strings and hashes", () => {
    expect(redactAnalyticsUrl("https://app.example/dashboard/clients?q=Jane%20Doe#top")).toBe(
      "https://app.example/dashboard/clients",
    );
  });

  it("leaves other paths alone", () => {
    expect(redactAnalyticsUrl("https://app.example/dashboard/documents")).toBe("https://app.example/dashboard/documents");
    expect(redactAnalyticsUrl("https://app.example/signup")).toBe("https://app.example/signup");
  });
});
