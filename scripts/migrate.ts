// Applies the SQL migrations in /drizzle to the database in TURSO_DATABASE_URL. Run with `npm run db:migrate`.

import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
console.log("Database migrations applied.");
client.close();
