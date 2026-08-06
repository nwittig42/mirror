import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "../helpers/db";
import { setDbForTests } from "@/db";
import * as schema from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { AuthChannel } from "@/lib/auth";
import type { Db } from "@/db";

const authMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  auth: () => authMock(),
  // The real signOut throws a redirect. Stubbed so the action can be asserted
  // on rather than unwound as a Next.js navigation.
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

import { changePassword } from "@/app/change-password/actions";

function signedInAs(user: { id: string }, channel: AuthChannel) {
  authMock.mockResolvedValue({ user: { id: user.id, role: "client", channel } });
}

async function seedUser(db: Db, over: Partial<typeof schema.users.$inferInsert> = {}) {
  const [user] = await db.insert(schema.users)
    .values({ email: "client@practice.test", role: "client", ...over })
    .returning();
  return user;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

async function reload(db: Db, id: string) {
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  return row;
}

beforeEach(() => {
  authMock.mockReset();
  signOutMock.mockReset();
});

describe("changePassword", () => {
  it("sets the new hash, clears the must-change flag, and signs the user out to re-issue the token", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const user = await seedUser(db, {
      passwordHash: await hashPassword("temp-pass-1234"), mustChangePassword: true,
    });
    signedInAs(user, "password");

    const result = await changePassword(
      {},
      form({ newPassword: "a-much-better-secret", confirmPassword: "a-much-better-secret" }),
    );

    expect(result?.error).toBeUndefined();
    const row = await reload(db, user.id);
    expect(row.mustChangePassword).toBe(false);
    expect(await verifyPassword("a-much-better-secret", row.passwordHash)).toBe(true);
    expect(await verifyPassword("temp-pass-1234", row.passwordHash)).toBe(false);
    // Without this the session JWT keeps saying mustChangePassword, and
    // middleware pins the user to this page forever.
    expect(signOutMock).toHaveBeenCalled();
  });

  it("requires the current password when the user signed in with one and is not being forced", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const user = await seedUser(db, {
      passwordHash: await hashPassword("chosen-already"), mustChangePassword: false,
    });
    signedInAs(user, "password");

    const missing = await changePassword(
      {}, form({ newPassword: "a-much-better-secret", confirmPassword: "a-much-better-secret" }),
    );
    expect(missing.error).toMatch(/current password/i);

    const wrong = await changePassword({}, form({
      currentPassword: "not-it",
      newPassword: "a-much-better-secret",
      confirmPassword: "a-much-better-secret",
    }));
    expect(wrong.error).toMatch(/current password/i);

    expect(await verifyPassword("chosen-already", (await reload(db, user.id)).passwordHash)).toBe(true);
    expect(signOutMock).not.toHaveBeenCalled();

    const right = await changePassword({}, form({
      currentPassword: "chosen-already",
      newPassword: "a-much-better-secret",
      confirmPassword: "a-much-better-secret",
    }));
    expect(right?.error).toBeUndefined();
  });

  it("does not ask a magic-link session for a current password, since that is the forgot-password path", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const user = await seedUser(db, {
      passwordHash: await hashPassword("the-one-they-forgot"), mustChangePassword: false,
    });
    signedInAs(user, "link");

    const result = await changePassword(
      {}, form({ newPassword: "a-much-better-secret", confirmPassword: "a-much-better-secret" }),
    );

    expect(result?.error).toBeUndefined();
    expect(await verifyPassword("a-much-better-secret", (await reload(db, user.id)).passwordHash)).toBe(true);
  });

  it("rejects a password shorter than the minimum", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const user = await seedUser(db, { mustChangePassword: true });
    signedInAs(user, "link");

    const result = await changePassword({}, form({ newPassword: "short", confirmPassword: "short" }));

    expect(result.error).toMatch(/12 characters/);
    expect((await reload(db, user.id)).passwordHash).toBeNull();
  });

  it("rejects a mismatched confirmation", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const user = await seedUser(db, { mustChangePassword: true });
    signedInAs(user, "link");

    const result = await changePassword(
      {}, form({ newPassword: "a-much-better-secret", confirmPassword: "a-much-better-secrat" }),
    );

    expect(result.error).toMatch(/match/i);
    expect((await reload(db, user.id)).passwordHash).toBeNull();
  });

  it("refuses to re-set the password the user already has", async () => {
    // Otherwise a client can satisfy the forced change by typing the temporary
    // password the operator read to them over the phone, which is the one
    // password the flow exists to retire.
    const db = await makeTestDb();
    setDbForTests(db);
    const user = await seedUser(db, {
      passwordHash: await hashPassword("temp-pass-1234"), mustChangePassword: true,
    });
    signedInAs(user, "password");

    const result = await changePassword(
      {}, form({ newPassword: "temp-pass-1234", confirmPassword: "temp-pass-1234" }),
    );

    expect(result.error).toMatch(/different/i);
    expect((await reload(db, user.id)).mustChangePassword).toBe(true);
  });

  it("rejects a signed-out caller", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    authMock.mockResolvedValue(null);

    const result = await changePassword(
      {}, form({ newPassword: "a-much-better-secret", confirmPassword: "a-much-better-secret" }),
    );

    expect(result.error).toBeTruthy();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
