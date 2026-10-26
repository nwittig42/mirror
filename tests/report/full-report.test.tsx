import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import sample from "@/report/sample-audit.json";
import type { AuditReport } from "@/report/types";
import { sortedWrongFacts, variantPages } from "@/report/scoring";
import { PAGE_COMPONENTS } from "@/report/pages";
import { ReportSheets } from "@/report/report-view";

const base = sample as unknown as AuditReport;
const html = (r: AuditReport) => renderToStaticMarkup(<ReportSheets report={r} variant="master" />)
  .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const words = (h: string) => h.replace(/<[^>]+>/g, " ");
const sheets = (h: string) => h.match(/class="report-page"/g)?.length ?? 0;

describe("full report", () => {
  it("is seven pages, each with a component, and the sample fits them with no extra sheets", () => {
    expect(variantPages.master).toEqual(["overview", "score_and_tools", "competitors", "wrong_facts", "sources", "action_plan", "closing"]);
    for (const id of [...variantPages.master, ...variantPages.summary]) expect(PAGE_COMPONENTS[id]).toBeTypeOf("function");
    expect(sheets(html(base))).toBe(7);
  });

  it("names the three scores the way the rest of the product does, in plain words", () => {
    const text = words(html(base));
    for (const name of ["Overall", "Recommended by AI", "Accuracy"]) expect(text).toContain(name);
    expect(text).not.toMatch(/visibility|fact accuracy|citation|prompt|patient|practice/i);
    expect(text).not.toMatch(/[—!]/);
  });

  it("builds the score from the 30 every business starts with plus the parts, and says so", () => {
    const text = words(html(base)).replace(/\s+/g, " ");
    // Page 2: the rows add up to the 59 in the centre: 30 + 4 + 4 + 6 + 15.
    expect(text).toContain("Starting points");
    expect(text).toContain("30 of 30 points");
    for (const [got, of] of [[4, 29], [4, 12], [6, 8], [15, 21]]) expect(text).toContain(`${got} of ${of} points`);
    expect(text).toMatch(/59 of 100 points/);
    // The glossary explains it plainly.
    expect(text).toContain("Every business starts at 30. The other 70 points come from");
  });

  it("shows every wrong fact with the truth and how to fix it", () => {
    const h = html(base);
    for (const f of sortedWrongFacts(base.facts)) {
      expect(h).toContain(f.aiSaid!);
      expect(h).toContain(f.truth);
      expect(h).toContain(f.fix!);
    }
    expect(h).toContain("How to fix it:");
  });

  it("covers who AI recommends, the sites it relies on, the plan and the next step", () => {
    const h = html(base);
    expect(h).toContain(base.topCompetitor.name);
    for (const o of base.sources.competitorWinSites.slice(0, 5)) expect(h).toContain(o.domain);
    for (const a of base.actions.slice(0, 8)) expect(h).toContain(a.title);
    expect(h).toContain("How we measured this");
    expect(h).toContain(`href="${base.contact.bookingUrl}"`);
  });

  it("adds one line about Google's AI Overviews only when the scan has them", () => {
    expect(words(html(base))).not.toContain("AI Overview");
    const text = words(html({ ...base, aiOverviews: { asked: 8, shown: 6, namedIn: 2 } })).replace(/\s+/g, " ");
    expect(text).toContain("Google showed an AI Overview for 6 of 8 customer questions and named you in 2.");
  });

  it("supports a sixth AI tool", () => {
    const six: AuditReport = {
      ...base,
      scan: { ...base.scan, tools: [...base.scan.tools, "google"] },
      toolResults: [...base.toolResults, { tool: "google", named: 0, total: 15 }],
    };
    expect(words(html(six))).toContain("Google AI");
  });

  it("puts long lists on continuation sheets instead of dropping rows", () => {
    const wrong = base.facts.filter(f => !f.isTrue);
    const many: AuditReport = {
      ...base,
      facts: [...wrong, ...wrong, ...wrong].map((f, i) => ({ ...f, id: `w${i}`, topic: `Topic ${i}` })),
      actions: [...base.actions, ...base.actions, ...base.actions].map((a, i) => ({ ...a, id: `x${i}`, title: `Action ${i}` })),
    };
    const h = html(many);
    expect(sheets(h)).toBeGreaterThan(7);
    for (let i = 0; i < 9; i++) expect(h).toContain(`Topic ${i}`);
    for (let i = 0; i < many.actions.length; i++) expect(h).toContain(`>Action ${i}<`);
  });

  it("still renders with nothing to show", () => {
    const empty: AuditReport = {
      ...base, facts: [], actions: [], topFixIds: [], questions: [], leaderboard: [], websiteChecks: [], plan90: [],
      scores: { ...base.scores, factAccuracy: null },
      sources: { types: [], topSites: [], competitorWinSites: [], ownSiteCitedPct: 0 },
    };
    expect(sheets(html(empty))).toBe(7);
  });
});
