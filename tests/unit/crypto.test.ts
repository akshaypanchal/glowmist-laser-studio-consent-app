// Tests hashing, signing tokens and password hashing.

import { describe, expect, it } from "vitest";
import { canonicalJson, documentReference, safeEqualHex, sha256Hex } from "@/lib/crypto";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSigningToken, hashSigningToken, isWellFormedSigningToken } from "@/lib/signing-token";

describe("crypto utilities", () => {
  it("hashes with SHA-256", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("produces the same canonical JSON regardless of key order", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: [2, { y: 2, z: 1 }] }, b: 1 }),
    );
  });

  it("compares hex digests", () => {
    expect(safeEqualHex(sha256Hex("a"), sha256Hex("a"))).toBe(true);
    expect(safeEqualHex(sha256Hex("a"), sha256Hex("b"))).toBe(false);
  });

  it("creates readable document references", () => {
    expect(documentReference()).toMatch(/^DOC-[2-9A-HJ-NP-Z]{8}$/);
  });
});

describe("signing tokens", () => {
  it("are random, well formed and stored only as a hash", () => {
    const a = createSigningToken();
    const b = createSigningToken();
    expect(a.token).not.toBe(b.token);
    expect(isWellFormedSigningToken(a.token)).toBe(true);
    expect(a.tokenHash).toBe(hashSigningToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
  });

  it("rejects malformed tokens", () => {
    expect(isWellFormedSigningToken("short")).toBe(false);
    expect(isWellFormedSigningToken("x".repeat(42) + "!")).toBe(false);
  });
});

describe("passwords", () => {
  it("verifies the right password only", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("wrong password", stored)).toBe(false);
  });
});
