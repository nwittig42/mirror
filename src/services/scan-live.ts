import { loadEnv } from "@/lib/env";
import { getAdapters } from "@/engines";
import { judgeAnswer } from "@/services/hallucination-judge";
import { extractCompetitors } from "@/services/competitor-extractor";
import { rateTone } from "@/services/tone-rater";
import { runWebsiteCheck } from "@/services/website-check";
import { aiOverviewCheck } from "@/services/ai-overviews";
import { makeStepTrigger, type StepDeps } from "@/services/scan-chain";
import { completionFor } from "@/services/scan-completion";
import type { ScanPurpose } from "@/services/scan-runner";
import { quickAdapters, QUICK_HARD_STOP_MS, QUICK_START_BUDGET_MS } from "@/services/quick-scan";

/**
 * Engine requests in flight at once for a full scan. A scan runs as a chain
 * of steps, each started by the one before, and the host refuses a chain
 * much longer than five (a 508): a live audit failed that way at 119 of 120
 * answers. Four at a time needs five or six steps for 120 asks; twelve needs
 * two, about three per tool.
 */
export const LIVE_CONCURRENCY = 12;

/** The real engines, readers, step trigger and completion for one step of a scan. */
export function liveStepDeps(purpose: ScanPurpose, invokedAt: number): StepDeps {
  const env = loadEnv();
  const triggerNext = makeStepTrigger({
    appUrl: env.APP_URL, cronSecret: env.CRON_SECRET, bypassSecret: env.VERCEL_AUTOMATION_BYPASS_SECRET,
  });
  if (purpose === "quick") {
    // The quick look: two tools, one try each, every ask at once, and a hard
    // limit on how long it waits. The website check and Google's AI Overviews
    // are left to the full scan that follows.
    return {
      adapters: quickAdapters(getAdapters()), judge: judgeAnswer, extractor: extractCompetitors,
      scanOptions: { runs: 1, rateTone, concurrency: 64, retryDelaysMs: [2_000], finalRetryDelayMs: 3_000 },
      invokedAt, triggerNext,
      startBudgetMs: QUICK_START_BUDGET_MS, hardStopMs: QUICK_HARD_STOP_MS, maxSteps: 1, settleOnLast: true,
      ...completionFor(purpose),
    };
  }
  return {
    adapters: getAdapters(), judge: judgeAnswer, extractor: extractCompetitors,
    scanOptions: {
      runs: env.SCAN_RUNS, concurrency: LIVE_CONCURRENCY, rateTone, checkWebsite: runWebsiteCheck, checkAiOverviews: aiOverviewCheck(),
    },
    invokedAt,
    triggerNext,
    ...completionFor(purpose),
  };
}
