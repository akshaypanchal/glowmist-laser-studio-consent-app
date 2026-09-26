// Picks the file storage (R2 or database) from STORAGE_DRIVER. The rest of the app only calls storage().

import "server-only";
import { env } from "@/server/env";
import { DatabaseStorageService } from "./database";
import { R2StorageService } from "./r2";
import type { StorageService } from "./types";

let instance: StorageService | undefined;

export function storage(): StorageService {
  if (!instance) {
    const config = env();
    instance =
      config.STORAGE_DRIVER === "r2"
        ? new R2StorageService(config.R2_ACCOUNT_ID!, config.R2_ACCESS_KEY_ID!, config.R2_SECRET_ACCESS_KEY!, config.R2_BUCKET!)
        : new DatabaseStorageService();
  }
  return instance;
}

/** Test helper. */
export function setStorage(service: StorageService | undefined) {
  instance = service;
}

export { storageKeys, type StorageService } from "./types";
