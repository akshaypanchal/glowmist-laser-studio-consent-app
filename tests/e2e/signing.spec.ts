// End-to-end tests of the main journey: staff start a consent form on the studio iPad, the client fills it in and signs, and the studio sees the signed PDF. Also checks a form can't be signed twice and that expired or reopened sessions are refused.

import { devices, expect, test } from "@playwright/test";
import { createClientWithLink, drawSignature, expireLink, fillConsentForm, signIn, tokenOf } from "./helpers";

test("client signs on the studio iPad and the studio gets the signed PDF", async ({ browser }) => {
  // Staff sign in on the iPad and start the form; it opens on the same screen.
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPad (gen 7)"];
  const ipad = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
  const page = await ipad.newPage();
  await signIn(page);
  const { signingUrl, clientUrl } = await createClientWithLink(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/sign\//);
  expect(page.url()).not.toBe(signingUrl);

  // The client fills it in and signs.
  await expect(page.getByRole("heading", { name: "GlowMist Laser Studio" })).toBeVisible();
  await fillConsentForm(page);
  const submit = page.getByRole("button", { name: "Sign & Submit" });
  await expect(submit).toBeDisabled();
  await page.locator('input[name="consentAccepted"]').check();
  await page.getByLabel("Client name (print)").fill("Jane Tester");
  await drawSignature(page);
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText("Thank you, your consent form is signed.")).toBeVisible();
  await expect(page.getByText("Please hand the device back to the studio.")).toBeVisible();
  const reference = await page.locator("span.font-mono").textContent();
  expect(reference).toMatch(/^DOC-[A-Z0-9]{8}$/);
  const formUrl = page.url();

  // Staff take the iPad back and return to the client's page.
  await page.getByRole("link", { name: "Studio staff: back to the dashboard" }).click();
  await expect(page).toHaveURL(clientUrl);

  // Opening the form again is refused.
  await page.goto(formUrl);
  await expect(page.getByText("This form has already been signed.")).toBeVisible();

  // The studio sees the signed document and can download the PDF.
  await page.goto(clientUrl);
  await page.getByRole("link", { name: reference! }).click();
  await expect(page.getByText("Signed", { exact: true }).first()).toBeVisible();
  const downloadHref = await page.getByRole("link", { name: "Download PDF" }).getAttribute("href");
  const pdf = await page.request.get(downloadHref!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // The audit trail recorded the signature.
  await page.goto("/dashboard/audit");
  await expect(page.getByText(reference!).first()).toBeVisible();
  await ipad.close();
});

test("a used link can't be submitted a second time through the API", async ({ page, request }) => {
  await signIn(page);
  const { signingUrl } = await createClientWithLink(page);
  const token = tokenOf(signingUrl);

  const client = await page.context().browser()!.newPage();
  await client.goto(signingUrl);
  await fillConsentForm(client);
  await client.locator('input[name="consentAccepted"]').check();
  await client.getByLabel("Client name (print)").fill("Jane Tester");
  await drawSignature(client);
  await client.getByRole("button", { name: "Sign & Submit" }).click();
  await expect(client.getByText("Thank you, your consent form is signed.")).toBeVisible();

  const replay = await request.post(`/api/signing/${token}/complete`, {
    data: { consentAccepted: true, signature: "data:image/png;base64,AAAA", signerName: "X", answers: {} },
  });
  expect(replay.status()).toBe(409);
  expect((await replay.json()).error).toBe("USED");
});

test("an expired link is refused", async ({ page, request }) => {
  await signIn(page);
  const { signingUrl } = await createClientWithLink(page);
  await expireLink(tokenOf(signingUrl));

  await page.goto(signingUrl);
  await expect(page.getByText("This form has expired.")).toBeVisible();

  const response = await request.post(`/api/signing/${tokenOf(signingUrl)}/consent`);
  expect(response.status()).toBe(410);
  expect((await response.json()).error).toBe("EXPIRED");
});

test("continuing a form closes the earlier session", async ({ page }) => {
  await signIn(page);
  const { signingUrl, clientUrl } = await createClientWithLink(page);

  await page.goto(clientUrl);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/sign\//);
  const newUrl = page.url();
  expect(newUrl).not.toBe(signingUrl);

  await page.goto(signingUrl);
  await expect(page.getByText("This form was reopened on another screen.")).toBeVisible();
  await page.goto(newUrl);
  await expect(page.getByRole("button", { name: "Sign & Submit" })).toBeVisible();
});

test("the client page no longer offers to email a link", async ({ page }) => {
  await signIn(page);
  const { clientUrl } = await createClientWithLink(page);
  await page.goto(clientUrl);
  await expect(page.getByText("Email the link to the client")).toHaveCount(0);
  await expect(page.getByTestId("signing-url")).toHaveCount(0);
});
