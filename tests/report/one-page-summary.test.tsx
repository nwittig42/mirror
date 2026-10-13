import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import sample from "@/report/sample-audit.json";
import type { AuditReport } from "@/report/types";
import { actionsFor, variantPages } from "@/report/scoring";
import { ReportSheets } from "@/report/report-view";

const base = sample as unknown as AuditReport;
const html = (r: AuditReport) => renderToStaticMarkup(<ReportSheets report={r} variant="summary" />)
  .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const named = base.leaderboard.find(e => e.isClient)!.count;
const answers = base.scan.buyerQuestionCount * base.scan.runsPerQuestion * base.scan.tools.length;

describe("one-page summary report", () => {
  it("is its own one-page version", () => {
    expect(variantPages.summary).toEqual(["one_page"]);
    expect(html(base).match(/class="report-page"/g)).toHaveLength(1);
  });

  it("leads with you vs. the top competitor and a real AI quote, in plain words", () => {
    const h = html(base);
    expect(h).toContain(`You came up in ${named} of ${answers}`);
    expect(h).toContain(`${base.topCompetitor.name} came up in ${base.topCompetitor.namedCount}`);
    expect(h).toContain(base.missedQuote!.question);
    expect(h).toContain(base.missedQuote!.text);
    expect(h).toContain("Why this matters");
    for (const a of actionsFor(base.prospect ? "visibility" : "master", base).slice(0, 3)) expect(h).toContain(a.title);
    expect(h.replace(/<[^>]+>/g, " ")).not.toMatch(/visibility|citation|prompt/i);
  });

  it("for a prospect, holds back the fact check until the call", () => {
    const h = html({ ...base, prospect: true });
    expect(h).toContain("After our call");
    expect(h).toMatch(/set up your fact sheet/i);
    for (const f of base.facts.filter(f => !f.isTrue)) expect(h).not.toContain(f.aiSaid!);
  });

  it("for a customer, shows the fact check score", () => {
    const h = html({ ...base, prospect: false });
    expect(h).not.toContain("After our call");
    expect(h.replace(/<[^>]+>/g, "")).toContain(`${base.scores.factAccuracy}/100`);
    for (const name of ["Overall", "Recommended by AI", "Accuracy"]) expect(h).toContain(name);
  });
});
