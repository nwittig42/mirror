import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import { runScan, SCAN_DEADLINE_MS, startScan, gatherStep, finishScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";
import { EngineError } from "@/engines/types";
import { eq } from "drizzle-orm";
import { getLatestScan, scanStartedWithin } from "@/lib/queries";
import { competitors, findings as findingsTable, scans as scansTable, scanAnswers } from "@/db/schema";
import type { Db } from "@/db";
import type { WebsiteCheckResult } from "@/core/website-check";

const clean = async () => ({ wrong: [], right: [] });

const fakeAdapter = (name: string, answer: string): EngineAdapter =>
  ({ name: name as EngineAdapter["name"], run: async () => ({ answer, citations: ["https://x.example"] }) });

describe("runScan", () => {
  it("runs a full scan, stores checks and findings, snapshots score", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [
        { text: "Best med spa in Santa Monica for Botox", kind: "category" },
        { text: "How much does Botox cost at Glow MedSpa?", kind: "branded" },
      ],
      facts: [{ category: "pricing", label: "Botox price", value: "$13/unit" }],
      competitors: ["Skin Bar LA"],
    });
    const adapters = [
      fakeAdapter("openai", "Skin Bar LA and Glow MedSpa are both good. Botox at Glow MedSpa is $9/unit."),
      fakeAdapter("perplexity", "Glow MedSpa tops the list."),
    ];
    const fakeJudge = async () =>
      ({ wrong: [{ claim: "Botox at Glow MedSpa is $9/unit", factLabel: "Botox price", severity: "major" as const }], right: [] });
    const { scanId, score } = await runScan(db, practiceId, adapters, fakeJudge, async () => []);
    expect(scanId).toBeTruthy();
    const checks = await db.query.checks.findMany();
    expect(checks).toHaveLength(4); // 2 prompts × 2 adapters
    const findings = await db.query.findings.findMany();
    expect(findings.length).toBeGreaterThanOrEqual(1); // judge fired on branded checks
    expect(findings[0].status).toBe("open");
    expect(score).toBeGreaterThan(0);
    const scan = await db.query.scans.findFirst();
    expect(scan?.status).toBe("complete");
    const activities = await db.query.activities.findMany();
    const completion = activities.find(a => a.description.startsWith("Weekly scan complete"));
    expect(completion).toBeDefined();
    // The one automatic entry the client is meant to read: it keeps their work
    // log from being empty between the operator's hand-written lines.
    expect(completion?.visibility).toBe("client");
  });

  it("keeps engine-failure warnings out of the client's work log", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
    });
    const broken: EngineAdapter = {
      name: "gemini" as EngineAdapter["name"],
      run: async () => { throw new Error("rate limited"); },
    };
    const ok = ["openai", "anthropic", "perplexity"].map(n => fakeAdapter(n, "Glow MedSpa is great."));
    await runScan(db, practiceId, [...ok, broken], clean, async () => []);

    const activities = await db.query.activities.findMany();
    const warning = activities.find(a => a.description.startsWith("scan warning:"));
    expect(warning).toBeDefined();
    expect(warning?.visibility).toBe("internal");
  });

  it("survives one engine failing", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
      facts: [],
      competitors: [],
    });
    const failing: EngineAdapter = { name: "gemini", run: async () => { throw new Error("boom"); } };
    const ok = ["openai", "anthropic", "perplexity"].map(n => fakeAdapter(n, "Glow MedSpa"));
    const { score } = await runScan(db, practiceId, [...ok, failing], clean, async () => []);
    expect((await db.query.checks.findMany())).toHaveLength(3);
    expect(score).toBeGreaterThan(0);
    const activities = await db.query.activities.findMany();
    expect(activities.some(a => a.description === "scan warning: gemini failed on prompt Best med spa in Santa Monica")).toBe(true);
  });

  it("survives a judge failure and still completes the scan", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "How much does Botox cost at Glow MedSpa?", kind: "branded" }],
      facts: [{ category: "pricing", label: "Botox price", value: "$13/unit" }],
      competitors: [],
    });
    const adapters = [fakeAdapter("openai", "Botox at Glow MedSpa is $9/unit.")];
    const throwingJudge = async (): Promise<never> => { throw new Error("judge blew up"); };
    const { scanId, score } = await runScan(db, practiceId, adapters, throwingJudge, async () => []);
    expect(scanId).toBeTruthy();
    // The only prompt here is branded, and branded prompts are excluded from
    // the visibility terms (they name the practice in the question, so the
    // answer names it back regardless). With no non-branded check to score,
    // there is no visibility evidence and the score is 0. See computeScore.
    expect(score).toBe(0);
    const scan = await db.query.scans.findFirst();
    expect(scan?.status).toBe("complete");
    // A judge failure is "unknown", not "clean": nothing was judged, so N/A.
    expect(scan?.factScore).toBeNull();
    const findings = await db.query.findings.findMany();
    expect(findings).toHaveLength(0);
    const activities = await db.query.activities.findMany();
    expect(activities.some(a =>
      a.description === "scan warning: judge failed on prompt How much does Botox cost at Glow MedSpa?"
    )).toBe(true);
  });
});

describe("runScan competitor discovery", () => {
  it("ranks the practice against competitors the extractor found, not just the typed list", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
      competitors: ["Skin Bar LA"],
    });
    // "Skin Bar LA and Glow MedSpa" is two known names joined by a
    // conjunction: a list, which the longer-name guard leaves alone.
    const answer = "Nuvo Aesthetics is the top pick. Skin Bar LA and Glow MedSpa are also good.";
    const extractor = async () => ["Nuvo Aesthetics", "Glow MedSpa"];
    await runScan(db, practiceId, [fakeAdapter("openai", answer)], clean, extractor);

    const [check] = await db.query.checks.findMany();
    expect(check.position).toBe("top3");   // third, not "top3 behind one" as the typed list alone would say
    expect(check.competitorsMentioned).toEqual(["Nuvo Aesthetics", "Skin Bar LA"]);
    expect(check.namedOrder).toEqual(["Nuvo Aesthetics", "Skin Bar LA", "Glow MedSpa"]);

    const rows = await db.query.competitors.findMany();
    const nuvo = rows.find(r => r.name === "Nuvo Aesthetics");
    expect(nuvo?.source).toBe("discovered");
    expect(rows.find(r => r.name === "Skin Bar LA")?.source).toBe("operator");
    expect(rows.some(r => r.name === "Glow MedSpa")).toBe(false);
  });

  it("remembers a discovered competitor across checks within one scan without duplicating it", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [
        { text: "Best med spa in Santa Monica", kind: "category" },
        { text: "Where to get Botox in Santa Monica", kind: "category" },
      ],
    });
    const extractor = async () => ["Nuvo Aesthetics"];
    await runScan(db, practiceId, [fakeAdapter("openai", "Nuvo Aesthetics wins.")], clean, extractor);
    const rows = await db.query.competitors.findMany();
    expect(rows.filter(r => r.name === "Nuvo Aesthetics")).toHaveLength(1);
  });

  it("does not resurrect a competitor the operator hid", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
    });
    await db.insert(competitors).values({ practiceId, name: "Yelp", source: "discovered", status: "ignored" });
    const extractor = async () => ["Yelp"];
    await runScan(db, practiceId, [fakeAdapter("openai", "Check Yelp.")], clean, extractor);
    const rows = await db.query.competitors.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("ignored");
    const [check] = await db.query.checks.findMany();
    expect(check.competitorsMentioned).toEqual([]);
  });

  it("survives an extractor failure by falling back to the known list", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
      competitors: ["Skin Bar LA"],
    });
    const extractor = async (): Promise<never> => { throw new Error("extractor blew up"); };
    const { score } = await runScan(
      db, practiceId, [fakeAdapter("openai", "Skin Bar LA then Glow MedSpa.")], clean, extractor,
    );
    expect(score).toBeGreaterThan(0);
    const [check] = await db.query.checks.findMany();
    expect(check.competitorsMentioned).toEqual(["Skin Bar LA"]);
    const activities = await db.query.activities.findMany();
    expect(activities.some(a =>
      a.description === "scan warning: competitor extraction failed on prompt Best med spa in Santa Monica (openai)"
    )).toBe(true);
  });
});

describe("runScan competitor discovery hygiene", () => {
  it("ignores a discovered name that does not literally appear in the answer", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
    });
    const extractor = async () => ["Nurse Jamie's practice", "Skin Bar LA"];
    await runScan(db, practiceId, [fakeAdapter("openai", "Nurse Jamie and Skin Bar LA are popular.")], clean, extractor);
    const rows = await db.query.competitors.findMany();
    expect(rows.map(r => r.name)).toEqual(["Skin Bar LA"]);
  });

  it("tells the extractor which competitors are already known so it can reuse their spelling", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
      competitors: ["Skin Bar LA"],
    });
    const seen: string[][] = [];
    const extractor = async (args: { answer: string; businessNames: string[]; knownCompetitors: string[] }) => {
      seen.push(args.knownCompetitors);
      return [];
    };
    await runScan(db, practiceId, [fakeAdapter("openai", "x")], clean, extractor);
    expect(seen[0]).toEqual(["Skin Bar LA"]);
  });
});

describe("runScan repeat runs and scores", () => {
  it("asks every prompt `runs` times and records a score band", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
    });
    // Named on runs 1 and 3, missed on run 2: the band should show the spread.
    let call = 0;
    const flaky: EngineAdapter = {
      name: "openai",
      run: async () => ({ answer: ++call === 2 ? "Skin Bar LA is best." : "Glow MedSpa is best.", citations: [] }),
    };
    await runScan(db, practiceId, [flaky], clean, async () => [], { runs: 3, concurrency: 1 });

    const rows = await db.query.checks.findMany();
    expect(rows.map(r => r.run).sort()).toEqual([1, 2, 3]);
    const scan = await db.query.scans.findFirst();
    expect(scan?.runs).toBe(3);
    expect(scan?.scoreLow).toBe(0);
    expect(scan?.scoreHigh).toBeGreaterThan(0);
    expect(scan!.score!).toBeGreaterThanOrEqual(scan!.scoreLow!);
    expect(scan!.score!).toBeLessThanOrEqual(scan!.scoreHigh!);
    expect(scan?.visibilityScore).toBeGreaterThan(0);
  });

  it("records one finding for a wrong claim repeated across runs", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "How much is Botox at Glow MedSpa?", kind: "branded" }],
      facts: [{ category: "pricing", label: "Botox price", value: "$13/unit" }],
    });
    const judge = async () => ({ wrong: [{ claim: "Botox is $9/unit", factLabel: "Botox price", severity: "major" as const }], right: [] });
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa Botox is $9/unit.")], judge, async () => [],
      { runs: 3 });
    expect(await db.query.findings.findMany()).toHaveLength(1);
    const scan = await db.query.scans.findFirst();
    // One major price error: 100 - 12 × 1.5.
    expect(scan?.factScore).toBe(82);
  });

  it("leaves the fact score empty when nothing was judged", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa", kind: "category" }],
    });
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], clean, async () => []);
    const scan = await db.query.scans.findFirst();
    expect(scan?.factScore).toBeNull();
  });

  it("retries a rate-limited engine instead of losing the answer", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa", kind: "category" }],
    });
    let attempts = 0;
    const limited: EngineAdapter = {
      name: "gemini",
      run: async () => {
        if (++attempts < 3) throw new EngineError("gemini", 429, "slow down");
        return { answer: "Glow MedSpa.", citations: [] };
      },
    };
    await runScan(db, practiceId, [limited], clean, async () => [], { retryDelaysMs: [0, 0] });
    expect(attempts).toBe(3);
    expect(await db.query.checks.findMany()).toHaveLength(1);
  });

  it("does not retry an error that will not go away", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa", kind: "category" }],
    });
    let attempts = 0;
    const badKey: EngineAdapter = {
      name: "openai",
      run: async () => { attempts++; throw new EngineError("openai", 401, "bad key"); },
    };
    await runScan(db, practiceId, [badKey], clean, async () => [], { retryDelaysMs: [0, 0] });
    expect(attempts).toBe(1);
  });
});

describe("runScan searches and tone", () => {
  it("stores each answer's searches and rates tone only when the practice is named", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [
        { text: "Best med spa", kind: "category" },
        { text: "Cheapest med spa", kind: "category" },
      ],
    });
    const adapter: EngineAdapter = {
      name: "openai",
      run: async (p) => p.startsWith("Best")
        ? { answer: "Glow MedSpa is great.", citations: [], searchQueries: ["best med spa reviews"] }
        : { answer: "Skin Bar is cheapest.", citations: [] },
    };
    const rated: string[] = [];
    const rateTone = async (args: { answer: string }) => {
      rated.push(args.answer);
      return { tone: "positive" as const, reason: "Called great" };
    };
    await runScan(db, practiceId, [adapter], clean, async () => [], { rateTone });

    expect(rated).toEqual(["Glow MedSpa is great."]);
    const rows = await db.query.checks.findMany();
    const named = rows.find(r => r.mentioned)!;
    expect(named).toMatchObject({ searchQueries: ["best med spa reviews"], tone: "positive", toneReason: "Called great" });
    const unnamed = rows.find(r => !r.mentioned)!;
    expect(unnamed).toMatchObject({ searchQueries: [], tone: null });
  });

  it("leaves tone empty when the rater fails, without failing the scan", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }] });
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], clean, async () => [],
      { rateTone: async () => { throw new Error("down"); } });
    const [row] = await db.query.checks.findMany();
    expect(row.tone).toBeNull();
    expect((await db.query.scans.findFirst())?.status).toBe("complete");
  });
});

describe("runScan fact-checking", () => {
  const botox = { category: "pricing" as const, label: "Botox price", value: "$13/unit" };

  it("judges a category answer that names the business, but not one that doesn't", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa", kind: "category" }, { text: "Cheap Botox", kind: "category" }],
      facts: [botox],
    });
    const seen: string[] = [];
    const judge = async ({ answer }: { answer: string }) => { seen.push(answer); return { wrong: [], right: [] }; };
    const adapter: EngineAdapter = { name: "openai", run: async p => ({
      answer: p === "Best med spa" ? "Glow MedSpa is great." : "Skin Bar LA has deals.", citations: [] }) };
    await runScan(db, practiceId, [adapter], judge, async () => []);
    expect(seen).toEqual(["Glow MedSpa is great."]);
  });

  it("doesn't judge anything when there is no fact sheet", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }],
    });
    let calls = 0;
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa Botox is $9.")],
      async () => { calls++; return { wrong: [], right: [] }; }, async () => []);
    expect(calls).toBe(0);
    expect((await db.query.scans.findFirst())?.factScore).toBeNull();
  });

  it("collapses a reworded error across runs into one finding at its worst severity", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }], facts: [botox],
    });
    const wordings = [
      { claim: "Botox is $9/unit", severity: "minor" as const },
      { claim: "They charge nine dollars a unit", severity: "major" as const },
      { claim: "Botox runs $9 per unit", severity: "minor" as const },
    ];
    let i = 0;
    const judge = async () => ({ wrong: [{ ...wordings[i++ % 3], factLabel: "Botox price" }], right: [] });
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa Botox is $9.")], judge, async () => [],
      { runs: 3, concurrency: 1 });
    const rows = await db.query.findings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe("major");
    expect((await db.query.scans.findFirst())?.factScore).toBe(82); // 100 − 12 × 1.5
  });

  it("stores the facts AI got right, dropping unknown labels", async () => {
    const db = await makeTestDb();
    const { practiceId, factIds } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }], facts: [botox],
    });
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa Botox is $13.")],
      async () => ({ wrong: [], right: ["Botox price", "Made-up label"] }), async () => []);
    const [check] = await db.query.checks.findMany();
    expect(check.factsConfirmed).toEqual([factIds[0]]);
  });

  it("updates the open finding on a re-scan instead of adding another, and counts only this scan", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }],
      facts: [botox, { category: "services", label: "Lasers", value: "No laser treatments" }],
    });
    const run = (wrong: { claim: string; factLabel: string; severity: "major" | "critical" }[]) =>
      runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], async () => ({ wrong, right: [] }), async () => []);

    await run([{ claim: "Offers laser hair removal", factLabel: "Lasers", severity: "critical" }]);
    const second = await run([{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" }]);

    const rows = await db.query.findings.findMany();
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.status === "open")).toBe(true); // never auto-closed
    const scan = await db.query.scans.findFirst({ where: eq(scansTable.id, second.scanId) });
    // Only the price error was seen this scan: the old critical costs nothing and doesn't cap.
    expect(scan?.factScore).toBe(82);
    expect(second.newFindings).toHaveLength(1);

    const third = await run([{ claim: "Botox costs nine dollars", factLabel: "Botox price", severity: "major" }]);
    expect(await db.query.findings.findMany()).toHaveLength(2);
    expect(third.newFindings).toHaveLength(0);
    const price = (await db.query.findings.findMany()).find(r => r.claim === "Botox is $9");
    expect(price?.lastSeenScanId).toBe(third.scanId);
  });

  it("doesn't bring back a dismissed finding, but does reopen a fixed one that recurs", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }],
      facts: [botox, { category: "services", label: "Lasers", value: "No laser treatments" }],
    });
    const both = async () => ({ wrong: [
      { claim: "Botox is $9", factLabel: "Botox price", severity: "major" as const },
      { claim: "Offers lasers", factLabel: "Lasers", severity: "critical" as const },
    ], right: [] });
    const scanOnce = () => runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], both, async () => []);

    await scanOnce();
    await db.update(findingsTable).set({ status: "dismissed" }).where(eq(findingsTable.claim, "Botox is $9"));
    await db.update(findingsTable).set({ status: "fixed" }).where(eq(findingsTable.claim, "Offers lasers"));

    const again = await scanOnce();
    const rows = await db.query.findings.findMany();
    expect(rows).toHaveLength(3); // the fixed laser error came back as a new open finding
    expect(again.newFindings.map(f => f.claim)).toEqual(["Offers lasers"]);
    const scan = await db.query.scans.findFirst({ where: eq(scansTable.id, again.scanId) });
    expect(scan?.factScore).toBe(75); // only the critical: the dismissed price error costs nothing
  });

  it("matches a legacy open finding (no last-seen scan) by its fact", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }], facts: [botox],
    });
    const judge = async () => ({ wrong: [{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" as const }], right: [] });
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], judge, async () => []);
    await db.update(findingsTable).set({ lastSeenScanId: null });
    const quiet = await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], clean, async () => []);
    expect((await db.query.scans.findFirst({ where: eq(scansTable.id, quiet.scanId) }))?.factScore).toBe(100);
    const again = await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], judge, async () => []);
    expect(await db.query.findings.findMany()).toHaveLength(1);
    expect(again.newFindings).toHaveLength(0);
  });

  it("stores overall as 70% visibility + 30% facts", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa", kind: "category" }, { text: "Botox at Glow MedSpa?", kind: "branded" }],
      facts: [botox],
    });
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa is the best.")],
      async () => ({ wrong: [{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" as const }], right: [] }),
      async () => []);
    const scan = await db.query.scans.findFirst();
    expect(scan?.factScore).toBe(82);
    expect(scan?.score).toBe(Math.round(0.7 * scan!.visibilityScore! + 0.3 * 82));
    expect(scan?.accuracyScore).toBeNull();
  });

  it("matches a legacy finding saved without its fact by the claim, and links it", async () => {
    const db = await makeTestDb();
    const { practiceId, factIds } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }], facts: [botox],
    });
    const claim = "Botox is $9/unit";
    const first = await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")],
      async () => ({ wrong: [{ claim, factLabel: null, severity: "major" as const }], right: [] }), async () => []);
    // What the old label bug stored: no fact, no last-seen scan.
    await db.update(findingsTable).set({ lastSeenScanId: null });
    const again = await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")],
      async () => ({ wrong: [{ claim: "Botox is $9 / unit.", factLabel: "Botox price", severity: "major" as const }], right: [] }),
      async () => []);
    const rows = await db.query.findings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].factId).toBe(factIds[0]);
    expect(rows[0].lastSeenScanId).toBe(again.scanId);
    expect(again.newFindings).toHaveLength(0);
    expect(first.newFindings).toHaveLength(1);
  });
});

describe("runScan coverage", () => {
  const fast = { retryDelaysMs: [], finalRetryDelayMs: 0 };
  const down = (name: EngineAdapter["name"]): EngineAdapter =>
    ({ name, run: async () => { throw new EngineError(name, 503, "down"); } });

  it("gives a flaky call one more try at the end", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }] });
    let calls = 0;
    const flaky: EngineAdapter = { name: "openai", run: async () => {
      if (++calls === 1) throw new EngineError("openai", 503, "blip");
      return { answer: "Glow MedSpa.", citations: [] };
    } };
    const r = await runScan(db, practiceId, [flaky], clean, async () => [], fast);
    expect(calls).toBe(2);
    expect(r.blocked).toBe(false);
    expect(r.coverage).toMatchObject({ asked: 1, answered: 1, missing: [] });
    expect(await db.query.checks.findMany()).toHaveLength(1);
  });

  it("scores a short scan, records what was missing, and measures reach over engines that answered", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }, { text: "Cheap", kind: "category" }],
    });
    const ok = (["openai", "anthropic", "grok", "perplexity"] as const).map(n => fakeAdapter(n, "Glow MedSpa is great."));
    const r = await runScan(db, practiceId, [...ok, down("gemini")], clean, async () => [], fast);
    expect(r.blocked).toBe(false);
    expect(r.score).toBeGreaterThan(0);
    const scan = await db.query.scans.findFirst({ where: eq(scansTable.id, r.scanId) });
    expect(scan?.status).toBe("complete");
    expect(scan?.coverage?.missing).toEqual(["gemini"]);
    expect(scan?.breadthScore).toBe(100); // 4 of the 4 engines that answered named them
  });

  it("blocks a badly short scan and keeps last week's as the latest", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }] });
    const good = await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], clean, async () => [], fast);
    const bad = await runScan(db, practiceId,
      [fakeAdapter("openai", "Glow MedSpa."), down("gemini"), down("grok"), down("anthropic")], clean, async () => [], fast);
    expect(bad.blocked).toBe(true);
    expect(bad.score).toBeNull();
    const scan = await db.query.scans.findFirst({ where: eq(scansTable.id, bad.scanId) });
    expect(scan?.status).toBe("blocked");
    expect(scan?.score).toBeNull();
    expect((await db.query.checks.findMany()).filter(c => c.scanId === bad.scanId)).toHaveLength(0);
    expect((await getLatestScan(db, practiceId))?.id).toBe(good.scanId);
    const activities = await db.query.activities.findMany();
    expect(activities.some(a => a.description.startsWith("scan blocked:") && a.visibility === "internal")).toBe(true);
  });

  it("stops starting engine calls at its deadline and settles on what came back", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }] });
    let calls = 0;
    const adapter: EngineAdapter = { name: "openai", run: async () => { calls++; return { answer: "Glow MedSpa.", citations: [] }; } };
    const r = await runScan(db, practiceId, [adapter], clean, async () => [], { ...fast, deadline: Date.now() - 1 });
    expect(calls).toBe(0);
    expect(r.blocked).toBe(true);
    expect((await db.query.scans.findFirst({ where: eq(scansTable.id, r.scanId) }))?.status).toBe("blocked");
  });
});

describe("runScan judge retries", () => {
  it("retries a rate-limited fact check instead of dropping it", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }],
      facts: [{ category: "pricing", label: "Botox price", value: "$13/unit" }],
    });
    let calls = 0;
    const judge = async () => {
      if (++calls === 1) throw new EngineError("anthropic", 429, "slow down");
      return { wrong: [{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" as const }], right: [] };
    };
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], judge, async () => [],
      { retryDelaysMs: [0], finalRetryDelayMs: 0 });
    expect(calls).toBe(2);
    expect(await db.query.findings.findMany()).toHaveLength(1);
  });
});

describe("runScan one analysis drives mentioned, judge and tone", () => {
  const botox = { category: "pricing" as const, label: "Botox price", value: "$13/unit" };

  it("does not judge or rate a branded answer that only echoes the name, leaving the fact score empty", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }], facts: [botox],
    });
    let judgeCalls = 0;
    const rated: string[] = [];
    await runScan(db, practiceId, [fakeAdapter("openai", "I couldn't find any information about Glow MedSpa.")],
      async () => { judgeCalls++; return { wrong: [], right: [] }; }, async () => [],
      { rateTone: async ({ answer }) => { rated.push(answer); return { tone: "neutral" as const, reason: "x" }; } });
    expect(judgeCalls).toBe(0);
    expect(rated).toEqual([]);
    const [check] = await db.query.checks.findMany();
    expect(check).toMatchObject({ mentioned: false, position: "absent", tone: null, toneReason: null, factsConfirmed: [] });
    // Not judged at all, so N/A rather than a clean 100.
    expect((await db.query.scans.findFirst())?.factScore).toBeNull();
  });

  it("still judges a branded answer that never names the business, since it is not an echo", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }], facts: [botox],
    });
    const judge = async () => ({ wrong: [{ claim: "Botox is $9/unit", factLabel: "Botox price", severity: "major" as const }], right: [] });
    await runScan(db, practiceId, [fakeAdapter("openai", "The clinic on Main Street charges $9 a unit.")], judge, async () => []);
    const [check] = await db.query.checks.findMany();
    expect(check).toMatchObject({ mentioned: false, position: "absent" });
    expect(await db.query.findings.findMany()).toHaveLength(1);
    expect((await db.query.scans.findFirst())?.factScore).toBe(82);
  });

  it.each([[[]], [["Harbor Plumbing & Heating"]]])(
    "stores a longer business name that starts with the client's as absent (known competitors: %j)",
    async known => {
      const db = await makeTestDb();
      const { practiceId } = await seedPractice(db, {
        name: "Harbor Plumbing", prompts: [{ text: "Best plumber in Portland", kind: "category" }],
        facts: [{ category: "pricing", label: "Service call fee", value: "$89" }], competitors: known,
      });
      let judgeCalls = 0;
      const rated: string[] = [];
      await runScan(db, practiceId, [fakeAdapter("openai", "Harbor Plumbing & Heating is top rated.")],
        async () => { judgeCalls++; return { wrong: [], right: [] }; }, async () => [],
        { rateTone: async ({ answer }) => { rated.push(answer); return { tone: "positive" as const, reason: "x" }; } });
      const [check] = await db.query.checks.findMany();
      expect(check).toMatchObject({
        mentioned: false, position: "absent", tone: null, competitorsMentioned: known, namedOrder: known,
      });
      expect(judgeCalls).toBe(0);
      expect(rated).toEqual([]);
      expect((await db.query.scans.findFirst())?.factScore).toBeNull();
    },
  );

  it("discards the judge's verdict and the tone when the record phase finds the business absent", async () => {
    // "Glow" alone matches inside "Glow MedSpa", so the network phase's cheap
    // pre-filter calls the judge and the rater. The record phase ranks
    // against the known competitor "Glow MedSpa", whose longer span swallows
    // the client's, and finds the client absent: nothing from that answer
    // may count.
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow", prompts: [{ text: "Best med spa", kind: "category" }],
      facts: [botox, { category: "logistics", label: "Hours", value: "9am-5pm" }], competitors: ["Glow MedSpa"],
    });
    let judgeCalls = 0;
    const judge = async () => {
      judgeCalls++;
      return { wrong: [{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" as const }], right: ["Hours"] };
    };
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa is great.")], judge, async () => [],
      { rateTone: async () => ({ tone: "positive" as const, reason: "Called great" }) });
    expect(judgeCalls).toBe(1);
    const [check] = await db.query.checks.findMany();
    expect(check).toMatchObject({
      mentioned: false, position: "absent", tone: null, toneReason: null, factsConfirmed: [], namedOrder: ["Glow MedSpa"],
    });
    expect(await db.query.findings.findMany()).toHaveLength(0);
    expect((await db.query.scans.findFirst())?.factScore).toBeNull();
  });

  it("keeps a competitor discovered inside an echo sentence, since competitor names are never echo-filtered", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Best med spa", kind: "category" }],
    });
    const answer = "I couldn't find anything about Glow MedSpa, so try Nuvo Aesthetics instead.";
    await runScan(db, practiceId, [fakeAdapter("openai", answer)], clean, async () => ["Nuvo Aesthetics"]);
    const [check] = await db.query.checks.findMany();
    expect(check).toMatchObject({ mentioned: false, position: "absent", namedOrder: ["Nuvo Aesthetics"] });
    expect((await db.query.competitors.findMany()).map(c => c.name)).toEqual(["Nuvo Aesthetics"]);
  });

  it("passes the business's name variations to the website check", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", website: "harbor.example", prompts: [{ text: "Best plumber", kind: "category" }],
    });
    const seen: unknown[][] = [];
    const checkWebsite = async (...args: unknown[]): Promise<WebsiteCheckResult> => {
      seen.push(args);
      return { checkedAt: "2026-10-01T00:00:00.000Z", checks: [], pages: [], homepageText: "" };
    };
    await runScan(db, practiceId, [fakeAdapter("openai", "Harbor Plumbing.")], clean, async () => [], { checkWebsite });
    expect(seen).toEqual([["harbor.example", undefined, { names: ["Harbor Plumbing"] }]]);
    expect((await db.query.scans.findFirst())?.websiteCheck?.checkedAt).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("runScan namesake guard", () => {
  const fee = { category: "pricing" as const, label: "Service call fee", value: "$89" };
  const hours = { category: "logistics" as const, label: "Hours", value: "Mon-Fri 8am-5pm" };
  const prompt = { text: "What do you know about Harbor Plumbing?", kind: "branded" as const };
  const denver = "Harbor Plumbing is a well-reviewed plumber in Denver, CO. Their service call fee is $49 and they open at 8am on weekdays.";
  const differentBusiness = { tone: "positive" as const, reason: "Recommended", sameBusiness: false, evidence: "in Denver, CO" };
  // On any answer: a $49 fee is wrong, the hours are right.
  const judge = async ({ answer }: { answer: string }) => ({
    wrong: answer.includes("$49")
      ? [{ claim: "Service call fee is $49", factLabel: "Service call fee", severity: "major" as const }] : [],
    right: ["Hours"],
  });

  /** What a scan of the Denver answer records when the guard stays out of it. */
  const expectUntouched = async (db: Db, tone: { tone: string | null; toneReason: string | null }) => {
    const [check] = await db.query.checks.findMany();
    expect(check).toMatchObject({ mentioned: true, position: "first", ...tone });
    expect(check.factsConfirmed).toHaveLength(1);
    const rows = await db.query.findings.findMany();
    expect(rows.map(r => r.claim)).toEqual(["Service call fee is $49"]);
    expect((await db.query.scans.findFirst())?.factScore).toBe(82); // one major price error
    const activities = await db.query.activities.findMany();
    expect(activities.some(a => a.description.startsWith("namesake:"))).toBe(false);
  };

  it("vetoes a namesake: wrong fact not opened, right facts not confirmed, not judged, reason stored, line logged", async () => {
    const db = await makeTestDb();
    const { practiceId, factIds } = await seedPractice(db, {
      name: "Harbor Plumbing", category: "Plumber", location: "Portland, OR", prompts: [prompt], facts: [fee, hours],
    });
    const portland = "Harbor Plumbing in Portland, OR charges $89 for a service call and opens at 8am on weekdays.";
    const seen: unknown[] = [];
    const rateTone = async (args: { answer: string }) => {
      seen.push(args);
      return args.answer.includes("Denver")
        ? differentBusiness
        : { tone: "positive" as const, reason: "Recommended", sameBusiness: true, evidence: null };
    };
    await runScan(db, practiceId, [fakeAdapter("openai", denver), fakeAdapter("perplexity", portland)], judge, async () => [],
      { rateTone });

    const checks = await db.query.checks.findMany();
    const vetoed = checks.find(c => c.engine === "openai")!;
    expect(vetoed).toMatchObject({
      mentioned: false, position: "absent", competitorsMentioned: [], namedOrder: [],
      tone: null, toneReason: "Different business: in Denver, CO", factsConfirmed: [],
    });
    // The other engine's answer is about this business and counts as usual.
    const kept = checks.find(c => c.engine === "perplexity")!;
    expect(kept).toMatchObject({ mentioned: true, position: "first", tone: "positive", toneReason: "Recommended" });
    expect(kept.factsConfirmed).toEqual([factIds[1]]);
    // The wrong fee never became a finding, and only the kept answer was judged (100, not 82).
    expect(await db.query.findings.findMany()).toHaveLength(0);
    expect((await db.query.scans.findFirst())?.factScore).toBe(100);

    const activities = await db.query.activities.findMany();
    const line = activities.find(a => a.description.startsWith("namesake:"));
    expect(line?.description).toBe(
      "namesake: openai described a different Harbor Plumbing on prompt What do you know about Harbor Plumbing? (in Denver, CO)",
    );
    expect(line?.visibility).toBe("internal");
    // The rater is told what is on record, so it can tell this business from a namesake.
    expect(seen).toContainEqual({
      answer: denver, businessNames: ["Harbor Plumbing"],
      context: { category: "Plumber", location: "Portland, OR", website: null },
    });
  });

  it("does not veto when the business has no location on record", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", category: "Plumber", prompts: [prompt], facts: [fee, hours] });
    await runScan(db, practiceId, [fakeAdapter("openai", denver)], judge, async () => [], { rateTone: async () => differentBusiness });
    await expectUntouched(db, { tone: "positive", toneReason: "Recommended" });
  });

  it("does not veto when the evidence is not in the answer", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", location: "Portland, OR", prompts: [prompt], facts: [fee, hours] });
    await runScan(db, practiceId, [fakeAdapter("openai", denver)], judge, async () => [],
      { rateTone: async () => ({ ...differentBusiness, evidence: "in Boise, ID" }) });
    await expectUntouched(db, { tone: "positive", toneReason: "Recommended" });
  });

  it("does not veto when the sentence naming the business names the city", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", location: "Portland, OR", prompts: [prompt], facts: [fee, hours] });
    const both = "Harbor Plumbing serves Portland and Denver, CO; their service call fee is $49 and they open at 8am.";
    await runScan(db, practiceId, [fakeAdapter("openai", both)], judge, async () => [],
      { rateTone: async () => ({ ...differentBusiness, evidence: "Denver, CO" }) });
    await expectUntouched(db, { tone: "positive", toneReason: "Recommended" });
  });

  it("changes nothing when the rater throws", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", location: "Portland, OR", prompts: [prompt], facts: [fee, hours] });
    await runScan(db, practiceId, [fakeAdapter("openai", denver)], judge, async () => [],
      { rateTone: async () => { throw new Error("down"); } });
    await expectUntouched(db, { tone: null, toneReason: null });
  });

  // Review findings #10, #14 and #29: a veto takes the business out of the
  // ranking and nothing else. The competitors the same analysis found stay
  // on the row, including one joined to the namesake by "and", which a
  // re-run of the matcher without the practice names used to lose (the
  // longer-name guard no longer knew that the word after "and" starts a
  // business).
  const category = { text: "Best plumber in Portland", kind: "category" as const };
  it.each([
    // The plain form: the competitor in its own sentence.
    ["Roto-Rooter", "Roto-Rooter is better. Harbor Plumbing is a well-reviewed plumber in Denver, CO. Their service call fee is $49."],
    // Finding #14: the competitor joined to the namesake by "and".
    ["Roto-Rooter", "Harbor Plumbing is a plumber in Denver, CO. Roto-Rooter and Harbor Plumbing are both good."],
    // Finding #10: the competitor first, then "and" the namesake, in one sentence.
    ["Rose City Plumbing", "Rose City Plumbing and Harbor Plumbing are both solid options in Denver, CO. Harbor charges $49 per call."],
  ])("keeps the competitor %s on a vetoed row: %s", async (competitor, answer) => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", category: "Plumber", location: "Portland, OR", prompts: [category], facts: [fee, hours],
      competitors: [competitor],
    });
    await runScan(db, practiceId, [fakeAdapter("openai", answer)], judge, async () => [], { rateTone: async () => differentBusiness });
    const [check] = await db.query.checks.findMany();
    expect(check).toMatchObject({
      mentioned: false, position: "absent", competitorsMentioned: [competitor], namedOrder: [competitor],
      tone: null, toneReason: "Different business: in Denver, CO", factsConfirmed: [],
    });
    expect(await db.query.findings.findMany()).toHaveLength(0);
    expect((await db.query.scans.findFirst())?.factScore).toBeNull();
    const activities = await db.query.activities.findMany();
    expect(activities.some(a => a.description.startsWith("namesake: openai described a different Harbor Plumbing"))).toBe(true);
  });

  // Review finding #11: the guard is given the reconciled competitor list,
  // so "<namesake> and <known competitor>" is two businesses for the guard
  // just as it is for classifyPosition. Before, the guard found no
  // occurrence, returned null, and the Denver namesake was stored as named
  // first with the $49 fee opened as a finding against the Portland facts.
  it("vetoes a namesake joined to a known competitor by 'and'", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", category: "Plumber", location: "Portland, OR", prompts: [category], facts: [fee, hours],
      competitors: ["Roto-Rooter"],
    });
    const listed = "Harbor Plumbing and Roto-Rooter both serve Denver, CO. Harbor charges $49 per call.";
    await runScan(db, practiceId, [fakeAdapter("openai", listed)], judge, async () => [],
      { rateTone: async () => ({ ...differentBusiness, evidence: "both serve Denver, CO" }) });
    const [check] = await db.query.checks.findMany();
    expect(check).toMatchObject({
      mentioned: false, position: "absent", competitorsMentioned: ["Roto-Rooter"], namedOrder: ["Roto-Rooter"],
      tone: null, toneReason: "Different business: both serve Denver, CO", factsConfirmed: [],
    });
    expect(await db.query.findings.findMany()).toHaveLength(0);
    expect((await db.query.scans.findFirst())?.factScore).toBeNull();
  });

  it("keeps the mention when the sentence listing both businesses names the city", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", category: "Plumber", location: "Portland, OR", prompts: [category], facts: [fee, hours],
      competitors: ["Roto-Rooter"],
    });
    const both = "Harbor Plumbing and Roto-Rooter both serve Portland and Denver, CO. Harbor charges $49 per call.";
    await runScan(db, practiceId, [fakeAdapter("openai", both)], judge, async () => [],
      { rateTone: async () => ({ ...differentBusiness, evidence: "Denver, CO" }) });
    await expectUntouched(db, { tone: "positive", toneReason: "Recommended" });
    const [check] = await db.query.checks.findMany();
    expect(check).toMatchObject({ competitorsMentioned: ["Roto-Rooter"], namedOrder: ["Harbor Plumbing", "Roto-Rooter"] });
  });
});

describe("runScan pre-filter and record phase disagreeing in the named direction", () => {
  const fee = { category: "pricing" as const, label: "Service call fee", value: "$89" };
  const prompts = [
    { text: "Who is a good plumber in Portland?", kind: "category" as const },
    { text: "Who are the best plumbers in Portland?", kind: "category" as const },
  ];
  const answers: Record<string, string> = {
    "Who is a good plumber in Portland?": "Rose City Plumbing is great.",
    "Who are the best plumbers in Portland?": "Top picks: Harbor Plumbing & Rose City Plumbing. Harbor charges $49.",
  };
  const adapter: EngineAdapter = { name: "openai", run: async p => ({ answer: answers[p], citations: [] }) };
  // The extractor finds Rose City Plumbing in the first answer and fails on
  // the second (both tries), so the second answer's pre-filter never learns
  // that "& Rose City Plumbing" starts a business and reads the client's
  // name as the first words of a longer one.
  const extractor = async ({ answer }: { answer: string }) => {
    if (answer.startsWith("Top picks")) throw new Error("extractor blew up");
    return ["Rose City Plumbing"];
  };

  // Review finding #19: the row is stored as named (the record phase knows
  // Rose City Plumbing by then), but the judge and the rater never ran on
  // it. The operator is told, so a named answer with no fact check and no
  // tone is a logged gap rather than a silent one.
  it("warns when a named earned answer was neither fact-checked nor rated", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", location: "Portland, OR", prompts, facts: [fee] });
    let judgeCalls = 0;
    const rated: string[] = [];
    await runScan(db, practiceId, [adapter],
      async () => { judgeCalls++; return { wrong: [], right: [] }; }, extractor,
      { concurrency: 1, rateTone: async ({ answer }) => { rated.push(answer); return { tone: "positive" as const, reason: "x" }; } });
    expect(judgeCalls).toBe(0);
    expect(rated).toEqual([]);
    const rows = await db.query.checks.findMany();
    const named = rows.find(r => r.answerText.startsWith("Top picks"))!;
    expect(named).toMatchObject({
      mentioned: true, position: "first", namedOrder: ["Harbor Plumbing", "Rose City Plumbing"], tone: null, factsConfirmed: [],
    });
    expect((await db.query.scans.findFirst())?.factScore).toBeNull();
    const warnings = (await db.query.activities.findMany()).filter(a => a.description.includes("named the business"));
    expect(warnings.map(w => w.description)).toEqual([
      "scan warning: openai named the business on prompt Who are the best plumbers in Portland? but the answer was not fact-checked and not rated",
    ]);
    expect(warnings[0].visibility).toBe("internal");
  });

  it("names only the gap that exists, and stays quiet when there is nothing to have run", async () => {
    // No fact sheet and no rater: the named row is complete as stored.
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", location: "Portland, OR", prompts });
    await runScan(db, practiceId, [adapter], clean, extractor, { concurrency: 1 });
    const rows = await db.query.checks.findMany();
    expect(rows.find(r => r.answerText.startsWith("Top picks"))).toMatchObject({ mentioned: true, position: "first" });
    expect((await db.query.activities.findMany()).some(a => a.description.includes("named the business"))).toBe(false);

    // A fact sheet but no rater: only the fact check is reported missing.
    const db2 = await makeTestDb();
    const { practiceId: p2 } = await seedPractice(db2, { name: "Harbor Plumbing", location: "Portland, OR", prompts, facts: [fee] });
    await runScan(db2, p2, [adapter], clean, extractor, { concurrency: 1 });
    const lines = (await db2.query.activities.findMany()).filter(a => a.description.includes("named the business"));
    expect(lines.map(l => l.description)).toEqual([
      "scan warning: openai named the business on prompt Who are the best plumbers in Portland? but the answer was not fact-checked",
    ]);
  });

  it("does not warn on a normal scan, where the pre-filter and the record phase agree", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", location: "Portland, OR", prompts, facts: [fee], competitors: ["Rose City Plumbing"],
    });
    let judgeCalls = 0;
    await runScan(db, practiceId, [adapter], async () => { judgeCalls++; return { wrong: [], right: [] }; }, async () => [],
      { rateTone: async () => ({ tone: "positive" as const, reason: "x" }) });
    expect(judgeCalls).toBe(1);
    expect((await db.query.activities.findMany()).some(a => a.description.includes("named the business"))).toBe(false);
  });
});

describe("runScan and Google AI Overviews", () => {
  const summary = { asked: 2, shown: 1, namedIn: 0, failed: 0, results: [] };

  it("reads the overview for each buyer question, with the business's names and known competitors, and stores it", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing",
      prompts: [
        { text: "Best plumber in Portland", kind: "category" },
        { text: "How much does a plumber cost in Portland?", kind: "informational" },
        { text: "Is Harbor Plumbing any good?", kind: "branded" },
      ],
      competitors: ["Rose City Plumbing"],
    });
    const asked: unknown[] = [];
    const { score } = await runScan(db, practiceId, [fakeAdapter("openai", "Harbor Plumbing is good.")], clean, async () => [], {
      checkAiOverviews: async args => { asked.push(args); return summary; },
    });
    expect(asked).toEqual([{
      questions: ["Best plumber in Portland", "How much does a plumber cost in Portland?"],
      practiceNames: ["Harbor Plumbing"], competitorNames: ["Rose City Plumbing"],
    }]);
    const scan = await db.query.scans.findFirst();
    expect(scan?.aiOverviews).toEqual(summary);

    // It is a finding of its own: the same scan without it scores the same.
    const db2 = await makeTestDb();
    const { practiceId: p2 } = await seedPractice(db2, {
      name: "Harbor Plumbing",
      prompts: [
        { text: "Best plumber in Portland", kind: "category" },
        { text: "How much does a plumber cost in Portland?", kind: "informational" },
        { text: "Is Harbor Plumbing any good?", kind: "branded" },
      ],
      competitors: ["Rose City Plumbing"],
    });
    const plain = await runScan(db2, p2, [fakeAdapter("openai", "Harbor Plumbing is good.")], clean, async () => []);
    expect(plain.score).toBe(score);
    expect((await db2.query.scans.findFirst())?.aiOverviews).toBeNull();
  });

  it("finishes the scan with nothing stored when the overview check fails", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", prompts: [{ text: "Best plumber in Portland", kind: "category" }] });
    const result = await runScan(db, practiceId, [fakeAdapter("openai", "Harbor Plumbing is good.")], clean, async () => [], {
      checkAiOverviews: async () => { throw new Error("dataforseo down"); },
    });
    expect(result.blocked).toBe(false);
    const scan = await db.query.scans.findFirst();
    expect(scan).toMatchObject({ status: "complete", aiOverviews: null });
  });
});

describe("runScan pacing", () => {
  it("starts the next engine request without waiting for the last answer to be read", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [
        { text: "Best med spa in Santa Monica", kind: "category" },
        { text: "Best med spa in Venice", kind: "category" },
      ],
    });
    const events: string[] = [];
    const adapter: EngineAdapter = {
      name: "openai",
      run: async prompt => { events.push(`ask ${prompt}`); return { answer: "Glow MedSpa is best.", citations: [] }; },
    };
    // The first answer's extractor stays open until the second engine request
    // has gone out. With one engine lane, that only happens when reading an
    // answer does not hold the lane.
    let release = () => {};
    const secondAsked = new Promise<void>(resolve => { release = resolve; });
    const run = adapter.run;
    adapter.run = async prompt => { if (events.length === 1) release(); return run(prompt); };
    const extractor = async () => { await secondAsked; events.push("read"); return []; };

    await runScan(db, practiceId, [adapter], clean, extractor, { concurrency: 1 });

    expect(events.slice(0, 2).every(e => e.startsWith("ask "))).toBe(true);
    expect(await db.query.checks.findMany()).toHaveLength(2);
  });

  it("asks one engine request per engine at once, and never fewer than four", async () => {
    const peak = async (engines: number, concurrency?: number) => {
      const db = await makeTestDb();
      const { practiceId } = await seedPractice(db, {
        name: "Glow MedSpa",
        prompts: Array.from({ length: 4 }, (_, i) => ({ text: `Best med spa in Santa Monica ${i}`, kind: "category" as const })),
      });
      let inFlight = 0;
      let most = 0;
      const names = ["openai", "anthropic", "gemini", "perplexity", "grok", "google"] as EngineAdapter["name"][];
      const adapters = names.slice(0, engines).map(name => ({
        name,
        run: async () => {
          most = Math.max(most, ++inFlight);
          await new Promise(resolve => setTimeout(resolve, 15));
          inFlight--;
          return { answer: "Glow MedSpa is best.", citations: [] };
        },
      }));
      await runScan(db, practiceId, adapters, clean, async () => [], { concurrency });
      return most;
    };
    expect(await peak(6)).toBe(6);
    expect(await peak(2)).toBe(4);
    expect(await peak(6, 2)).toBe(2);
  });

  it("gives the competitor extractor a second try before giving up on an answer", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing",
      prompts: [{ text: "Best plumber in Portland", kind: "category" }],
    });
    const adapter = fakeAdapter("openai", "Top picks: Harbor Plumbing & Rose City Plumbing.");
    let calls = 0;
    const extractor = async () => { if (++calls === 1) throw new Error("extractor 529"); return ["Rose City Plumbing"]; };

    await runScan(db, practiceId, [adapter], clean, extractor);

    expect(calls).toBe(2);
    const [check] = await db.query.checks.findMany();
    expect(check.mentioned).toBe(true);
    expect(check.competitorsMentioned).toEqual(["Rose City Plumbing"]);
    expect((await db.query.activities.findMany()).some(a => a.description.includes("extraction failed"))).toBe(false);
  });

  it("counts the business in 'A and B are both good' even when the extractor never answers", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing",
      prompts: [{ text: "Best plumber in Portland", kind: "category" }],
    });
    const adapter = fakeAdapter("openai", "Harbor Plumbing and Rose City Plumbing are both well reviewed.");

    await runScan(db, practiceId, [adapter], clean, async () => { throw new Error("extractor down"); });

    const [check] = await db.query.checks.findMany();
    expect(check.mentioned).toBe(true);
    expect(check.position).toBe("first");
  });
});

describe("scanStartedWithin", () => {
  it("sees a scan started inside the window, of the given statuses", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    expect(await scanStartedWithin(db, practiceId, 60_000)).toBe(false);
    await db.insert(scansTable).values({ practiceId, status: "running", startedAt: new Date(Date.now() - 30_000) });
    expect(await scanStartedWithin(db, practiceId, 60_000)).toBe(true);
    expect(await scanStartedWithin(db, practiceId, 10_000)).toBe(false);
    expect(await scanStartedWithin(db, practiceId, 60_000, ["complete"])).toBe(false);
  });
});

describe("SCAN_DEADLINE_MS", () => {
  it("leaves room inside a 300s function", () => {
    expect(SCAN_DEADLINE_MS).toBeLessThanOrEqual(150_000);
  });
});

describe("a scan gathered in steps", () => {
  const fast = { retryDelaysMs: [], finalRetryDelayMs: 0, concurrency: 1 };
  const counting = (name: EngineAdapter["name"], answer: string, seen: Map<string, number>, step: { calls: number }): EngineAdapter =>
    ({ name, run: async (prompt: string) => {
      step.calls++;
      seen.set(`${name}|${prompt}`, (seen.get(`${name}|${prompt}`) ?? 0) + 1);
      return { answer, citations: [] };
    } });

  // Runs steps until done, each one allowed to start a single engine call.
  async function gatherOneCallPerStep(db: Db, scanId: string, adapters: EngineAdapter[], judge = clean, step = { calls: 0 }) {
    let steps = 0;
    for (; steps < 30; steps++) {
      step.calls = 0;
      const { done } = await gatherStep(db, scanId, adapters, judge, async () => [], {
        ...fast, startBy: 1, stopBy: Number.POSITIVE_INFINITY, now: () => (step.calls >= 1 ? 10 : 0),
      });
      if (done) break;
    }
    return steps;
  }

  it("records the same checks as one run, asking each engine each question once", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }, { text: "Cheap", kind: "category" }],
    });
    const seen = new Map<string, number>();
    const step = { calls: 0 };
    const adapters = [counting("openai", "Glow MedSpa.", seen, step), counting("perplexity", "Glow MedSpa.", seen, step)];
    const scanId = await startScan(db, practiceId, { runs: 1, purpose: "manual" });
    const steps = await gatherOneCallPerStep(db, scanId, adapters, clean, step);
    expect(steps).toBeGreaterThan(1);
    const result = await finishScan(db, scanId, adapters.map(a => a.name), {});
    expect(result.blocked).toBe(false);
    expect((await db.query.checks.findMany()).filter(c => c.scanId === scanId)).toHaveLength(4);
    expect([...seen.values()]).toEqual([1, 1, 1, 1]);
    expect((await db.query.scans.findFirst({ where: eq(scansTable.id, scanId) }))?.status).toBe("complete");
  });

  it("skips answers already saved", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, { name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }] });
    const scanId = await startScan(db, practiceId, { runs: 1, purpose: "manual" });
    await db.insert(scanAnswers).values({
      scanId, promptId: promptIds[0], run: 1, engine: "openai", ok: true, retriable: false,
      answer: "Glow MedSpa.", citations: [], searchQueries: [],
    });
    const seen = new Map<string, number>();
    const r = await gatherStep(db, scanId, [counting("openai", "Glow MedSpa.", seen, { calls: 0 })], clean, async () => [],
      { ...fast, startBy: Number.POSITIVE_INFINITY, stopBy: Number.POSITIVE_INFINITY });
    expect(r.done).toBe(true);
    expect(seen.size).toBe(0);
  });

  it("goes straight to done with no prompts, and finishes", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const scanId = await startScan(db, practiceId, { runs: 1, purpose: "manual" });
    const r = await gatherStep(db, scanId, [fakeAdapter("openai", "x")], clean, async () => [],
      { ...fast, startBy: Number.POSITIVE_INFINITY, stopBy: Number.POSITIVE_INFINITY });
    expect(r.done).toBe(true);
    await finishScan(db, scanId, ["openai"], {});
    expect((await db.query.scans.findFirst({ where: eq(scansTable.id, scanId) }))?.status).not.toBe("running");
  });

  it("keeps 'judge failed' apart from 'not judged' across steps", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }, { text: "Fillers at Glow MedSpa?", kind: "branded" }],
      facts: [{ category: "pricing", label: "Botox price", value: "$13/unit" }],
    });
    let judgeCalls = 0;
    const judge = async () => {
      if (++judgeCalls === 1) throw new Error("judge down");
      return { wrong: [], right: [] };
    };
    const step = { calls: 0 };
    const scanId = await startScan(db, practiceId, { runs: 1, purpose: "manual" });
    await gatherOneCallPerStep(db, scanId, [counting("openai", "Glow MedSpa is lovely.", new Map(), step)], judge, step);
    await finishScan(db, scanId, ["openai"], {});
    const activities = await db.query.activities.findMany();
    expect(activities.filter(a => a.description.startsWith("scan warning: judge failed"))).toHaveLength(1);
  });

  it("saves a scan's purpose", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const scanId = await startScan(db, practiceId, { runs: 2, purpose: "weekly" });
    const scan = await db.query.scans.findFirst({ where: eq(scansTable.id, scanId) });
    expect(scan).toMatchObject({ purpose: "weekly", runs: 2, step: 0, status: "running" });
  });
});
