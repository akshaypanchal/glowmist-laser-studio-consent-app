// End-to-end security checks: bad or missing signing tokens, submissions without consent or a signature, staff-only pages and downloads, one studio reaching another's documents, and the HTTP security headers.

import { expect, test } from "@playwright/test";
import { createClientWithLink, createOtherStudio, signIn, tokenOf } from "./helpers";

const FAKE_TOKEN = "A".repeat(43);

test("an unknown or malformed signing link shows a friendly error", async ({ page, request }) => {
  for (const token of [FAKE_TOKEN, "not-a-token"]) {
    await page.goto(`/sign/${token}`);
    await expect(page.getByText("This signing link is not valid.")).toBeVisible();
    const response = await request.post(`/api/signing/${token}/complete`, { data: {} });
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  }
});

test("the server refuses a submission without e-signature consent or a signature", async ({ page, request }) => {
  await signIn(page);
  const { signingUrl } = await createClientWithLink(page);
  const token = tokenOf(signingUrl);

  const noConsent = await request.post(`/api/signing/${token}/complete`, {
    data: { consentAccepted: false, signature: "data:image/png;base64,AAAA", signerName: "Jane", answers: {} },
  });
  expect(noConsent.status()).toBe(400);
  expect((await noConsent.json()).error).toBe("CONSENT_REQUIRED");

  const noSignature = await request.post(`/api/signing/${token}/complete`, {
    data: { consentAccepted: true, signature: "data:image/png;base64,bm90IGEgcG5n", signerName: "Jane", answers: {} },
  });
  expect(noSignature.status()).toBe(400);
  expect((await noSignature.json()).error).toBe("SIGNATURE_INVALID");

  // Neither attempt used up the link.
  await page.goto(signingUrl);
  await expect(page.getByRole("button", { name: "Sign & Submit" })).toBeVisible();
});

test("staff pages and downloads need a login", async ({ page, request }) => {
  await page.goto("/dashboard/documents");
  await expect(page).toHaveURL(/\/login$/);

  const download = await request.get(`/api/documents/${crypto.randomUUID()}/download`, { maxRedirects: 0 });
  expect(download.status()).toBe(401);
});

test("one studio can't open another studio's documents", async ({ page, browser }) => {
  await signIn(page);
  const { clientUrl } = await createClientWithLink(page);
  await page.goto(clientUrl);
  const documentHref = await page.locator('a[href^="/dashboard/documents/"]').first().getAttribute("href");
  const documentId = documentHref!.split("/").pop()!;

  const other = await createOtherStudio();
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await signIn(otherPage, other);

  const detail = await otherPage.goto(`/dashboard/documents/${documentId}`);
  expect(detail!.status()).toBe(404);
  const clientPage = await otherPage.goto(clientUrl);
  expect(clientPage!.status()).toBe(404);
  const download = await otherPage.request.get(`/api/documents/${documentId}/download`, { maxRedirects: 0 });
  expect(download.status()).toBe(404);
  await otherContext.close();
});

test("pages send security headers", async ({ request }) => {
  for (const path of ["/login", `/sign/${FAKE_TOKEN}`]) {
    const response = await request.get(path);
    const headers = response.headers();
    expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["x-powered-by"]).toBeUndefined();
  }
  const signing = await request.get(`/sign/${FAKE_TOKEN}`);
  expect(signing.headers()["cache-control"]).toContain("no-store");
});
