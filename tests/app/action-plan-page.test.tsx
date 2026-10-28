import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests, type Db } from "@/db";
import * as schema from "@/db/schema";
import { setTick } from "@/services/action-ticks";
import type { WebsiteCheckResult } from "@/core/website-check";

let db: Db;
let role: "client" | "operator" = "client";
// The same rule as the real requirePracticeView: paused and not unlocked is locked, never for an operator.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "u1", role } })),
  requirePracticeView: vi.fn(async (slug: string) => {
    const [practice] = await db.select().from(schema.practices).where(eq(schema.practices.slug, slug));
    return { practice, locked: !practice.active && !practice.dashboardUnlocked && role !== "operator" };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import ActionPlanPage from "@/app/dashboard/[slug]/fixes/page";

const params = Promise.resolve({ slug: "harbor" });
const html = async () => renderToStaticMarkup(await ActionPlanPage({ params }));

const failingSite: WebsiteCheckResult = {
  checkedAt: "2026-10-20T00:00:00Z",
  checks: [{ id: "sitemap", label: "Sitemap", why: "No sitemap found.", status: "fail" }],
  pages: [], homepageText: "",
};

let practiceId: string;
let promptIds: string[];
let factIds: string[];

/** A wrong price on the latest scan's first answer, being worked on, with a note from us. */
async function addWrongFee() {
  const [scan] = await db.select().from(schema.scans).where(eq(schema.scans.practiceId, practiceId));
  const [check] = await db.select().from(schema.checks).where(eq(schema.checks.scanId, scan.id));
  await db.insert(schema.findings).values({
    practiceId, checkId: check.id, factId: factIds[0], claim: "Harbor Plumbing charges $49", factValue: "$89",
    severity: "major", lastSeenScanId: scan.id, workStartedAt: new Date(), note: "Emailed Yelp on Oct 14", noteUpdatedAt: new Date(),
  });
}

/** A finished scan: each answer as the engine gave it, with the website check saved on the scan. */
async function scanWith(answers: Partial<typeof schema.checks.$inferInsert>[], websiteCheck: WebsiteCheckResult | null = failingSite) {
  const [scan] = await db.insert(schema.scans).values({ practiceId, status: "complete", websiteCheck }).returning();
  if (answers.length) {
    await db.insert(schema.checks).values(answers.map(a => ({
      scanId: scan.id, promptId: promptIds[0], engine: "openai" as const, mentioned: false, position: "absent" as const,
      answerText: "", citations: [], competitorsMentioned: [], ...a,
    })));
  }
  return scan;
}

describe("the action plan page", () => {
  beforeEach(async () => {
    db = await makeTestDb();
    setDbForTests(db);
    role = "client";
    ({ practiceId, promptIds, factIds } = await seedPractice(db, {
      name: "Harbor Plumbing", slug: "harbor",
      prompts: [{ text: "Best plumber in Portland", kind: "category" }],
      facts: [{ category: "pricing", label: "Call-out fee", value: "$89" }],
    }));
    await db.update(schema.practices).set({ website: "https://harbor.example" }).where(eq(schema.practices.id, practiceId));
  });

  const lostToRoseCity = () => scanWith([
    { engine: "openai", answerText: "Rose City Plumbing is the one to call.", citations: ["https://www.yelp.com/biz/rose-city"],
      competitorsMentioned: ["Rose City Plumbing"], namedOrder: ["Rose City Plumbing"] },
    { engine: "anthropic", answerText: "Try Rose City Plumbing or Stumptown Drains.", citations: ["https://www.yelp.com/biz/stumptown"],
      competitorsMentioned: ["Rose City Plumbing", "Stumptown Drains"], namedOrder: ["Rose City Plumbing", "Stumptown Drains"] },
  ]);

  it("lists every group in order as filters, with quick wins first and the real competitors in the why", async () => {
    await lostToRoseCity();
    const page = await html();
    expect(page).toContain("Your next steps");
    expect(page).toMatch(/3 steps to get recommended by AI more often · <span[^>]*>1 quick win/);
    expect(page).toContain("Start here");
    expect(page).toContain("0 of 3 done");
    const order = ["Get listed where AI looks", "Win the questions you&#x27;re losing", "Fix your website for AI"].map(t => page.indexOf(t));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(page).toContain("Get on yelp.com");
    expect(page).toContain("Rose City Plumbing (2)");
    expect(page).toContain("Stumptown Drains (1)");
    // The selected step shows its timeline, what it could win and a numbered guide with real links.
    expect(page).toContain("Time to do");
    expect(page).toContain("When AI notices");
    expect(page).toContain("What it could win");
    expect(page).toContain("Step by step");
    expect(page).toContain('href="https://business.yelp.com"');
    expect(page).toContain("Review request to send");
    // Urgency by colour, size and time as its own label.
    expect(page).toContain("Urgent");
    expect(page).toMatch(/Small task · \d/);
    // Nothing from the fact check.
    expect(page).not.toContain("$89");
  });

  it("marks a ticked item done, struck through, where it was, and counts it", async () => {
    await lostToRoseCity();
    await setTick(db, practiceId, "source:yelp.com", true);
    const page = await html();
    expect(page).toContain("1 of 3 done");
    expect(page).toMatch(/data-done="true"[^>]*data-key="source:yelp.com"/);
    expect(page).toMatch(/aria-checked="true"[^>]*>[\s\S]*?Get on yelp.com/);
    expect(page).toMatch(/line-through[^"]*"[^>]*>Get on yelp.com/);
    expect(page).toMatch(/data-done="false"[^>]*data-key="site:sitemap"/);
    // Ticked items stay in place: yelp is still first.
    expect(page.indexOf("Get on yelp.com")).toBeLessThan(page.indexOf("Best plumber in Portland"));
  });

  it("each box is a form that posts the item and its new state, so it works without script", async () => {
    await lostToRoseCity();
    await setTick(db, practiceId, "source:yelp.com", true);
    const page = await html();
    expect(page).toMatch(/<form[^>]*>(?:(?!<\/form>)[\s\S])*name="key" value="source:yelp.com"(?:(?!<\/form>)[\s\S])*name="done" value="0"/);
    expect(page).toMatch(/<form[^>]*>(?:(?!<\/form>)[\s\S])*name="key" value="site:sitemap"(?:(?!<\/form>)[\s\S])*name="done" value="1"/);
  });

  it("gives a free account the whole plan, and no fact check", async () => {
    await db.update(schema.practices).set({ active: false }).where(eq(schema.practices.id, practiceId));
    await lostToRoseCity();
    const page = await html();
    expect(page).toContain("Get on yelp.com");
    expect(page).toContain("Fix your website for AI");
    expect(page).not.toContain("Unlocks after your call");
    expect(page).not.toContain("$89");
    expect(page).not.toContain("Wrong facts");
    expect(page).not.toContain('id="wrong-facts"');
  });

  it("keeps a paying client's wrong facts at the bottom, with how far each fix has got and our note", async () => {
    await lostToRoseCity();
    await addWrongFee();
    const page = await html();
    expect(page).toContain('id="wrong-facts"');
    expect(page.indexOf("Fix your website for AI")).toBeLessThan(page.indexOf('id="wrong-facts"'));
    // Inside the dark panel, which is the last thing on the page.
    expect(page.indexOf("plan-dark")).toBeLessThan(page.indexOf('id="wrong-facts"'));
    expect(page).toContain("1 wrong fact: 1 in progress.");
    expect(page).toContain("In progress (1)");
    expect(page).toContain("Harbor Plumbing charges $49");
    expect(page).toContain("$89");
    expect(page).toContain("Emailed Yelp on Oct 14");
    expect(page).toContain("Note from Mirror");
    expect(page).toContain("Want us to fix these for you?");
  });

  it("never sends a free account the wrong facts, even when there are some", async () => {
    await db.update(schema.practices).set({ active: false }).where(eq(schema.practices.id, practiceId));
    await lostToRoseCity();
    await addWrongFee();
    const page = await html();
    expect(page).toContain("Get on yelp.com");
    for (const text of ['id="wrong-facts"', "Harbor Plumbing charges $49", "$89", "Emailed Yelp", "Want us to fix these for you?"]) {
      expect(page).not.toContain(text);
    }
  });

  it("says the scan is still running before a scan has finished, or while it has no answers", async () => {
    await db.insert(schema.scans).values({ practiceId, status: "running" });
    expect(await html()).toContain("Your scan is still running");
    await scanWith([]);
    const page = await html();
    expect(page).toContain("Your scan is still running");
    expect(page).not.toContain("Fix your website for AI");
  });

  it("has a short, positive word when the scan left nothing to do", async () => {
    await scanWith([{ mentioned: true, position: "first", answerText: "Harbor Plumbing is the one to call.", namedOrder: ["Harbor Plumbing"] }], null);
    const page = await html();
    expect(page).toContain("Nothing to do right now");
    expect(page).not.toContain("0 of 0 done");
  });

  it("calls the tab next steps, at the same address", async () => {
    await lostToRoseCity();
    const page = await html();
    expect(page).toMatch(/aria-current="page"[^>]*href="\/dashboard\/harbor\/fixes">Next steps<\/a>/);
    expect(page).not.toContain(">Fix plan<");
  });

  it("shows an operator the boxes but won't let them tick for the customer", async () => {
    role = "operator";
    await lostToRoseCity();
    const page = await html();
    expect(page).toContain("Disabled while viewing as admin");
    expect(page).toMatch(/<button[^>]*disabled=""[^>]*role="checkbox"/);
  });
});
