// End-to-end tests of the main journey: staff create a signing link, the client signs on a phone, and the studio sees the signed PDF. Also checks a signing link can't be used twice and that expired or replaced links are refused.

import { devices, expect, test } from "@playwright/test";
import { createClientWithLink, drawSignature, expireLink, fillConsentForm, signIn, tokenOf } from "./helpers";

test("client signs on a phone and the studio gets the signed PDF", async ({ page, browser }) => {
  await signIn(page);
  const { signingUrl, clientUrl } = await createClientWithLink(page);

  // The client opens the link on their phone, with no staff login.
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 13"];
  const phone = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
  const client = await phone.newPage();
  await client.goto(signingUrl);
  await expect(client.getByRole("heading", { name: "GlowMist Laser Studio" })).toBeVisible();
  await fillConsentForm(client);

  const submit = client.getByRole("button", { name: "Sign & Submit" });
  await expect(submit).toBeDisabled();
  await client.locator('input[name="consentAccepted"]').check();
  await client.getByLabel("Client name (print)").fill("Jane Tester");
  await drawSignature(client);
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(client.getByText("Thank you, your consent form is signed.")).toBeVisible();
  const reference = await client.locator("span.font-mono").textContent();
  expect(reference).toMatch(/^DOC-[A-Z0-9]{8}$/);

  // Opening the link again is refused.
  await client.goto(signingUrl);
  await expect(client.getByText("This form has already been signed.")).toBeVisible();
  await phone.close();

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
  await expect(page.getByText("This signing link has expired.")).toBeVisible();

  const response = await request.post(`/api/signing/${tokenOf(signingUrl)}/consent`);
  expect(response.status()).toBe(410);
  expect((await response.json()).error).toBe("EXPIRED");
});

test("a replaced link stops working when staff create a new one", async ({ page }) => {
  await signIn(page);
  const { signingUrl, clientUrl } = await createClientWithLink(page);

  await page.goto(clientUrl);
  await page.getByRole("button", { name: "New link" }).click();
  const newUrl = (await page.getByTestId("signing-url").last().textContent())!.trim();
  expect(newUrl).not.toBe(signingUrl);

  await page.goto(signingUrl);
  await expect(page.getByText("This signing link has been replaced.")).toBeVisible();
  await page.goto(newUrl);
  await expect(page.getByRole("button", { name: "Sign & Submit" })).toBeVisible();
});
