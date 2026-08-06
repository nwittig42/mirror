import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import * as schema from "@/db/schema";
import { verifyPassword } from "@/lib/password";

// Same stubs as tests/app/admin-actions.test.ts: `requireOperator()` has no
// session to read outside a request, and `revalidatePath` asserts it's inside
// a Next render scope.
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  requireOperator: vi.fn().mockResolvedValue({ id: "operator-1", role: "operator" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { issueClientPassword } from "@/app/admin/actions";

describe("issueClientPassword", () => {
  it("creates the client, links it to the practice, and returns a password to read on the call", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    const result = await issueClientPassword(practiceId, "owner@glow.test");

    expect(result.email).toBe("owner@glow.test");
    expect(result.password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);

    const [user] = await db.select().from(schema.users)
      .where(eq(schema.users.email, "owner@glow.test"));
    expect(user.role).toBe("client");
    expect(user.mustChangePassword).toBe(true);
    expect(await verifyPassword(result.password, user.passwordHash)).toBe(true);

    const members = await db.select().from(schema.practiceMembers)
      .where(eq(schema.practiceMembers.userId, user.id));
    expect(members).toHaveLength(1);
    expect(members[0].practiceId).toBe(practiceId);
  });

  it("stores the hash, never the password itself", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    const { password } = await issueClientPassword(practiceId, "owner@glow.test");

    const [user] = await db.select().from(schema.users)
      .where(eq(schema.users.email, "owner@glow.test"));
    expect(user.passwordHash).not.toContain(password);
  });

  it("keeps the password out of the activity log", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    const { password } = await issueClientPassword(practiceId, "owner@glow.test");

    const rows = await db.select().from(schema.activities)
      .where(eq(schema.activities.practiceId, practiceId));
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toContain("owner@glow.test");
    expect(rows[0].description).not.toContain(password);
  });

  it("resets an existing client without duplicating the user or the membership", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", members: ["owner@glow.test"],
    });

    const first = await issueClientPassword(practiceId, "owner@glow.test");
    const second = await issueClientPassword(practiceId, "owner@glow.test");

    expect(second.password).not.toBe(first.password);
    expect(await db.select().from(schema.users)).toHaveLength(1);
    expect(await db.select().from(schema.practiceMembers)).toHaveLength(1);

    const [user] = await db.select().from(schema.users);
    expect(await verifyPassword(first.password, user.passwordHash)).toBe(false);
    expect(await verifyPassword(second.password, user.passwordHash)).toBe(true);
  });

  it("normalizes the email so a mistyped case cannot create a second account", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    await issueClientPassword(practiceId, "owner@glow.test");
    await issueClientPassword(practiceId, "  Owner@Glow.Test  ");

    expect(await db.select().from(schema.users)).toHaveLength(1);
  });

  it("refuses to hand an operator account a client password", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    await db.insert(schema.users).values({ email: "operator@mirror.test", role: "operator" });

    await expect(issueClientPassword(practiceId, "operator@mirror.test")).rejects.toThrow(/operator/i);

    const [user] = await db.select().from(schema.users)
      .where(eq(schema.users.email, "operator@mirror.test"));
    expect(user.passwordHash).toBeNull();
  });

  it("rejects an empty email rather than creating a blank account", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    await expect(issueClientPassword(practiceId, "   ")).rejects.toThrow();
    expect(await db.select().from(schema.users)).toHaveLength(0);
  });
});
