// Shared helpers for the end-to-end tests: signing in as staff, creating a client with a signing link, filling in the consent form, and reaching into the test database for cases a browser can't set up (expired links, a second studio).

import { createClient } from "@libsql/client";
import { expect, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { hashPassword } from "../../src/lib/password";
import { hashSigningToken } from "../../src/lib/signing-token";
import * as schema from "../../src/server/db/schema";
import { E2E_DB_FILE, E2E_OWNER } from "../../playwright.config";

export function testDb() {
  return drizzle(createClient({ url: `file:${E2E_DB_FILE}` }), { schema });
}

export async function signIn(page: Page, user: { email: string; password: string } = E2E_OWNER) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

let clientCount = 0;

/** Adds a client and creates a signing link for them. Returns the link and the client's page URL. */
export async function createClientWithLink(page: Page) {
  clientCount++;
  const email = `client${clientCount}-${Date.now()}@e2e.test`;
  await page.goto("/dashboard/clients/new");
  await page.getByLabel("First name").fill("Jane");
  await page.getByLabel("Last name").fill(`Tester${clientCount}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Save client" }).click();
  await expect(page).toHaveURL(/\/dashboard\/clients\/[0-9a-f-]{36}$/);
  const clientUrl = page.url();

  await page.getByRole("button", { name: "Create signing link" }).click();
  const signingUrl = (await page.getByTestId("signing-url").textContent())!.trim();
  expect(signingUrl).toMatch(/\/sign\/[A-Za-z0-9_-]{43}$/);
  return { signingUrl, clientUrl, email };
}

export function tokenOf(signingUrl: string) {
  return signingUrl.split("/sign/")[1];
}

/** Fills every required field of the GlowMist consent form. */
export async function fillConsentForm(page: Page) {
  await page.getByLabel("Full name").fill("Jane Tester");
  await page.getByLabel("Date of birth").fill("1990-04-12");
  await page.getByLabel("Phone number").fill("905-555-0100");
  await page.getByLabel("Mailing address").fill("1 Main St, Bradford ON");
  await page.getByLabel("Emergency contact", { exact: true }).fill("John Tester");
  await page.getByLabel("Emergency phone").fill("905-555-0199");
  await page.getByLabel("Date of service").fill("2026-09-26");
  await page.locator('input[name="treatments"]').first().check();
  await page.locator('input[name="photography"]').first().check();
}

export async function drawSignature(page: Page) {
  const canvas = page.getByTestId("signature-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  for (let x = 30; x <= 220; x += 10) {
    await page.mouse.move(box.x + x, box.y + box.height / 2 + Math.sin(x / 15) * 20);
  }
  await page.mouse.up();
}

/** Makes a signing link look expired by moving its expiry time into the past. */
export async function expireLink(token: string) {
  const past = new Date(Date.now() - 60_000);
  const db = testDb();
  const [session] = await db
    .update(schema.signingSessions)
    .set({ expiresAt: past })
    .where(eq(schema.signingSessions.tokenHash, hashSigningToken(token)))
    .returning();
  await db.update(schema.consentDocuments).set({ expiresAt: past }).where(eq(schema.consentDocuments.id, session.documentId));
}

/** Creates a second studio with its own owner, to check one studio can't see another's documents. */
export async function createOtherStudio() {
  const db = testDb();
  const [organization] = await db.insert(schema.organizations).values({ name: "Other Studio" }).returning();
  const user = { email: `owner-${Date.now()}@other.test`, password: "other-studio-password-1" };
  await db.insert(schema.users).values({
    organizationId: organization.id,
    name: "Other Owner",
    email: user.email,
    role: "OWNER",
    passwordHash: await hashPassword(user.password),
  });
  return user;
}
