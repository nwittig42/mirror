import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests, type Db } from "@/db";
import * as schema from "@/db/schema";
import { getTicks, setTick } from "@/services/action-ticks";
import type { WebsiteCheckResult } from "@/core/website-check";

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
// The real setTick, which a test can make fail once.
vi.mock("@/services/action-ticks", async importOriginal => {
  const real = await importOriginal<typeof import("@/services/action-ticks")>();
  return { ...real, setTick: vi.fn(real.setTick) };
});

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
    let promptIds: string[];
    ({ practiceId, promptIds, memberIds: [ownerId] } = await seedPractice(db, {
      name: "Harbor Plumbing", slug: "harbor", members: ["owner@harbor.example"],
      prompts: [{ text: "Best plumber in Portland", kind: "category" }],
    }));
    // A finished scan whose plan has two steps: get on yelp.com, publish a sitemap.
    const site: WebsiteCheckResult = {
      checkedAt: "2026-10-20T00:00:00Z", pages: [], homepageText: "",
      checks: [{ id: "sitemap", label: "Sitemap", why: "No sitemap found.", status: "fail" }],
    };
    const [scan] = await db.insert(schema.scans).values({ practiceId, status: "complete", websiteCheck: site }).returning();
    await db.insert(schema.checks).values({
      scanId: scan.id, promptId: promptIds[0], engine: "openai", mentioned: false, position: "absent",
      answerText: "Rose City Plumbing is the one to call.", citations: ["https://www.yelp.com/biz/rose-city"],
      competitorsMentioned: ["Rose City Plumbing"], namedOrder: ["Rose City Plumbing"],
    });
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

  it("only saves ticks for steps in the current plan", async () => {
    expect(await toggleTick("harbor", idle, form("source:junk.example", true))).toEqual({ done: false });
    expect(await toggleTick("harbor", idle, form("x".repeat(200), true))).toEqual({ done: false });
    expect(await db.select().from(schema.actionTicks)).toHaveLength(0);
    // Unticking a step that isn't in the plan leaves everything as it was.
    await setTick(db, practiceId, "source:old.example", true);
    expect(await toggleTick("harbor", { done: true }, form("source:old.example", false))).toEqual({ done: true });
    expect(await getTicks(db, practiceId)).toEqual(new Set(["source:old.example"]));
  });

  it("puts the box back with a message when the save fails", async () => {
    vi.mocked(setTick).mockRejectedValueOnce(new Error("database down"));
    const result = await toggleTick("harbor", idle, form("source:yelp.com", true));
    expect(result.done).toBe(false);
    expect(result.error).toMatch(/couldn.t save/i);
    expect(await db.select().from(schema.actionTicks)).toHaveLength(0);
  });
});
