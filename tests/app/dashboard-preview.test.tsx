import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import type { Db } from "@/db";
import { practices } from "@/db/schema";
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
    expect(page).toContain("Your ranking");
    expect(page).toContain("1/2");
    expect(page).toContain("Rose City Plumbing");
    expect(page).toContain("An answer you were left out of");
    expect(page).toContain("Rose City Plumbing is the one most people recommend");
    expect(page).toContain("Unlocks after your call");
    expect(page).toContain("Book your call");
    expect(page).toContain('href="/dashboard/harbor/reports/pdf?variant=summary"');
  });

  it("keeps the unconfirmed fact check out of the summary", async () => {
    const page = await html(DashboardPage({ params }));
    expect(page).not.toContain("Wrong facts");
    expect(page).not.toContain("$49");
    expect(page).not.toContain("Trends");
  });

  it("sends none of a locked section's data to the browser", async () => {
    const pages = [
      AnswersPage({ params }), CompetitorsPage({ params }), SourcesPage({ params }), AccuracyPage({ params }),
      MonthlyPage({ params, searchParams: Promise.resolve({}) }),
    ];
    for (const page of pages) {
      const out = await html(page);
      expect(out).toContain("Unlocks after your call");
      expect(out).toContain("Book your call");
      expect(out).not.toContain("$49");
      expect(out).not.toContain("secret-source.example");
      expect(out).not.toContain("Rose City Plumbing");
    }
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
    expect(await html(AccuracyPage({ params }))).not.toContain("Unlocks after your call");
    expect(await html(ReportsPage({ params }))).toContain("variant=master");
    expect((await pdf("master")).status).toBe(200);
  });

  it("never locks an operator out", async () => {
    role = "operator";
    expect(await html(DashboardPage({ params }))).toContain("Wrong facts");
    expect((await pdf("factcheck")).status).toBe(200);
  });
});
