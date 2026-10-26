import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";

let db: Db;
// The same rule as the real requirePracticeView: a paused business is locked.
vi.mock("@/lib/auth", () => ({
  requireOperator: vi.fn().mockResolvedValue({ id: "operator-1", role: "operator" }),
  requirePracticeView: vi.fn(async (slug: string) => {
    const [practice] = await db.select().from(schema.practices).where(eq(schema.practices.slug, slug));
    return { practice, locked: !practice.active };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// The recommendations come from the report, which checks the website once per
// scan. Here the site blocks AI (a fix for anyone) and has no machine labels
// (a fix that only matters for facts), with no network call.
vi.mock("@/services/website-check", () => ({
  runWebsiteCheck: vi.fn(async () => ({
    checkedAt: "2026-10-26T00:00:00Z", pages: [], homepageText: "",
    checks: [
      { id: "ai_allowed", label: "AI allowed", why: "Your site tells AI assistants to stay out.", status: "fail" },
      { id: "machine_labels", label: "Machine labels", why: "Prices and FAQs are not labelled for machines.", status: "fail" },
    ],
  })),
}));

import FixListPage from "@/app/dashboard/[slug]/fixes/page";
import { updateFix } from "@/app/admin/actions";

const params = Promise.resolve({ slug: "harbor" });
const html = async (page: Promise<React.ReactElement>) => renderToStaticMarkup(await page);

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

describe("the fix list", () => {
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

  it("lists each wrong fact with the truth, where AI read it and what to change, prices first", async () => {
    const page = await html(FixListPage({ params }));
    expect(page).toContain("2 wrong facts: 2 to do.");
    expect(page).toContain("Call-out fee");
    expect(page).toContain("Harbor Plumbing charges $49");
    expect(page).toContain("$89");
    expect(page).toContain("Ask yelp.com to correct it, and state the right version on your site.");
    expect(page).toContain("Correct this on your own website first; AI read it there.");
    expect(page.indexOf("Call-out fee")).toBeLessThan(page.indexOf("Sunday hours"));
    expect(page).toContain("Ask us to fix them");
  });

  it("shows the state and the note the operator sets, and logs a fix for the customer", async () => {
    const [fee] = await findingFor("Call-out fee");
    const [hours] = await findingFor("Sunday hours");
    await updateFix(fee.id, { state: "in_progress", note: "  Emailed Yelp on Oct 14  " });
    await updateFix(hours.id, { state: "fixed" });

    const page = await html(FixListPage({ params }));
    expect(page).toContain("2 wrong facts: 1 fixed, 1 in progress.");
    expect(page).toContain("Emailed Yelp on Oct 14");
    expect(page).toContain("Note from Mirror");

    const [stored] = await db.select().from(schema.findings).where(eq(schema.findings.id, fee.id));
    // Still open underneath: AI is still saying it, so it still counts against the score.
    expect(stored).toMatchObject({ status: "open", note: "Emailed Yelp on Oct 14" });
    expect(stored.workStartedAt).toBeInstanceOf(Date);

    const log = await db.select().from(schema.activities).where(eq(schema.activities.practiceId, practiceId));
    expect(log.filter(a => a.visibility === "client").map(a => a.description)).toContain("Fixed a wrong fact: Sunday hours");
    expect(log.some(a => a.visibility === "client" && a.description.includes("In progress"))).toBe(false);
  });

  it("clears a note with a blank one and takes a dismissed fact off the customer's list", async () => {
    const [fee] = await findingFor("Call-out fee");
    await updateFix(fee.id, { state: "todo", note: "Looking into it" });
    await updateFix(fee.id, { state: "dismissed", note: "   " });
    const [stored] = await db.select().from(schema.findings).where(eq(schema.findings.id, fee.id));
    expect(stored).toMatchObject({ status: "dismissed", note: null, noteUpdatedAt: null });
    const page = await html(FixListPage({ params }));
    expect(page).toContain("1 wrong fact: 1 to do.");
    expect(page).not.toContain("Harbor Plumbing charges $49");
  });

  it("confirms a fix when the next scan no longer sees it, and tells the customer", async () => {
    const [fee] = await findingFor("Call-out fee");
    await updateFix(fee.id, { state: "fixed" });
    priceAnswer = "Harbor Plumbing charges an $89 call-out fee.";
    await scan();

    const [stored] = await db.select().from(schema.findings).where(eq(schema.findings.id, fee.id));
    expect(stored.status).toBe("verified");
    const page = await html(FixListPage({ params }));
    expect(page).toContain("2 wrong facts: 1 fixed, 1 to do.");
    expect(page).toContain("Confirmed fixed (1)");
    const log = await db.select().from(schema.activities).where(eq(schema.activities.practiceId, practiceId));
    expect(log.some(a => a.visibility === "client" && a.description.startsWith("Confirmed 1 fix"))).toBe(true);
  });

  it("does not confirm a fix AI is still repeating, and shows the mistake once, as to do", async () => {
    const [fee] = await findingFor("Call-out fee");
    await updateFix(fee.id, { state: "fixed" });
    await scan(); // AI still says $49

    const fees = await findingFor("Call-out fee");
    expect(fees.map(f => f.status).sort()).toEqual(["fixed", "open"]);
    const page = await html(FixListPage({ params }));
    expect(page).toContain("2 wrong facts: 2 to do.");
    expect(page.split("Harbor Plumbing charges $49").length - 1).toBe(1);
  });

  it("lists the recommendations above the wrong facts, in order", async () => {
    const page = await html(FixListPage({ params }));
    expect(page).toContain("Your recommendations");
    expect(page.indexOf("Your recommendations")).toBeLessThan(page.indexOf("To do ("));
    expect(page).toContain("Let AI assistants read your site");
    expect(page).toContain("Fix your price everywhere it appears");
  });

  it("gives a prospect before their call the recommendations, but none that rest on a wrong fact", async () => {
    await db.update(schema.practices).set({ active: false }).where(eq(schema.practices.id, practiceId));
    const page = await html(FixListPage({ params }));
    expect(page).toContain("Your recommendations");
    expect(page).toContain("Let AI assistants read your site");
    expect(page).not.toContain("Fix your price everywhere it appears");
    expect(page).not.toContain("Correct the wrong facts at their source");
    expect(page).not.toContain("Label your prices and FAQs for machines");
    // The wrong-fact list stays locked, and none of it is sent.
    expect(page).toContain("Unlocks after your call");
    expect(page).not.toContain("$49");
    expect(page).not.toContain("Sundays");
    expect(page).not.toContain("yelp.com");
    expect(page).not.toContain("Want us to fix these for you?");
  });
});
