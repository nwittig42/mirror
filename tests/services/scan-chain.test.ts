import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { scans } from "@/db/schema";
import { startScan, scanLooksStuck, type ScanResult } from "@/services/scan-runner";
import { claimStep, runStep, makeStepTrigger, startScanChain, MAX_STEPS, type StepDeps } from "@/services/scan-chain";
import type { EngineAdapter } from "@/engines/types";
import type { Db } from "@/db";

const clean = async () => ({ wrong: [], right: [] });

/**
 * Deps whose clock lets each step start exactly one engine call, and whose
 * trigger records the next step instead of sending a request.
 */
function chainDeps(adapters: EngineAdapter[], step: { calls: number }) {
  const next: number[] = [];
  const completed: ScanResult[] = [];
  const failures: string[] = [];
  const deps: StepDeps = {
    adapters, judge: clean, extractor: async () => [],
    scanOptions: { retryDelaysMs: [], finalRetryDelayMs: 0, concurrency: 1 },
    invokedAt: 0,
    now: () => (step.calls >= 1 ? 200_000 : 0),
    triggerNext: async (_scanId, n) => { next.push(n); },
    onComplete: async (_db, _scanId, result) => { completed.push(result); },
    onFailed: async (_db, _scanId, reason) => { failures.push(reason); },
  };
  return { deps, next, completed, failures };
}

const counting = (name: EngineAdapter["name"], step: { calls: number }): EngineAdapter =>
  ({ name, run: async () => { step.calls++; return { answer: "Glow MedSpa.", citations: [] }; } });

/** Follows the recorded handoffs the way the step route would. */
async function follow(db: Db, scanId: string, c: ReturnType<typeof chainDeps>, step: { calls: number }) {
  for (let i = 0; i < c.next.length && i < 40; i++) {
    step.calls = 0;
    await runStep(db, scanId, c.next[i], c.deps);
  }
}

describe("claimStep", () => {
  it("refuses a second claim of the same step", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const scanId = await startScan(db, practiceId, { runs: 1, purpose: "manual" });
    expect(await claimStep(db, scanId, 1)).toBe(true);
    expect(await claimStep(db, scanId, 1)).toBe(false);
    expect(await claimStep(db, scanId, 3)).toBe(false);
    expect(await claimStep(db, scanId, 2)).toBe(true);
  });
});

describe("runStep", () => {
  it("hands off while answers are left, then finishes the scan once", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }, { text: "Cheap", kind: "category" }],
    });
    const step = { calls: 0 };
    const c = chainDeps([counting("openai", step)], step);
    const scanId = await startScanChain(db, practiceId, "manual", c.deps);
    await follow(db, scanId, c, step);
    expect(c.next.length).toBeGreaterThanOrEqual(2);
    expect(c.completed).toHaveLength(1);
    expect(c.completed[0].blocked).toBe(false);
    expect((await db.query.scans.findFirst({ where: eq(scans.id, scanId) }))?.status).toBe("complete");
    expect((await db.query.checks.findMany()).filter(x => x.scanId === scanId)).toHaveLength(2);
  });

  it("skips a step that was already claimed", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }] });
    const step = { calls: 0 };
    const c = chainDeps([counting("openai", step)], step);
    const scanId = await startScan(db, practiceId, { runs: 1, purpose: "manual" });
    await claimStep(db, scanId, 1);
    expect(await runStep(db, scanId, 1, c.deps)).toBe("skipped");
    expect(step.calls).toBe(0);
  });

  it("settles on what came back at the last allowed step", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }, { text: "Cheap", kind: "category" }],
    });
    const step = { calls: 0 };
    const c = chainDeps([counting("openai", step)], step);
    const scanId = await startScan(db, practiceId, { runs: 1, purpose: "manual" });
    await db.update(scans).set({ step: MAX_STEPS - 1 }).where(eq(scans.id, scanId));
    expect(await runStep(db, scanId, MAX_STEPS, c.deps)).toBe("finished");
    expect(c.completed).toHaveLength(1);
    expect(c.next).toHaveLength(0);
  });

  it("marks the scan failed and says so when the handoff can't be sent", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }, { text: "Cheap", kind: "category" }],
    });
    const step = { calls: 0 };
    const c = chainDeps([counting("openai", step)], step);
    c.deps.triggerNext = async () => { throw new Error("scan-step 401"); };
    const scanId = await startScanChain(db, practiceId, "manual", c.deps);
    expect((await db.query.scans.findFirst({ where: eq(scans.id, scanId) }))?.status).toBe("failed");
    expect(c.failures).toHaveLength(1);
    expect(c.failures[0]).toContain("scan-step 401");
  });

  it("leaves the record phase to the next step when gathering used up the budget", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }] });
    const step = { calls: 0 };
    const c = chainDeps([counting("openai", step)], step);
    const scanId = await startScanChain(db, practiceId, "manual", c.deps);
    expect(c.completed).toHaveLength(0);
    expect(c.next).toEqual([2]);
    await follow(db, scanId, c, step);
    expect(c.completed).toHaveLength(1);
  });
});

describe("makeStepTrigger", () => {
  it("calls the step route with the secret and the bypass header", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const trigger = makeStepTrigger({
      appUrl: "https://app.example/", cronSecret: "s3cret", bypassSecret: "byp",
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, headers: init.headers as Record<string, string> });
        return new Response(null, { status: 202 });
      }) as unknown as typeof fetch,
    });
    await trigger("scan-1", 3);
    expect(calls[0].url).toBe("https://app.example/api/cron/scan-step?scan=scan-1&step=3");
    expect(calls[0].headers).toMatchObject({ authorization: "Bearer s3cret", "x-vercel-protection-bypass": "byp" });
  });

  it("throws on a refused request", async () => {
    const trigger = makeStepTrigger({
      appUrl: "https://app.example", cronSecret: "s",
      fetchImpl: (async () => new Response(null, { status: 401 })) as unknown as typeof fetch,
    });
    await expect(trigger("scan-1", 2)).rejects.toThrow("scan-step 401");
  });
});

describe("scanLooksStuck", () => {
  it("flags a scan with no progress for 10 minutes", () => {
    const now = Date.now();
    expect(scanLooksStuck(new Date(now - 9 * 60_000), now)).toBe(false);
    expect(scanLooksStuck(new Date(now - 11 * 60_000), now)).toBe(true);
  });
});

describe("a weekly stagger longer than the start budget", () => {
  it("saves nothing in step 1, hands off, and completes in step 2", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }] });
    const step = { calls: 0 };
    const c = chainDeps([counting("openai", step)], step);
    delete c.deps.now;
    c.deps.invokedAt = Date.now() - 200_000; // the stagger wait already spent the budget
    const scanId = await startScanChain(db, practiceId, "weekly", c.deps);
    expect(step.calls).toBe(0);
    expect(c.next).toEqual([2]);
    c.deps.invokedAt = Date.now();
    expect(await runStep(db, scanId, 2, c.deps)).toBe("finished");
    expect(c.completed).toHaveLength(1);
  });
});

describe("completionFor", () => {
  it("weekly sends the findings alert, or the blocked notice when blocked", async () => {
    const { weeklyComplete } = await import("@/services/weekly-scan");
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const scanId = await startScan(db, practiceId, { runs: 1, purpose: "weekly" });
    const send = async () => { sent.push("findings"); };
    const sendBlocked = async () => { sent.push("blocked"); };
    const sent: string[] = [];
    const coverage = { asked: 1, answered: 1, engines: [], missing: [], blocked: false };
    await weeklyComplete(db, scanId, { scanId, score: 50, newFindings: [], blocked: false, coverage }, { send, sendBlocked });
    await weeklyComplete(db, scanId, { scanId, score: null, newFindings: [], blocked: true, coverage: { ...coverage, blocked: true } }, { send, sendBlocked });
    expect(sent).toEqual(["findings", "blocked"]);
  });
});

describe("review fixes", () => {
  it("doesn't fail a scan whose next step already started when the handoff timed out", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }, { text: "Cheap", kind: "category" }],
    });
    const step = { calls: 0 };
    const c = chainDeps([counting("openai", step)], step);
    c.deps.triggerNext = async (id, n) => { await claimStep(db, id, n); throw new Error("timeout"); };
    const scanId = await startScanChain(db, practiceId, "manual", c.deps);
    expect((await db.query.scans.findFirst({ where: eq(scans.id, scanId) }))?.status).toBe("running");
    expect(c.failures).toHaveLength(0);
  });

  it("sweeps a scan with no progress for 10 minutes to failed and tells whoever waits on it", async () => {
    const { sweepStuckScans } = await import("@/services/scan-completion");
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const stuck = await startScan(db, practiceId, { runs: 1, purpose: "prospect" });
    const fresh = await startScan(db, practiceId, { runs: 1, purpose: "prospect" });
    await db.update(scans).set({ updatedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(scans.id, stuck));
    const told: string[] = [];
    const swept = await sweepStuckScans(db, () => ({
      onComplete: async () => undefined,
      onFailed: async (_db, id, reason) => { told.push(`${id}:${reason}`); },
    }));
    expect(swept).toBe(1);
    expect((await db.query.scans.findFirst({ where: eq(scans.id, stuck) }))?.status).toBe("failed");
    expect((await db.query.scans.findFirst({ where: eq(scans.id, fresh) }))?.status).toBe("running");
    expect(told).toEqual([`${stuck}:it stopped without finishing`]);
    expect(await sweepStuckScans(db, () => { throw new Error("not again"); })).toBe(0);
  });

  it("runs the website check once, not again in a later step", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", website: "https://glow.example",
      prompts: [{ text: "Best", kind: "category" }, { text: "Cheap", kind: "category" }],
    });
    let checks = 0;
    const step = { calls: 0 };
    const c = chainDeps([counting("openai", step)], step);
    c.deps.scanOptions = {
      ...c.deps.scanOptions,
      checkWebsite: (async () => { checks++; return { score: 1 }; }) as never,
    };
    c.deps.invokedAt = Date.now() - 200_000; // step 1 asks nothing, as after a long stagger
    delete c.deps.now;
    const scanId = await startScanChain(db, practiceId, "manual", c.deps);
    c.deps.invokedAt = Date.now();
    step.calls = 0;
    await runStep(db, scanId, 2, c.deps);
    expect(checks).toBe(1);
  });
});

describe("scanInProgress", () => {
  it("counts a running scan with recent progress, however long ago it started", async () => {
    const { scanInProgress } = await import("@/lib/queries");
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    expect(await scanInProgress(db, practiceId)).toBe(false);
    const id = await startScan(db, practiceId, { runs: 1, purpose: "weekly" });
    await db.update(scans).set({ startedAt: new Date(Date.now() - 30 * 60_000) }).where(eq(scans.id, id));
    expect(await scanInProgress(db, practiceId)).toBe(true);
    await db.update(scans).set({ updatedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(scans.id, id));
    expect(await scanInProgress(db, practiceId)).toBe(false);
  });
});
