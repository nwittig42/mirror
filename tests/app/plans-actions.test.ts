import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import * as schema from "@/db/schema";

// Who's signed in is swapped per test. requirePracticeAccess is stubbed to
// return the seeded practice: its own access rules are tested elsewhere. The
// request itself is captured: storing and emailing it is tested in support.
const session = { user: { id: "u1", email: "owner@bluebox.example", role: "client" as "client" | "operator" } };
let practiceRow: typeof schema.practices.$inferSelect;
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => session),
  requirePracticeAccess: vi.fn(async () => practiceRow),
}));
const created: { topic: string; message: string; email: string }[] = [];
vi.mock("@/services/support", () => ({
  createSupportRequest: vi.fn(async (_db: unknown, input: { topic: string; message: string; email: string }) => {
    created.push(input);
    return "req-1";
  }),
}));

import { startPlan } from "@/app/dashboard/[slug]/plans/actions";

const form = (plan: string) => {
  const f = new FormData();
  f.set("plan", plan);
  return f;
};

describe("startPlan", () => {
  beforeEach(async () => {
    created.length = 0;
    session.user.role = "client";
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Blue Box Bakery" });
    practiceRow = (await db.select().from(schema.practices)).find(p => p.id === practiceId)!;
  });

  it("files a plan request for us, and tells the owner when to expect us", async () => {
    const result = await startPlan(practiceRow.slug, { status: "idle" }, form("pulse"));
    expect(result.status).toBe("sent");
    expect(result.message).toContain("We'll email owner@bluebox.example within one business day");
    expect(created).toHaveLength(1);
    expect(created[0].topic).toBe("start_plan");
    expect(created[0].message).toBe("Blue Box Bakery wants to start Pulse ($149 a month, first month free). Current plan: free audit.");
  });

  it("refuses a plan that doesn't exist", async () => {
    const result = await startPlan(practiceRow.slug, { status: "idle" }, form("platinum"));
    expect(result.status).toBe("error");
    expect(created).toHaveLength(0);
  });

  it("won't start a plan for the customer when an admin is viewing", async () => {
    session.user.role = "operator";
    const result = await startPlan(practiceRow.slug, { status: "idle" }, form("partner"));
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/viewing as admin/i);
    expect(created).toHaveLength(0);
  });
});
