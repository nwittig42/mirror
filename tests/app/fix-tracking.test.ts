import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";

let db: Db;
vi.mock("@/lib/auth", () => ({
  requireOperator: vi.fn().mockResolvedValue({ id: "operator-1", role: "operator" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateFix } from "@/app/admin/actions";

// What AI says about Harbor's price. The test changes it between scans.
let priceAnswer = "Harbor Plumbing charges a $49 call-out fee.";
const adapter: EngineAdapter = {
  name: "openai",
  run: async prompt => prompt.includes("fee")
    ? { answer: priceAnswer, citations: ["https://yelp.com/biz/harbor-plumbing"] }
    : { answer: "Harbor Plumbing is open on Sundays.", citations: ["https://www.harbor.example/hours"] },
};
const judge = async ({ answer }: { answer: string }) => ({
  wrong: [
    ...(answer.includes("$49") ? [{ claim: "Harbor Plumbing charges $49", factLabel: "Call-out fee", severity: "major" as const }] : []),
    ...(answer.includes("Sundays") ? [{ claim: "Open on Sundays", factLabel: "Sunday hours", severity: "minor" as const }] : []),
  ],
  right: [],
});
const scan = () => runScan(db, practiceId, [adapter], judge, async () => []);
const findingFor = async (label: string) => {
  const rows = await db.select({ finding: schema.findings, label: schema.facts.label }).from(schema.findings)
    .leftJoin(schema.facts, eq(schema.findings.factId, schema.facts.id)).where(eq(schema.findings.practiceId, practiceId));
  return rows.filter(r => r.label === label).map(r => r.finding);
};
let practiceId: string;

describe("tracking a fix to a wrong fact", () => {
  beforeEach(async () => {
    db = await makeTestDb();
    setDbForTests(db);
    priceAnswer = "Harbor Plumbing charges a $49 call-out fee.";
    ({ practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", slug: "harbor",
      prompts: [
        { text: "What is Harbor Plumbing's call-out fee?", kind: "branded" },
        { text: "Is Harbor Plumbing open on weekends?", kind: "branded" },
      ],
      facts: [
        { category: "pricing", label: "Call-out fee", value: "$89" },
        { category: "logistics", label: "Sunday hours", value: "Closed Sundays" },
      ],
    }));
    await db.update(schema.practices).set({ website: "https://harbor.example" }).where(eq(schema.practices.id, practiceId));
    await scan();
  });

  it("stores the state and the note the operator sets, and logs a fix for the customer", async () => {
    const [fee] = await findingFor("Call-out fee");
    const [hours] = await findingFor("Sunday hours");
    await updateFix(fee.id, { state: "in_progress", note: "  Emailed Yelp on Oct 14  " });
    await updateFix(hours.id, { state: "fixed" });

    const [stored] = await db.select().from(schema.findings).where(eq(schema.findings.id, fee.id));
    // Still open underneath: AI is still saying it, so it still counts against the score.
    expect(stored).toMatchObject({ status: "open", note: "Emailed Yelp on Oct 14" });
    expect(stored.workStartedAt).toBeInstanceOf(Date);

    const log = await db.select().from(schema.activities).where(eq(schema.activities.practiceId, practiceId));
    expect(log.filter(a => a.visibility === "client").map(a => a.description)).toContain("Fixed a wrong fact: Sunday hours");
    expect(log.some(a => a.visibility === "client" && a.description.includes("In progress"))).toBe(false);
  });

  it("clears a note with a blank one and dismisses a fact", async () => {
    const [fee] = await findingFor("Call-out fee");
    await updateFix(fee.id, { state: "todo", note: "Looking into it" });
    await updateFix(fee.id, { state: "dismissed", note: "   " });
    const [stored] = await db.select().from(schema.findings).where(eq(schema.findings.id, fee.id));
    expect(stored).toMatchObject({ status: "dismissed", note: null, noteUpdatedAt: null });
  });

  it("confirms a fix when the next scan no longer sees it, and tells the customer", async () => {
    const [fee] = await findingFor("Call-out fee");
    await updateFix(fee.id, { state: "fixed" });
    priceAnswer = "Harbor Plumbing charges an $89 call-out fee.";
    await scan();

    const [stored] = await db.select().from(schema.findings).where(eq(schema.findings.id, fee.id));
    expect(stored.status).toBe("verified");
    const log = await db.select().from(schema.activities).where(eq(schema.activities.practiceId, practiceId));
    expect(log.some(a => a.visibility === "client" && a.description.startsWith("Confirmed 1 fix"))).toBe(true);
  });

  it("does not confirm a fix AI is still repeating, and keeps the mistake open", async () => {
    const [fee] = await findingFor("Call-out fee");
    await updateFix(fee.id, { state: "fixed" });
    await scan(); // AI still says $49

    const fees = await findingFor("Call-out fee");
    expect(fees.map(f => f.status).sort()).toEqual(["fixed", "open"]);
  });
});

