// SERVER ONLY. This module evaluates `node:crypto` at import time, so a "use
// client" component that imports anything from here (even a constant) crashes
// the page in the browser. Client-side password rules live in
// `src/lib/password-policy.ts`.
import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// promisify() resolves to scrypt's 3-argument overload, which drops the options
// parameter this module needs to pass (and to re-read from a stored hash), so
// the promisified form is typed explicitly.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// scrypt ships with Node, so password hashing costs the project no new
// dependency. These are Node's own defaults; memory use is 128 * cost * blockSize
// (16 MB here), which stays under the 32 MB default maxmem.
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export interface HashOptions {
  cost?: number;
  blockSize?: number;
  parallelization?: number;
}

/**
 * Hashes a password with scrypt into `scrypt$cost$blockSize$parallelization$salt$digest`.
 * The parameters live inside the stored string rather than only in this module,
 * so raising the cost later still verifies every password hashed under the old one.
 */
export async function hashPassword(password: string, options: HashOptions = {}): Promise<string> {
  const cost = options.cost ?? COST;
  const blockSize = options.blockSize ?? BLOCK_SIZE;
  const parallelization = options.parallelization ?? PARALLELIZATION;

  const salt = randomBytes(SALT_LENGTH);
  const digest = await scryptAsync(password, salt, KEY_LENGTH, {
    N: cost, r: blockSize, p: parallelization,
  });

  return [
    "scrypt", cost, blockSize, parallelization, salt.toString("hex"), digest.toString("hex"),
  ].join("$");
}

/**
 * Constant-time password check. Fails closed (returns false, never throws) on a
 * null, empty, or malformed stored hash, so a user row that has no password yet
 * simply cannot be signed into rather than crashing the sign-in route.
 *
 * An empty candidate password is rejected outright: a blank password field must
 * never authenticate, even against a row whose hash really is of the empty string.
 */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!password || !stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, cost, blockSize, parallelization, saltHex, digestHex] = parts;
  const N = Number(cost);
  const r = Number(blockSize);
  const p = Number(parallelization);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(digestHex, "hex");
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    // Derives to the stored digest's length, not KEY_LENGTH, so a hash written
    // under a different key length still compares rather than throwing out of
    // timingSafeEqual on a length mismatch.
    const actual = await scryptAsync(password, salt, expected.length, { N, r, p });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// No o/O, i/I, l/L, 0, or 1. The operator reads this password to the client
// over the phone on the onboarding call, and those are the characters that get
// misheard.
const DICTATION_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const GROUPS = 3;
const GROUP_LENGTH = 4;

/**
 * A one-time password for a new client account, grouped as `abcd-efgh-jkmn` so
 * it can be read aloud. Twelve characters from a 31-character alphabet is about
 * 59 bits, which is far past guessable for a credential that is meant to be
 * changed at first login anyway.
 */
export function generateTempPassword(): string {
  return Array.from({ length: GROUPS }, () =>
    Array.from({ length: GROUP_LENGTH }, () =>
      DICTATION_ALPHABET[randomInt(DICTATION_ALPHABET.length)],
    ).join(""),
  ).join("-");
}
