import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";
import { competitors } from "@/db/schema";

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
      [{ claim: "Botox at Glow MedSpa is $9/unit", factLabel: "Botox price", severity: "major" as const }];
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
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa is great."), broken],
      async () => [], async () => []);

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
    const { score } = await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa"), failing], async () => [], async () => []);
    expect((await db.query.checks.findMany())).toHaveLength(1);
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
    // A judge failure must not count as a clean branded check: the failed
    // check is excluded from the accuracy denominator entirely (unjudged !=
    // clean), so accuracy stays at its no-branded-checks default of 1 (100).
    expect(scan?.accuracyScore).toBe(100);
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
    await runScan(db, practiceId, [fakeAdapter("openai", answer)], async () => [], extractor);

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
    await runScan(db, practiceId, [fakeAdapter("openai", "Nuvo Aesthetics wins.")], async () => [], extractor);
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
    await runScan(db, practiceId, [fakeAdapter("openai", "Check Yelp.")], async () => [], extractor);
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
      db, practiceId, [fakeAdapter("openai", "Skin Bar LA then Glow MedSpa.")], async () => [], extractor,
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
    await runScan(db, practiceId, [fakeAdapter("openai", "Nurse Jamie and Skin Bar LA are popular.")], async () => [], extractor);
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
    await runScan(db, practiceId, [fakeAdapter("openai", "x")], async () => [], extractor);
    expect(seen[0]).toEqual(["Skin Bar LA"]);
  });
});
