import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests, type Db } from "@/db";
import * as schema from "@/db/schema";
import { getTicks } from "@/services/action-ticks";

let db: Db;
// Who's signed in is swapped per test. requirePracticeView follows the real
// rules: a member of the business or an operator gets in, anyone else gets a
// 404; a paused business is locked for everyone but an operator.
const session = { user: { id: "", role: "client" as "client" | "operator" } };
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => session),
  requirePracticeView: vi.fn(async (slug: string) => {
    const [practice] = await db.select().from(schema.practices).where(eq(schema.practices.slug, slug));
    const members = await db.select().from(schema.practiceMembers).where(eq(schema.practiceMembers.userId, session.user.id || "00000000-0000-0000-0000-000000000000"));
    if (!practice || (session.user.role !== "operator" && !members.some(m => m.practiceId === practice.id))) {
      throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    }
    return { practice, locked: !practice.active && !practice.dashboardUnlocked && session.user.role !== "operator" };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { toggleTick } from "@/app/dashboard/[slug]/fixes/actions";

const form = (key: string, done: boolean) => {
  const f = new FormData();
  f.set("key", key);
  f.set("done", done ? "1" : "0");
  return f;
};
const idle = { done: false };

describe("toggleTick", () => {
  let practiceId: string;
  let ownerId: string;
  beforeEach(async () => {
    db = await makeTestDb();
    setDbForTests(db);
    ({ practiceId, memberIds: [ownerId] } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor", members: ["owner@harbor.example"] }));
    await seedPractice(db, { name: "Rose City Plumbing", slug: "rose", members: ["owner@rose.example"] });
    session.user = { id: ownerId, role: "client" };
  });

  it("ticks an item for the business and unticks it again", async () => {
    expect(await toggleTick("harbor", idle, form("source:yelp.com", true))).toEqual({ done: true });
    expect(await getTicks(db, practiceId)).toEqual(new Set(["source:yelp.com"]));
    const [row] = await db.select().from(schema.actionTicks);
    expect(row.doneBy).toBe(ownerId);

    expect(await toggleTick("harbor", { done: true }, form("source:yelp.com", false))).toEqual({ done: false });
    expect(await getTicks(db, practiceId)).toEqual(new Set());
  });

  it("works for a free account before their call", async () => {
    await db.update(schema.practices).set({ active: false }).where(eq(schema.practices.id, practiceId));
    expect(await toggleTick("harbor", idle, form("site:sitemap", true))).toEqual({ done: true });
    expect(await getTicks(db, practiceId)).toEqual(new Set(["site:sitemap"]));
  });

  it("refuses someone who can't see the business, and saves nothing", async () => {
    const [stranger] = await db.select().from(schema.users).where(eq(schema.users.email, "owner@rose.example"));
    session.user = { id: stranger.id, role: "client" };
    await expect(toggleTick("harbor", idle, form("source:yelp.com", true))).rejects.toThrow(/404/);
    expect(await db.select().from(schema.actionTicks)).toHaveLength(0);
  });

  it("refuses an operator viewing as the customer, and keeps the box as it was", async () => {
    session.user = { id: "", role: "operator" };
    const result = await toggleTick("harbor", idle, form("source:yelp.com", true));
    expect(result.done).toBe(false);
    expect(result.error).toMatch(/viewing as admin/i);
    expect(await db.select().from(schema.actionTicks)).toHaveLength(0);
  });

  it("ignores a submission with no item", async () => {
    expect(await toggleTick("harbor", idle, form("  ", true))).toEqual({ done: false });
    expect(await db.select().from(schema.actionTicks)).toHaveLength(0);
  });
});
