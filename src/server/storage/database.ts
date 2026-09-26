// File storage that keeps PDFs and signatures inside the Turso database. Default for the free setup.

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { storedBlobs } from "@/server/db/schema";
import type { StorageService } from "./types";

/**
 * Keeps files in the Turso database as base64. A signed consent PDF is roughly
 * 50-150 KB, so a single studio stays far inside Turso's free storage. Switch
 * STORAGE_DRIVER to r2 when volume grows.
 */
export class DatabaseStorageService implements StorageService {
  async upload(key: string, data: Uint8Array, contentType: string) {
    const row = { key, contentType, data: Buffer.from(data).toString("base64") };
    await db().insert(storedBlobs).values(row).onConflictDoUpdate({ target: storedBlobs.key, set: row });
  }

  async download(key: string) {
    const [row] = await db().select().from(storedBlobs).where(eq(storedBlobs.key, key)).limit(1);
    if (!row) throw new Error(`Storage object not found: ${key}`);
    return new Uint8Array(Buffer.from(row.data, "base64"));
  }

  async delete(key: string) {
    await db().delete(storedBlobs).where(eq(storedBlobs.key, key));
  }

  async createSignedUrl() {
    return null;
  }
}
