import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";
import { EngineError } from "@/engines/types";
import { eq } from "drizzle-orm";
import { getLatestScan, scanStartedWithin } from "@/lib/queries";
import { competitors, findings as findingsTable, scans as scansTable } from "@/db/schema";

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

describe("scanLooksStuck", () => {
  it("flags a running scan only after 15 minutes", async () => {
    const { scanLooksStuck } = await import("@/services/scan-runner");
    const now = Date.now();
    expect(scanLooksStuck(new Date(now - 14 * 60_000), now)).toBe(false);
    expect(scanLooksStuck(new Date(now - 16 * 60_000), now)).toBe(true);
  });
});
