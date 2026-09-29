// Tests the database rate limiter.

import { beforeAll, describe, expect, it } from "vitest";
import { hit, hitAll } from "@/server/rate-limit";
import { useFreshDatabase } from "./helpers/db";

beforeAll(useFreshDatabase);

describe("rate limiting", () => {
  it("allows up to the limit, then blocks", async () => {
    const rule = { limit: 3, windowSeconds: 600 };
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await hit("test-key", rule)).allowed);
    expect(results).toEqual([true, true, true, false, false]);
    expect((await hit("other-key", rule)).allowed).toBe(true);
  });

  it("counts concurrent requests correctly", async () => {
    const rule = { limit: 10, windowSeconds: 600 };
    const results = await Promise.all(Array.from({ length: 15 }, () => hit("burst", rule)));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
  });

  it("blocks when any of several limits is exceeded", async () => {
    const tight = { limit: 1, windowSeconds: 600 };
    const loose = { limit: 100, windowSeconds: 600 };
    await hit("tight", tight);
    const result = await hitAll([{ key: "loose", rule: loose }, { key: "tight", rule: tight }]);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});
