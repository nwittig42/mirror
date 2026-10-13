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
import { VARIANT_INFO, isVariant, pageCountLabel, pdfFileName } from "@/report/scoring";

let db: Db;
// Access is requirePracticeAccess's job and is tested with it; here it just
// hands back the business the page was asked for.
vi.mock("@/lib/auth", () => ({
  requirePracticeView: vi.fn(async (slug: string) => ({
    practice: (await db.select().from(practices).where(eq(practices.slug, slug)))[0], locked: false,
  })),
}));
const printed: string[] = [];
vi.mock("@/services/report-pdf", () => ({
  renderReportPdf: vi.fn(async (_report: unknown, variant: string) => { printed.push(variant); return Buffer.from("%PDF-fake"); }),
}));

import ReportsPage from "@/app/dashboard/[slug]/reports/page";
import { GET } from "@/app/dashboard/[slug]/reports/pdf/route";

const params = Promise.resolve({ slug: "harbor" });
const adapter: EngineAdapter = { name: "openai", run: async () => ({ answer: "Harbor Plumbing is a good choice.", citations: [] }) };
const scan = (practiceId: string) => runScan(db, practiceId, [adapter], async () => ({ wrong: [], right: [] }), async () => []);
const pdf = (variant: string) => GET(new NextRequest(`http://localhost/dashboard/harbor/reports/pdf?variant=${variant}`), { params });

// The list of reports is src/report's to decide. These hold for whatever it
// lists: the last one is the fullest, and each has a page count and a file name.
const full = VARIANT_INFO[VARIANT_INFO.length - 1];
const fullFileLabel = full.label.toLowerCase().replace(/\s+/g, "-");

describe("the reports on offer", () => {
  it("names each one once, with its page count and a file name for its PDF", () => {
    const keys = VARIANT_INFO.map(v => v.key);
    expect(keys[0]).toBe("summary");
    expect(keys).toContain("master");
    expect(new Set(keys).size).toBe(keys.length);
    expect(pageCountLabel("summary")).toBe("1 page");
    expect(pageCountLabel(full.key)).toMatch(/^\d+ pages$/);
    for (const key of keys) expect(isVariant(key)).toBe(true);
    expect(isVariant("everything")).toBe(false);
    expect(isVariant(null)).toBe(false);
    expect(pdfFileName("harbor", full.key, "2026-10-12")).toBe(`harbor-${fullFileLabel}-2026-10-12.pdf`);
  });
});

describe("customer Reports tab", () => {
  let practiceId: string;
  beforeEach(async () => {
    db = await makeTestDb();
    setDbForTests(db);
    printed.length = 0;
    ({ practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", slug: "harbor", prompts: [{ text: "Best plumber in Portland", kind: "category" }],
    }));
  });

  it("says the reports are on their way before the first scan", async () => {
    const html = renderToStaticMarkup(await ReportsPage({ params }));
    expect(html).toContain("Your reports appear here when it finishes");
    expect(html).not.toContain("Download PDF");
  });

  it("offers every report to open and to download once a scan is in", async () => {
    await scan(practiceId);
    const html = renderToStaticMarkup(await ReportsPage({ params }));
    for (const v of VARIANT_INFO) {
      expect(html).toContain(`href="/dashboard/harbor/audit?variant=${v.key}"`);
      expect(html).toContain(`href="/dashboard/harbor/reports/pdf?variant=${v.key}"`);
    }
    expect(html).toContain('href="/dashboard/harbor/report"');
  });

  it("sends the chosen report as a PDF file", async () => {
    await scan(practiceId);
    const res = await pdf(full.key);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition"))
      .toMatch(new RegExp(`^attachment; filename="harbor-${fullFileLabel}-\\d{4}-\\d{2}-\\d{2}\\.pdf"$`));
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("%PDF-fake");
    expect(printed).toEqual([full.key]);
  });

  it("has no PDF for an unknown report or before the first scan", async () => {
    expect((await pdf("master")).status).toBe(404);
    await scan(practiceId);
    expect((await pdf("everything")).status).toBe(404);
    expect(printed).toEqual([]);
  });
});
