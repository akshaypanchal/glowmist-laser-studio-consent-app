// Settings for the end-to-end browser tests in tests/e2e. They start the built app against a fresh local database (e2e.db) with a seeded studio owner, so run `npm run build` first.

import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
export const E2E_DB_FILE = "e2e.db";
export const E2E_OWNER = { email: "owner@e2e.test", password: "e2e-owner-password-123" };

const serverEnv = {
  TURSO_DATABASE_URL: `file:${E2E_DB_FILE}`,
  APP_URL: `http://localhost:${PORT}`,
  STORAGE_DRIVER: "database",
  EMAIL_DRIVER: "console",
  STUDIO_RECORDS_EMAIL: "records@e2e.test",
  SEED_OWNER_EMAIL: E2E_OWNER.email,
  SEED_OWNER_PASSWORD: E2E_OWNER.password,
  SEED_OWNER_NAME: "E2E Owner",
};

export default defineConfig({
  testDir: "tests/e2e",
  // Tests share one database and one studio, so run them one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // CI installs its own browser; this sandbox has one at /opt/pw-browsers.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `rm -f ${E2E_DB_FILE} && npm run db:migrate && npm run db:seed && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    env: serverEnv,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
