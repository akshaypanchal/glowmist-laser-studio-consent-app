// Opens the Turso/libSQL database connection used by all server code.

import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { env } from "@/server/env";
import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;

let client: Client | undefined;
let database: Database | undefined;

export function db(): Database {
  if (!database) {
    const config = env();
    client = createClient({ url: config.TURSO_DATABASE_URL, authToken: config.TURSO_AUTH_TOKEN });
    database = drizzle(client, { schema });
  }
  return database;
}

/** Test helper: drop the cached connection so a new TURSO_DATABASE_URL takes effect. */
export function resetDbCache() {
  client?.close();
  client = undefined;
  database = undefined;
}

export { schema };
