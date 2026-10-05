import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import { runScan } from "@/services/scan-runner";
import { buildAuditReportData } from "@/report/build-report";
import * as s from "@/report/scoring";
import type { EngineAdapter } from "@/engines/types";
import { practices, scans } from "@/db/schema";

async function scanned() {
  const db = await makeTestDb();
  const { practiceId } = await seedPractice(db, {
    name: "Glow MedSpa",
    prompts: [
      { text: "Best med spa in Santa Monica", kind: "category" },
      { text: "Cheap Botox Santa Monica", kind: "category" },
      { text: "Botox price at Glow MedSpa?", kind: "branded" },
      { text: "Is Glow MedSpa open Sunday?", kind: "branded" },
    ],
    facts: [
      { category: "pricing", label: "Botox price", value: "$13/unit" },
      { category: "logistics", label: "Sunday hours", value: "Closed Sundays" },
    ],
    competitors: ["Skin Bar LA"],
  });
  await db.update(practices).set({ category: "Med spa", location: "Santa Monica, CA", website: null });
  const answers: Record<string, { answer: string; citations: string[]; searchQueries?: string[] }> = {
    "Best med spa in Santa Monica": { answer: "Skin Bar LA is the top pick. Glow MedSpa is also good.",
      citations: ["https://yelp.com/best"], searchQueries: ["best med spa santa monica reviews"] },
    "Cheap Botox Santa Monica": { answer: "Skin Bar LA has deals.", citations: ["https://medspascout.com/x"],
      searchQueries: ["cheap botox santa monica prices"] },
    "Botox price at Glow MedSpa?": { answer: "Glow MedSpa charges $9/unit for Botox.", citations: ["https://oldblog.example/glow"] },
    "Is Glow MedSpa open Sunday?": { answer: "Glow MedSpa is closed on Sundays.", citations: [] },
  };
  const adapter = (name: EngineAdapter["name"]): EngineAdapter => ({ name, run: async p => answers[p] });
  const judge = async ({ answer }: { answer: string }) => ({
    wrong: answer.includes("$9")
      ? [{ claim: "Glow MedSpa charges $9/unit", factLabel: "Botox price", severity: "major" as const }] : [],
    right: answer.includes("Sundays") ? ["Sunday hours"] : [],
  });
  const rateTone = async () => ({ tone: "mixed" as const, reason: "Good, but pricey" });
  await runScan(db, practiceId, [adapter("openai"), adapter("perplexity")], judge, async () => [], { runs: 2, rateTone });
  return { db, practiceId };
}

describe("buildAuditReportData", () => {
  it("is null before any scan", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    expect(await buildAuditReportData(db, practiceId)).toBeNull();
  });

  it("maps a real scan into the report data model", async () => {
    const { db, practiceId } = await scanned();
    const r = (await buildAuditReportData(db, practiceId))!;

    expect(r.business).toMatchObject({ name: "Glow MedSpa", location: "Santa Monica, CA", category: "Med spa" });
    expect(r.scan).toMatchObject({ tools: ["chatgpt", "perplexity"], buyerQuestionCount: 2, brandedQuestionCount: 2, runsPerQuestion: 2 });

    // Tool totals add up to the client's leaderboard count (the design's invariant).
    const client = r.leaderboard.find(e => e.isClient)!;
    expect(r.toolResults.reduce((a, t) => a + t.named, 0)).toBe(client.count);
    expect(r.toolResults).toEqual([{ tool: "chatgpt", named: 2, total: 4 }, { tool: "perplexity", named: 2, total: 4 }]);
    expect(r.topCompetitor.name).toBe("Skin Bar LA");
    expect(r.topCompetitor.namedCount).toBe(8);

    // Grid: Skin Bar first; client 2nd on the first question, which is a closest win.
    const q1 = r.questions.find(q => q.text.startsWith("Best"))!;
    expect(q1.cells[0]).toMatchObject({ firstNamed: "Skin Bar LA", clientRank: 2, runsAppeared: 2 });
    expect(r.closestWins[0]).toMatchObject({ rank: 2, ahead: ["Skin Bar LA"] });

    // Facts: one wrong price (price first), one confirmed fact with no error.
    expect(s.sortedWrongFacts(r.facts)[0]).toMatchObject({ topic: "Botox price", isPrice: true, truth: "$13/unit", sources: ["oldblog.example"] });
    expect(r.facts.filter(f => f.isTrue).map(f => f.topic)).toEqual(["Sunday hours"]);

    // Sources and searches.
    expect(r.sources.competitorWinSites.map(x => x.domain)).toEqual(["medspascout.com"]);
    expect(r.sources.types.reduce((a, t) => a + t.pct, 0)).toBe(100);
    expect(r.searches.addedWords).toContain("reviews");
    expect(r.searches.pagesWanted.map(p => p.page)).toContain("A reviews and results page");

    // Tone, quotes, actions.
    expect(r.tone.mixed).toBeGreaterThan(0);
    expect(r.quotes.worst?.text).toMatch(/Glow MedSpa/);
    expect(r.actions[0].title).toMatch(/price/i);
    expect(r.topFixIds).toHaveLength(3);

    // Score components add up to the headline number through the design's maths.
    expect(r.scores.components.map(c => [c.id, c.weight])).toEqual([["named_often", 41], ["rank_high", 17], ["tool_reach", 12], ["accuracy", 30]]);
    expect(Math.abs(s.overallScore(r.scores.components) - r.scores.overall.value)).toBeLessThanOrEqual(1);
    expect(r.scores.factAccuracy).toBe(82);
    expect(r.scores.overall.explanation).toMatch(/^Overall = 70% visibility \(\d+\) \+ 30% fact accuracy \(82\) = \d+\.$/);
  });

  it("shows N/A and visibility-only weights when nothing was fact-checked", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", prompts: [{ text: "Best med spa", kind: "category" }] });
    await runScan(db, practiceId, [{ name: "openai", run: async () => ({ answer: "Glow MedSpa.", citations: [] }) }],
      async () => ({ wrong: [], right: [] }), async () => []);
    const r = (await buildAuditReportData(db, practiceId))!;
    expect(r.scores.factAccuracy).toBeNull();
    expect(r.scores.components.map(c => c.weight)).toEqual([59, 23, 18]);
    expect(r.scores.overall.explanation).toMatch(/No facts were checked/);
    expect(r.facts).toEqual([]);
  });

  it("lists only this scan's wrong facts, with plain truth text when no fact matched", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Glow MedSpa services?", kind: "branded" }],
      facts: [{ category: "services", label: "Lasers", value: "No laser treatments" }],
    });
    const say = (claim: string) => runScan(db, practiceId,
      [{ name: "openai", run: async () => ({ answer: "Glow MedSpa.", citations: [] }) }],
      async () => ({ wrong: [{ claim, factLabel: null, severity: "minor" as const }], right: [] }), async () => []);
    await say("Has a rooftop pool");
    await say("Offers dog grooming");
    const r = (await buildAuditReportData(db, practiceId))!;
    const wrong = r.facts.filter(f => !f.isTrue);
    expect(wrong.map(f => f.aiSaid)).toEqual(["Offers dog grooming"]);
    expect(wrong[0].truth).toBe("Your fact sheet doesn't back this up.");
  });

  it("doesn't count a fact as right when AI also got it wrong this scan", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }],
      facts: [{ category: "pricing", label: "Botox price", value: "$13/unit" }],
    });
    let n = 0;
    await runScan(db, practiceId, [{ name: "openai", run: async () => ({ answer: "Glow MedSpa.", citations: [] }) }],
      async () => n++ === 0
        ? { wrong: [], right: ["Botox price"] }
        : { wrong: [{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" as const }], right: [] },
      async () => [], { runs: 2, concurrency: 1 });
    const r = (await buildAuditReportData(db, practiceId))!;
    expect(r.facts.map(f => [f.topic, f.isTrue])).toEqual([["Botox price", false]]);
  });

  it("leaves the explanation out for an old scan with no visibility score", async () => {
    const { db, practiceId } = await scanned();
    await db.update(scans).set({ visibilityScore: null });
    const r = (await buildAuditReportData(db, practiceId))!;
    expect(r.scores.overall.explanation).toBe("");
  });

  it("carries the short-scan label, and none for a full scan", async () => {
    const { db, practiceId } = await scanned();
    expect((await buildAuditReportData(db, practiceId))!.scan.coverageNote).toBeNull();

    const db2 = await makeTestDb();
    const { practiceId: p2 } = await seedPractice(db2, { name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }] });
    const ok = (["openai", "anthropic", "perplexity"] as const).map(name =>
      ({ name, run: async () => ({ answer: "Glow MedSpa.", citations: [] }) }) as EngineAdapter);
    const down: EngineAdapter = { name: "gemini", run: async () => { throw new Error("down"); } };
    await runScan(db2, p2, [...ok, down], async () => ({ wrong: [], right: [] }), async () => [],
      { retryDelaysMs: [], finalRetryDelayMs: 0 });
    expect((await buildAuditReportData(db2, p2))!.scan.coverageNote).toBe("Based on 3 of 4 AI tools. Gemini didn't respond.");
  });

  it("rebuilds the ranking score for an older scan instead of showing 0", async () => {
    const { db, practiceId } = await scanned();
    await db.update(scans).set({ visibilityScore: null, factScore: null, citationRate: 31, positionScore: 16, breadthScore: 75, accuracyScore: 33 });
    const r = (await buildAuditReportData(db, practiceId))!;
    expect(r.scores.visibility).toBe(35);
    expect(r.scores.factAccuracy).toBe(33);
  });

  it("quotes a real answer that named a competitor but not them, and marks a paused account as a prospect", async () => {
    const { db, practiceId } = await scanned();
    const r = (await buildAuditReportData(db, practiceId))!;
    expect(r.missedQuote).toMatchObject({ question: "Cheap Botox Santa Monica", named: ["Skin Bar LA"] });
    expect(r.missedQuote!.text).toContain("Skin Bar LA");
    expect(r.prospect).toBe(false);
    await db.update(practices).set({ active: false });
    expect((await buildAuditReportData(db, practiceId))!.prospect).toBe(true);
  });
});
