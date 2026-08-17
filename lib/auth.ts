import { createHmac, timingSafeEqual } from "crypto";

export const OPERATOR_COOKIE_NAME = "operator_session";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(expiresAt: number): string {
  return createHmac("sha256", secret()).update(String(expiresAt)).digest("hex");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** A session token is `${expiresAt}.${hmac(expiresAt)}` — no server-side session store
 * needed, the signature itself proves it was issued by this server and hasn't been
 * tampered with. Single shared operator credential, not per-user, since nothing in the
 * data model tracks distinct operator identities today. */
export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  return timingSafeStringEqual(signature, sign(expiresAt));
}

/** Plaintext comparison against the env var is intentional — the env var itself is the
 * trust boundary here, so hashing a value we compare 1:1 server-side adds nothing. Still
 * timing-safe to avoid leaking the password length/prefix via response-time differences. */
export function checkPassword(password: string): boolean {
  const expected = process.env.OPERATOR_PASSWORD;
  if (!expected) return false;
  return timingSafeStringEqual(password, expected);
}
