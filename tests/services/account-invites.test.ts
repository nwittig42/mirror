import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import type { Db } from "@/db";
import { accountInvites, practiceMembers, users } from "@/db/schema";
import { authorizeCredentials } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createAccountFromAudit, createInvite, inviteEmail, redeemInvite } from "@/services/account-invites";

const env = { OPERATOR_EMAIL: "operator@mirror.test", OPERATOR_PASSWORD: "bootstrap-secret" };
const OP = "operator@mirror.test";
const PASSWORD = "a-long-enough-password";

describe("account invites", () => {
  let db: Db;
  let practiceId: string;
  beforeEach(async () => {
    db = await makeTestDb();
    ({ practiceId } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor" }));
  });

  it("lets the invited person choose a password and sign in, linked to the business", async () => {
    const token = await createInvite(db, practiceId, " Dale@Harbor.example ");
    expect(await redeemInvite(db, token, PASSWORD, OP)).toEqual({ ok: true, email: "dale@harbor.example" });
    const signedIn = await authorizeCredentials(db, env, { email: "dale@harbor.example", password: PASSWORD });
    expect(signedIn).toMatchObject({ email: "dale@harbor.example", role: "client" });
    const [user] = await db.select().from(users);
    expect(user.mustChangePassword).toBe(false);
    expect(await db.select().from(practiceMembers)).toEqual([{ userId: user.id, practiceId }]);
  });

  it("stores only a hash of the token, which expires in 14 days", async () => {
    const token = await createInvite(db, practiceId, "dale@harbor.example");
    const [row] = await db.select().from(accountInvites);
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const days = (row.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
  });

  it("tells the set-up page whose link it is, only while the link can still be used", async () => {
    const token = await createInvite(db, practiceId, "Dale@Harbor.example");
    expect(await inviteEmail(db, token)).toBe("dale@harbor.example");
    expect(await inviteEmail(db, "nope")).toBeNull();
    await db.update(accountInvites).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await inviteEmail(db, token)).toBeNull();
    await db.update(accountInvites).set({ expiresAt: new Date(Date.now() + 60_000), usedAt: new Date() });
    expect(await inviteEmail(db, token)).toBeNull();
  });

  it("works once", async () => {
    const token = await createInvite(db, practiceId, "dale@harbor.example");
    await redeemInvite(db, token, PASSWORD, OP);
    expect(await redeemInvite(db, token, "another-long-password", OP)).toEqual({ ok: false, reason: "used" });
  });

  it("refuses an unknown, expired or too-weak link, and a weak one is not spent", async () => {
    expect(await redeemInvite(db, "nope", PASSWORD, OP)).toEqual({ ok: false, reason: "invalid" });
    const token = await createInvite(db, practiceId, "dale@harbor.example");
    expect(await redeemInvite(db, token, "short", OP)).toEqual({ ok: false, reason: "weak" });
    await db.update(accountInvites).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await redeemInvite(db, token, PASSWORD, OP)).toEqual({ ok: false, reason: "expired" });
    expect(await db.select().from(users)).toEqual([]);
  });

  it("leaves an existing password alone and does not spend the link", async () => {
    const passwordHash = await hashPassword("their-own-password");
    await db.insert(users).values({ email: "dale@harbor.example", role: "client", passwordHash });
    const token = await createInvite(db, practiceId, "dale@harbor.example");
    expect(await redeemInvite(db, token, PASSWORD, OP)).toEqual({ ok: false, reason: "has-account" });
    const [user] = await db.select().from(users);
    expect(await verifyPassword("their-own-password", user.passwordHash!)).toBe(true);
    const [row] = await db.select().from(accountInvites);
    expect(row.usedAt).toBeNull();
  });

  it("sets the password on an existing user who has none", async () => {
    await db.insert(users).values({ email: "dale@harbor.example", role: "client" });
    const token = await createInvite(db, practiceId, "dale@harbor.example");
    expect((await redeemInvite(db, token, PASSWORD, OP)).ok).toBe(true);
    expect(await db.select().from(users).where(eq(users.email, "dale@harbor.example"))).toHaveLength(1);
    expect(await authorizeCredentials(db, env, { email: "dale@harbor.example", password: PASSWORD })).not.toBeNull();
  });
});

describe("createAccountFromAudit", () => {
  it("makes the login without a token, and refuses the operator, an existing password or a weak one", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor" });
    expect(await createAccountFromAudit(db, practiceId, "Dale@Harbor.example", "short", OP)).toEqual({ ok: false, reason: "weak" });
    expect(await createAccountFromAudit(db, practiceId, "Dale@Harbor.example", PASSWORD, OP)).toEqual({ ok: true, email: "dale@harbor.example" });
    expect(await authorizeCredentials(db, env, { email: "dale@harbor.example", password: PASSWORD })).not.toBeNull();
    expect(await createAccountFromAudit(db, practiceId, "dale@harbor.example", "different-long-password", OP)).toEqual({ ok: false, reason: "has-account" });
    await db.insert(users).values({ email: "nick@mirror.example", role: "operator", passwordHash: "scrypt$x" });
    expect(await createAccountFromAudit(db, practiceId, "nick@mirror.example", PASSWORD, OP)).toEqual({ ok: false, reason: "has-account" });
  });
});

describe("createAccountFromAudit on a business that already has a client", () => {
  it("refuses any other address, so one business can't collect logins", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor", members: ["dale@harbor.example"] });
    expect(await createAccountFromAudit(db, practiceId, "other@x.example", PASSWORD, OP)).toEqual({ ok: false, reason: "has-account" });
    expect(await db.select().from(users)).toHaveLength(1);
  });
});

describe("account safety", () => {
  let db: Db;
  let practiceId: string;
  beforeEach(async () => {
    db = await makeTestDb();
    ({ practiceId } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor" }));
  });

  it("refuses the operator's address even before the operator has a row", async () => {
    expect(await createAccountFromAudit(db, practiceId, " Operator@Mirror.test ", PASSWORD, OP)).toEqual({ ok: false, reason: "has-account" });
    const token = await createInvite(db, practiceId, "operator@mirror.test");
    expect(await redeemInvite(db, token, PASSWORD, OP)).toEqual({ ok: false, reason: "has-account" });
    expect(await db.select().from(users)).toEqual([]);
  });

  it("refuses any existing user, even one with no password, without a link", async () => {
    await db.insert(users).values({ email: "dale@harbor.example", role: "client" });
    expect(await createAccountFromAudit(db, practiceId, "dale@harbor.example", PASSWORD, OP)).toEqual({ ok: false, reason: "has-account" });
    const [user] = await db.select().from(users);
    expect(user.passwordHash).toBeNull();
  });

  it("finds a mixed-case existing row and makes no duplicate", async () => {
    await db.insert(users).values({ email: "Dale@Harbor.example", role: "client", passwordHash: await hashPassword("their-own-password") });
    expect(await createAccountFromAudit(db, practiceId, "dale@harbor.example", PASSWORD, OP)).toEqual({ ok: false, reason: "has-account" });
    const token = await createInvite(db, practiceId, "dale@harbor.example");
    expect(await redeemInvite(db, token, PASSWORD, OP)).toEqual({ ok: false, reason: "has-account" });
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("gives the link back when the login can't be made", async () => {
    const token = await createInvite(db, practiceId, "dale@harbor.example");
    const broken = new Proxy(db, {
      get: (t, k, r) => k === "insert"
        ? (table: unknown) => { if (table === users) throw new Error("db down"); return t.insert(table as typeof users); }
        : Reflect.get(t, k, r),
    });
    await expect(redeemInvite(broken, token, PASSWORD, OP)).rejects.toThrow("db down");
    expect(await redeemInvite(db, token, PASSWORD, OP)).toEqual({ ok: true, email: "dale@harbor.example" });
  });

  it("refuses a blank email", async () => {
    expect(await createAccountFromAudit(db, practiceId, "   ", PASSWORD, OP)).toEqual({ ok: false, reason: "invalid" });
  });
});
