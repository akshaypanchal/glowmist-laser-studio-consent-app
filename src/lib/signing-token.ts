import { randomToken, sha256Hex } from "./crypto";

/**
 * Signing links carry a random token. Only its SHA-256 hash is stored, so a
 * database leak does not reveal usable links.
 */
export function createSigningToken(): { token: string; tokenHash: string } {
  const token = randomToken(32);
  return { token, tokenHash: hashSigningToken(token) };
}

export function hashSigningToken(token: string): string {
  return sha256Hex(`signing-token:${token}`);
}

/** Tokens are 43 base64url characters; reject anything else before touching the DB. */
export function isWellFormedSigningToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
