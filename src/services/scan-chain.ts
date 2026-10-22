import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { scans } from "@/db/schema";
import type { EngineAdapter } from "@/engines/types";
import type { judgeAnswer } from "@/services/hallucination-judge";
import type { extractCompetitors } from "@/services/competitor-extractor";
import {
  startScan, gatherStep, finishScan, type ScanOptions, type ScanPurpose, type ScanResult,
} from "@/services/scan-runner";
import { logActivity } from "@/services/activity";

/**
 * A scan is a few hundred slow engine calls, more than one 300s function can
 * make. So it runs as a chain of steps, each its own function call: a step
 * asks what it can in its time, saves every answer as it comes back, and
 * starts the next step with a request to /api/cron/scan-step. The step that
 * finds nothing left to ask records the scan.
 */

/** No new engine call starts this long after the step's function was invoked. */
export const STEP_START_BUDGET_MS = 150_000;
/** At this point the step stops waiting for calls still running and hands off. */
export const STEP_HARD_STOP_MS = 250_000;
/** The last step settles on what came back instead of handing off again. */
export const MAX_STEPS = 12;

export interface StepDeps {
  adapters: EngineAdapter[];
  judge: typeof judgeAnswer;
  extractor: typeof extractCompetitors;
  scanOptions: ScanOptions;
  /** Epoch ms when this step's function was invoked; its budget runs from here. */
  invokedAt: number;
  /** The clock, for tests. */
  now?: () => number;
  /** Starts step `step` of the scan in a function call of its own. */
  triggerNext: (scanId: string, step: number) => Promise<void>;
  /** What to do with a scan once it is recorded, by its purpose. */
  onComplete: (db: Db, scanId: string, result: ScanResult) => Promise<void>;
  /** What to do when a scan fails, so nothing waits on it forever. */
  onFailed: (db: Db, scanId: string, reason: string) => Promise<void>;
}

const errorText = (err: unknown): string => String(err instanceof Error ? err.message : err).slice(0, 200);

/**
 * Takes step `step` of a running scan. Only one call can: a step delivered
 * twice (a retried request, a double fetch) finds the step already taken.
 */
export async function claimStep(db: Db, scanId: string, step: number): Promise<boolean> {
  const rows = await db.update(scans)
    .set({ step, updatedAt: new Date() })
    .where(and(eq(scans.id, scanId), eq(scans.step, step - 1), eq(scans.status, "running")))
    .returning({ id: scans.id });
  return rows.length > 0;
}

/**
 * Runs one step of a scan: gathers answers until the step's budget is spent,
 * then either starts the next step or, when nothing is left to ask, records
 * the scan and hands it to `onComplete`. Recording gets a step of its own
 * when gathering used up this one's time.
 */
export async function runStep(
  db: Db, scanId: string, step: number, deps: StepDeps,
): Promise<"continued" | "finished" | "skipped"> {
  if (!(await claimStep(db, scanId, step))) return "skipped";
  const now = deps.now ?? Date.now;
  const startBy = deps.invokedAt + STEP_START_BUDGET_MS;
  const last = step >= MAX_STEPS;

  // Only while this step is still the latest: a handoff that timed out may
  // have started the next step anyway, and that one carries on.
  const fail = async (reason: string) => {
    const failed = await db.update(scans).set({ status: "failed", finishedAt: new Date() })
      .where(and(eq(scans.id, scanId), eq(scans.status, "running"), eq(scans.step, step)))
      .returning({ practiceId: scans.practiceId });
    if (failed.length === 0) return;
    await logActivity(db, failed[0].practiceId, `scan failed: ${reason}`);
    await deps.onFailed(db, scanId, reason).catch(() => undefined);
  };

  try {
    if (step > MAX_STEPS) {
      await fail("ran out of steps");
      return "finished";
    }
    const { done } = await gatherStep(db, scanId, deps.adapters, deps.judge, deps.extractor, {
      ...deps.scanOptions, startBy, stopBy: deps.invokedAt + STEP_HARD_STOP_MS, now: deps.now, lastChance: last,
    });
    if (!done || (!last && now() > startBy)) {
      try {
        await deps.triggerNext(scanId, step + 1);
      } catch (err) {
        await fail(`couldn't start step ${step + 1}: ${errorText(err)}`);
        return "finished";
      }
      return "continued";
    }
    const result = await finishScan(db, scanId, deps.adapters.map(a => a.name), deps.scanOptions);
    await deps.onComplete(db, scanId, result);
    return "finished";
  } catch (err) {
    // gatherStep and finishScan mark the scan failed themselves; this tells
    // whatever is waiting on it.
    await deps.onFailed(db, scanId, errorText(err)).catch(() => undefined);
    throw err;
  }
}

/** Opens a scan and runs its first step in this function call. Returns the scan id. */
export async function startScanChain(db: Db, practiceId: string, purpose: ScanPurpose, deps: StepDeps): Promise<string> {
  const scanId = await startScan(db, practiceId, { runs: deps.scanOptions.runs ?? 1, purpose });
  await runStep(db, scanId, 1, deps);
  return scanId;
}

/**
 * The real `triggerNext`: a request to the step route. Times out rather than
 * holding the step, and sends Vercel's protection-bypass header when one is
 * configured so a protected deployment doesn't answer with a 401.
 */
export function makeStepTrigger(args: {
  appUrl: string;
  cronSecret: string;
  bypassSecret?: string;
  fetchImpl?: typeof fetch;
}): (scanId: string, step: number) => Promise<void> {
  const base = args.appUrl.replace(/\/+$/, "");
  const doFetch = args.fetchImpl ?? fetch;
  return async (scanId, step) => {
    const url = `${base}/api/cron/scan-step?scan=${encodeURIComponent(scanId)}&step=${step}`;
    const headers: Record<string, string> = { authorization: `Bearer ${args.cronSecret}` };
    if (args.bypassSecret) headers["x-vercel-protection-bypass"] = args.bypassSecret;
    const res = await doFetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`scan-step ${res.status}`);
  };
}
