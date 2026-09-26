import { beforeAll, describe, expect, it } from "vitest";
import { GLOWMIST_CONSENT_V1 } from "@/lib/consent-template";
import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { storage } from "@/server/storage";
import { createTemplate, createTemplateVersion, hashTemplateContent, latestVersion, parseTemplateContent } from "@/server/templates/service";
import { useFreshDatabase } from "./helpers/db";

beforeAll(useFreshDatabase);

describe("database storage driver", () => {
  it("round-trips bytes and deletes", async () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    await storage().upload("a/b.bin", bytes, "application/octet-stream");
    expect(Array.from(await storage().download("a/b.bin"))).toEqual([1, 2, 3, 250]);
    expect(await storage().createSignedUrl("a/b.bin", 60)).toBeNull();
    await storage().delete("a/b.bin");
    await expect(storage().download("a/b.bin")).rejects.toThrow();
  });
});

describe("template versions", () => {
  it("creates numbered immutable versions with content hashes", async () => {
    const [org] = await db().insert(organizations).values({ name: "Studio" }).returning();
    const { template, version } = await createTemplate(org.id, { name: "Consent", content: GLOWMIST_CONSENT_V1 }, null);
    expect(version.version).toBe(1);
    expect(version.contentHash).toBe(hashTemplateContent(GLOWMIST_CONSENT_V1));
    expect(parseTemplateContent(version.content)).toEqual(GLOWMIST_CONSENT_V1);

    const v2 = await createTemplateVersion(template.id, { ...GLOWMIST_CONSENT_V1, title: "Updated" }, null);
    expect(v2.version).toBe(2);
    expect(v2.contentHash).not.toBe(version.contentHash);

    const latest = await latestVersion(org.id, template.id);
    expect(latest.version.id).toBe(v2.id);
    expect(await latestVersion("other-org", template.id)).toBeUndefined();
  });

  it("rejects invalid content", async () => {
    await expect(createTemplateVersion("t", { title: "" }, null)).rejects.toThrow();
  });
});
