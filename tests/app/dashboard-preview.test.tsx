import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import type { Db } from "@/db";
import { practices, scans } from "@/db/schema";
import { engineScores, shownScore } from "@/core/scoring";
import { getChecksForScan } from "@/lib/queries";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";

let db: Db;
let role: "client" | "operator" = "client";
// The same rule as the real requirePracticeView: a paused business is locked
// for everyone but an operator. Access itself is tested with the real one.
vi.mock("@/lib/auth", () => ({
  requirePracticeView: vi.fn(async (slug: string) => {
    const [practice] = await db.select().from(practices).where(eq(practices.slug, slug));
    return { practice, locked: !practice.active && role !== "operator" };
  }),
}));
const printed: string[] = [];
vi.mock("@/services/report-pdf", () => ({
  renderReportPdf: vi.fn(async (_r: unknown, variant: string) => { printed.push(variant); return Buffer.from("%PDF-fake"); }),
}));

import DashboardPage from "@/app/dashboard/[slug]/page";
import ReportsPage from "@/app/dashboard/[slug]/reports/page";
import AnswersPage from "@/app/dashboard/[slug]/answers/page";
import CompetitorsPage from "@/app/dashboard/[slug]/competitors/page";
import SourcesPage from "@/app/dashboard/[slug]/sources/page";
import AccuracyPage from "@/app/dashboard/[slug]/accuracy/page";
import FixListPage from "@/app/dashboard/[slug]/fixes/page";
import FactSheetPage from "@/app/dashboard/[slug]/fact-sheet/page";
import ForecastPage from "@/app/dashboard/[slug]/forecast/page";
import MonthlyPage from "@/app/dashboard/[slug]/report/page";
import { GET } from "@/app/dashboard/[slug]/reports/pdf/route";

const params = Promise.resolve({ slug: "harbor" });
const SECRET_ANSWER = "Rose City Plumbing is the one to call, and Harbor Plumbing charges $49.";
const answers: Record<string, string> = {
  "Best plumber in Portland": "Rose City Plumbing is the one most people recommend for repairs.",
  "Who fixes water heaters in Portland?": "Harbor Plumbing is a good choice for water heaters.",
  "Is Harbor Plumbing any good?": SECRET_ANSWER,
};
const adapter: EngineAdapter = { name: "openai", run: async p => ({ answer: answers[p], citations: ["https://secret-source.example/page"] }) };
const judge = async ({ answer }: { answer: string }) => ({
  wrong: answer.includes("$49") ? [{ claim: "Harbor Plumbing charges $49", factLabel: "Service call fee", severity: "major" as const }] : [],
  right: [],
});
const pdf = (variant: string) => GET(new NextRequest(`http://localhost/dashboard/harbor/reports/pdf?variant=${variant}`), { params });
const html = async (page: Promise<React.ReactElement>) => renderToStaticMarkup(await page);

describe("a prospect's dashboard before their call", () => {
  beforeEach(async () => {
    db = await makeTestDb();
    setDbForTests(db);
    role = "client";
    printed.length = 0;
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", slug: "harbor",
      prompts: [
        { text: "Best plumber in Portland", kind: "category" },
        { text: "Who fixes water heaters in Portland?", kind: "category" },
        { text: "Is Harbor Plumbing any good?", kind: "branded" },
      ],
      facts: [{ category: "pricing", label: "Service call fee", value: "$89" }],
      competitors: ["Rose City Plumbing"],
    });
    await db.update(practices).set({ active: false }).where(eq(practices.id, practiceId));
    await runScan(db, practiceId, [adapter], judge, async () => ["Rose City Plumbing"]);
  });

  it("shows the ranking, the top competitor and one answer they were left out of, and asks for the call", async () => {
    const page = await html(DashboardPage({ params }));
    expect(page).toContain("Recommended by AI");
    expect(page).toContain("1/2");
    expect(page).toContain("Rose City Plumbing");
    expect(page).toContain("An answer you were left out of");
    expect(page).toContain("Rose City Plumbing is the one most people recommend");
    expect(page).toContain("Unlocks after your call");
    expect(page).toContain("Book your call");
    expect(page).toContain('href="/dashboard/harbor/reports/pdf?variant=summary"');
  });

  it("shows the ranking on the 30-100 scale", async () => {
    const [scan] = await db.select().from(scans);
    const page = await html(DashboardPage({ params }));
    expect(page).toContain(`aria-label="Score ${shownScore(scan.visibilityScore)} out of 100"`);
  });

  it("keeps the unconfirmed fact check out of the summary", async () => {
    const page = await html(DashboardPage({ params }));
    // The "Wrong facts" tab is in the header for everyone; the count card under it is what must stay out.
    expect(page).not.toContain("What AI got wrong in the latest scan");
    expect(page).not.toContain("$49");
    expect(page).not.toContain("Trends");
  });

  it("counts the top competitor over buyer questions only, as the finished audit does", async () => {
    // Rose City is named in one buyer answer and in the branded one: 2 in all, 1 of the 2 buyer answers.
    const page = await html(DashboardPage({ params }));
    expect(page).toContain("Named 1 time, you 1");
    expect(page).not.toContain("Named 2 times");
  });

  it("links the summary to the sections a free account now gets, and keeps the fact check locked", async () => {
    const page = await html(DashboardPage({ params }));
    expect(page).toMatch(/href="\/dashboard\/harbor\/answers"[^>]*>[^<]*Every AI answer/);
    expect(page).toMatch(/href="\/dashboard\/harbor\/competitors"[^>]*>[^<]*Competitors and sources/);
    expect(page).toMatch(/href="\/dashboard\/harbor\/fixes"[^>]*>[^<]*Your recommendations/);
    // The fact check is the one thing still listed as locked.
    expect(page).toMatch(/Locked<\/span>.*Fact check/);
    expect(page).not.toMatch(/Locked<\/span>.*Every AI answer/);
  });

  it("gives a free account every buyer answer word for word, with nothing from the fact check", async () => {
    const page = await html(AnswersPage({ params }));
    expect(page).toContain('id="answers"');
    expect(page).toContain("Rose City Plumbing is the one most people recommend");
    expect(page).toContain("is a good choice for water heaters.");
    expect(page).toContain("secret-source.example");
    // The wrong facts, and the branded answer that holds an unconfirmed one, wait for the call.
    expect(page).not.toContain("$49");
    expect(page).not.toContain("$89");
    expect(page).not.toContain("Is Harbor Plumbing any good?");
    expect(page).not.toContain("wrong fact");
    expect(page).toContain("Unlocks after your call");
  });

  it("gives a free account who AI recommends instead, and the websites it reads", async () => {
    const page = await html(CompetitorsPage({ params }));
    expect(page).not.toContain("Unlocks after your call");
    expect(page).toContain("Who AI names most");
    expect(page).toContain("Rose City Plumbing");
    expect(page).toContain('id="sources"');
    expect(page).toContain("secret-source.example");
    expect(page).not.toContain("$49");
    await expect(SourcesPage({ params })).rejects.toMatchObject({ digest: expect.stringContaining("/dashboard/harbor/competitors#sources") });
  });

  it("gives a free account the step-by-step recommendations, leaving out every fix that rests on a wrong fact", async () => {
    const page = await html(FixListPage({ params }));
    expect(page).toContain("Your recommendations");
    expect(page).toContain("Get featured on secret-source.example");
    expect(page).toContain("Make your site a source AI quotes");
    expect(page).not.toContain("Correct the wrong facts at their source");
    expect(page).not.toContain("Fix your price everywhere it appears");
    expect(page).not.toContain("$49");
    expect(page).not.toContain("Service call fee");
    // The wrong-fact list itself is still locked.
    expect(page).toContain("Unlocks after your call");
  });

  it("keeps the fact check, the fact sheet, the forecast and the monthly report locked, with none of their data", async () => {
    const pages = [
      AccuracyPage({ params }), FactSheetPage({ params }), ForecastPage({ params }),
      MonthlyPage({ params, searchParams: Promise.resolve({}) }),
    ];
    for (const page of pages) {
      const out = await html(page);
      expect(out).toContain("Unlocks after your call");
      expect(out).toContain("Book your call");
      expect(out).not.toContain("$49");
      expect(out).not.toContain("$89");
      expect(out).not.toContain("secret-source.example");
    }
  });

  it("starts no scan when a free account opens the unlocked pages", async () => {
    const before = await db.select().from(scans);
    for (const page of [AnswersPage({ params }), CompetitorsPage({ params }), FixListPage({ params })]) await html(page);
    expect(await db.select().from(scans)).toHaveLength(before.length);
  });

  it("offers the summary report only", async () => {
    const page = await html(ReportsPage({ params }));
    expect(page).toContain('href="/dashboard/harbor/reports/pdf?variant=summary"');
    for (const v of ["visibility", "factcheck", "master"]) expect(page).not.toContain(`variant=${v}`);
    expect(page).not.toContain("the work log for the month");
    expect(page).toContain("Book your call");

    expect((await pdf("summary")).status).toBe(200);
    for (const v of ["visibility", "factcheck", "master"]) expect((await pdf(v)).status).toBe(404);
    expect(printed).toEqual(["summary"]);
  });

  it("opens everything once the business is unlocked", async () => {
    await db.update(practices).set({ active: true });
    const summary = await html(DashboardPage({ params }));
    expect(summary).toContain("Wrong facts");
    expect(summary).not.toContain("Unlocks after your call");
    // Accuracy and Sources are no longer tabs: once unlocked, each address
    // sends the customer to the tab that now holds it.
    await expect(AccuracyPage({ params })).rejects.toMatchObject({ digest: expect.stringContaining("/dashboard/harbor/answers#wrong-facts") });
    await expect(SourcesPage({ params })).rejects.toMatchObject({ digest: expect.stringContaining("/dashboard/harbor/competitors#sources") });
    const answers = await html(AnswersPage({ params }));
    expect(answers).not.toContain("Unlocks after your call");
    expect(answers).toContain('id="wrong-facts"');
    expect(answers).toContain("Harbor Plumbing charges $49");
    expect(answers).toContain("$89");
    const competitors = await html(CompetitorsPage({ params }));
    expect(competitors).toContain("Rose City Plumbing");
    expect(competitors).toContain('id="sources"');
    expect(competitors).toContain("secret-source.example");
    expect(await html(ReportsPage({ params }))).toContain("variant=master");
    expect((await pdf("master")).status).toBe(200);
  });

  it("shows every headline score, the maths line and each AI tool's score on the 30-100 scale once unlocked", async () => {
    await db.update(practices).set({ active: true });
    const [scan] = await db.select().from(scans);
    const page = await html(DashboardPage({ params }));
    const rings = `Overall ${shownScore(scan.score)} out of 100, Recommended by AI ${shownScore(scan.visibilityScore)} out of 100, Accuracy ${shownScore(scan.factScore)} out of 100`;
    expect(page).toContain(rings);
    expect(page).toContain(`= ${shownScore(scan.score)}`);
    const tool = engineScores(await getChecksForScan(db, scan.id))[0];
    expect(await html(AnswersPage({ params }))).toContain(`ChatGPT ${shownScore(tool.score)} out of 100`);
  });

  it("never locks an operator out", async () => {
    role = "operator";
    expect(await html(DashboardPage({ params }))).toContain("Wrong facts");
    expect((await pdf("master")).status).toBe(200);
  });
});
