import { describe, it, expect } from "vitest";
import { generateTempPassword, hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword", () => {
  it("never stores the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse battery staple");
  });

  it("salts, so the same password hashes differently every time", async () => {
    const [a, b] = await Promise.all([hashPassword("hunter2"), hashPassword("hunter2")]);
    expect(a).not.toBe(b);
    expect(await verifyPassword("hunter2", a)).toBe(true);
    expect(await verifyPassword("hunter2", b)).toBe(true);
  });

  it("records the scrypt parameters in the stored string so they can be retuned later", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash.split("$")[0]).toBe("scrypt");
    expect(hash.split("$")).toHaveLength(6);
  });
});

describe("verifyPassword", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", hash)).toBe(true);
    expect(await verifyPassword("hunter3", hash)).toBe(false);
  });

  it("rejects rather than throws on a null or malformed stored hash", async () => {
    expect(await verifyPassword("hunter2", null)).toBe(false);
    expect(await verifyPassword("hunter2", "")).toBe(false);
    expect(await verifyPassword("hunter2", "not-a-hash")).toBe(false);
    expect(await verifyPassword("hunter2", "scrypt$16384$8$1$deadbeef")).toBe(false);
    // A hash whose recorded digest length disagrees with the stored digest
    // must fail closed rather than throw out of timingSafeEqual.
    expect(await verifyPassword("hunter2", "scrypt$16384$8$1$abcd$ef")).toBe(false);
  });

  it("rejects an empty password even against a hash of the empty string", async () => {
    const hash = await hashPassword("");
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("verifies a hash whose parameters differ from today's defaults", async () => {
    // Guards the upgrade path: retuning the cost in hashPassword must not
    // lock out everyone hashed under the old cost.
    const hash = await hashPassword("hunter2", { cost: 1024 });
    expect(hash).toContain("$1024$");
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });
});

describe("generateTempPassword", () => {
  it("omits characters that are ambiguous when read aloud on a call", () => {
    const joined = Array.from({ length: 200 }, () => generateTempPassword()).join("");
    expect(joined).not.toMatch(/[oOiIlL01]/);
  });

  it("is grouped for dictation and long enough to resist guessing", () => {
    const password = generateTempPassword();
    expect(password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateTempPassword()));
    expect(seen.size).toBe(500);
  });
});
