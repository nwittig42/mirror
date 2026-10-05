import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import * as schema from "@/db/schema";

// Who's signed in is swapped per test. requirePracticeAccess is stubbed to
// return the seeded practice: its own access rules are tested elsewhere.
const session = { user: { id: "u1", email: "someone@example.com", role: "client" as "client" | "operator" } };
let practiceRow: typeof schema.practices.$inferSelect;
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => session),
  requirePracticeAccess: vi.fn(async () => practiceRow),
}));

import { submitHelp } from "@/app/dashboard/[slug]/help/actions";

const form = () => {
  const f = new FormData();
  f.set("topic", "report");
  f.set("message", "My score dropped this week, what happened?");
  return f;
};

describe("submitHelp", () => {
  beforeEach(async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    practiceRow = (await db.select().from(schema.practices)).find(p => p.id === practiceId)!;
  });

  it("refuses to send anything when an admin is viewing the customer's account", async () => {
    session.user.role = "operator";
    const result = await submitHelp(practiceRow.slug, { status: "idle" }, form());
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/viewing as admin/i);
    const { getDb } = await import("@/db");
    expect(await getDb().select().from(schema.supportRequests)).toHaveLength(0);
  });
});
