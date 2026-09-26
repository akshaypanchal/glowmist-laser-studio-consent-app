import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { resetDbCache } from "@/server/db";
import { resetEnvCache } from "@/server/env";
import { setStorage } from "@/server/storage";

/** Points the app at a fresh, migrated SQLite file for one test file. */
export async function useFreshDatabase() {
  const dir = mkdtempSync(path.join(tmpdir(), "glowmist-test-"));
  const url = `file:${path.join(dir, "test.db")}`;
  const client = createClient({ url });
  await migrate(drizzle(client), { migrationsFolder: path.resolve(__dirname, "../../../drizzle") });
  client.close();

  process.env.TURSO_DATABASE_URL = url;
  delete process.env.TURSO_AUTH_TOKEN;
  process.env.STORAGE_DRIVER = "database";
  process.env.EMAIL_DRIVER = "console";
  resetEnvCache();
  resetDbCache();
  setStorage(undefined);
}
