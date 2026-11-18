import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  loadEnv: () => ({ APP_URL: "http://localhost:3000", CRON_SECRET: "s", SCAN_RUNS: 3 }),
}));

import { liveStepDeps, LIVE_CONCURRENCY } from "@/services/scan-live";

describe("liveStepDeps", () => {
  it("asks a full scan's tools enough at once to finish within a few steps", () => {
    // A chain of more than five steps is refused by the host (a 508), which
    // failed a live audit at 119 of 120 answers. At four asks at a time a
    // 120-ask scan needs five or six steps; at twelve it needs two.
    expect(LIVE_CONCURRENCY).toBeGreaterThanOrEqual(12);
    for (const purpose of ["prospect", "weekly", "manual"] as const) {
      expect(liveStepDeps(purpose, 0).scanOptions.concurrency).toBe(LIVE_CONCURRENCY);
    }
  });

  it("gives the quick look its own tools, one try and tight limits", () => {
    const deps = liveStepDeps("quick", 0);
    expect(deps.adapters.map(a => a.name)).toEqual(["openai", "anthropic"]);
    expect(deps.scanOptions).toMatchObject({ runs: 1, retryDelaysMs: [2_000], finalRetryDelayMs: 3_000 });
    expect(deps.scanOptions.checkWebsite).toBeUndefined();
    expect(deps.scanOptions.checkAiOverviews).toBeUndefined();
    expect(deps).toMatchObject({ startBudgetMs: 45_000, hardStopMs: 75_000, maxSteps: 1, settleOnLast: true });
  });
});
