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

/** The real engines, readers, step trigger and completion for one step of a scan. */
export function liveStepDeps(purpose: ScanPurpose, invokedAt: number): StepDeps {
  const env = loadEnv();
  return {
    adapters: getAdapters(), judge: judgeAnswer, extractor: extractCompetitors,
    scanOptions: { runs: env.SCAN_RUNS, rateTone, checkWebsite: runWebsiteCheck, checkAiOverviews: aiOverviewCheck() },
    invokedAt,
    triggerNext: makeStepTrigger({
      appUrl: env.APP_URL, cronSecret: env.CRON_SECRET, bypassSecret: env.VERCEL_AUTOMATION_BYPASS_SECRET,
    }),
    ...completionFor(purpose),
  };
}
