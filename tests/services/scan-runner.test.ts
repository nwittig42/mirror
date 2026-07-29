import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";

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
    const { scanId, score } = await runScan(db, practiceId, adapters, fakeJudge);
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
    expect(activities.some(a => a.description.startsWith("Weekly scan complete"))).toBe(true);
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
    const { score } = await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa"), failing], async () => []);
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
    const { scanId, score } = await runScan(db, practiceId, adapters, throwingJudge);
    expect(scanId).toBeTruthy();
    expect(score).toBeGreaterThan(0);
    const scan = await db.query.scans.findFirst();
    expect(scan?.status).toBe("complete");
    const findings = await db.query.findings.findMany();
    expect(findings).toHaveLength(0);
    const activities = await db.query.activities.findMany();
    expect(activities.some(a =>
      a.description === "scan warning: judge failed on prompt How much does Botox cost at Glow MedSpa?"
    )).toBe(true);
  });
});
