# Scan reliability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Short scans are labelled, badly short scans are blocked (never published), tool reach ignores dead engines, and the weekly cron fans out one function per practice.

**Architecture:** Pure coverage maths in `src/core/coverage.ts`. `runScan` retries failures once, computes coverage, and either blocks (writes coverage only) or records as today with reach over answering engines. `weekly-scan.ts` gets a per-practice unit that the new `/api/cron/scan-practice` route runs via `after()`; the existing cron route becomes a dispatcher.

**Tech Stack:** Next.js 16 (`after` from `next/server`), drizzle, vitest, Resend.

**Spec:** `docs/superpowers/specs/2026-09-30-scan-reliability-design.md`

## Global Constraints

- Block threshold: `answered / asked < 0.75` (and `asked > 0`).
- Engine "didn't respond": `answered < asked / 2`.
- One extra retry per failed call, after the normal `withRetry` backoff, pause default 5000ms (`ScanOptions.finalRetryDelayMs`).
- A blocked scan writes only `status: "blocked"`, `coverage`, `finishedAt` — no checks/findings/competitors/scores.
- Label copy: `Based on {n} of {m} AI tools. {names} didn't respond.` Blocked copy: `Only {pct}% of answers came back.` + ` {names} didn't respond.` when any engine is missing. Names: ChatGPT, Claude, Gemini, Grok, Perplexity, joined "A", "A and B", "A, B and C".
- New DB: `scan_status` + `blocked`; `scans.coverage jsonb null`.
- Don't commit code (same ruling as the last plan: the branch carries Nick's uncommitted work).

## Review Focus

1. A practice with zero active prompts: asked = 0 ⇒ not blocked, no label (Task 1 test).
2. An engine that answers some but under half: counted missing in the label, but its answers still score, and reach denominator counts it (≥1 answer) (Task 2 test).
3. The pulse the morning after a blocked scan must not resend last week's numbers (Task 4 test).
4. Dispatcher must not stop at one failing trigger (Task 3 test).
5. Old scans with `coverage` null show no label anywhere (Task 5: guarded by `?.`/null checks, covered in report test).

---

### Task 1: Coverage maths — `src/core/coverage.ts`, `tests/core/coverage.test.ts`

**Produces:** `ENGINE_NAMES: Record<Engine,string>`, `interface Coverage { asked: number; answered: number; engines: { engine: Engine; asked: number; answered: number }[]; missing: Engine[]; blocked: boolean }`, `summarizeCoverage(results: { engine: Engine; ok: boolean }[]): Coverage`, `coverageLabel(c: Coverage | null): string | null`, `blockedReason(c: Coverage): string`, `MIN_COVERAGE = 0.75`.

- [ ] Test first:

```ts
import { describe, it, expect } from "vitest";
import { summarizeCoverage, coverageLabel, blockedReason } from "@/core/coverage";
import type { Engine } from "@/core/types";

const res = (engine: Engine, ok: number, fail: number) => [
  ...Array(ok).fill({ engine, ok: true }), ...Array(fail).fill({ engine, ok: false }),
];

describe("coverage", () => {
  it("counts per engine and overall", () => {
    const c = summarizeCoverage([...res("openai", 10, 0), ...res("gemini", 0, 10)]);
    expect(c).toMatchObject({ asked: 20, answered: 10, missing: ["gemini"], blocked: true });
    expect(c.engines).toEqual([{ engine: "openai", asked: 10, answered: 10 }, { engine: "gemini", asked: 10, answered: 0 }]);
  });
  it("is not blocked at exactly 75%", () => {
    expect(summarizeCoverage([...res("openai", 3, 0), ...res("gemini", 0, 1)]).blocked).toBe(false);
  });
  it("marks an engine missing under half, not at half", () => {
    expect(summarizeCoverage([...res("openai", 4, 0), ...res("grok", 1, 1)]).missing).toEqual([]);
    expect(summarizeCoverage([...res("openai", 4, 0), ...res("grok", 1, 2)]).missing).toEqual(["grok"]);
  });
  it("treats an empty scan as complete", () => {
    expect(summarizeCoverage([])).toMatchObject({ asked: 0, answered: 0, missing: [], blocked: false });
  });
  it("labels only when an engine is missing", () => {
    const five = (["openai", "anthropic", "grok", "perplexity"] as Engine[]).flatMap(e => res(e, 10, 0));
    expect(coverageLabel(summarizeCoverage(five))).toBeNull();
    expect(coverageLabel(summarizeCoverage([...five, ...res("gemini", 0, 10)])))
      .toBe("Based on 4 of 5 AI tools. Gemini didn't respond.");
    expect(coverageLabel(null)).toBeNull();
  });
  it("explains a block", () => {
    const c = summarizeCoverage([...res("openai", 6, 0), ...res("gemini", 0, 2), ...res("grok", 0, 2)]);
    expect(blockedReason(c)).toBe("Only 60% of answers came back. Gemini and Grok didn't respond.");
  });
});
```

- [ ] Run → FAIL (module missing). Implement:

```ts
import type { Engine } from "@/core/types";

export const MIN_COVERAGE = 0.75;
export const ENGINE_NAMES: Record<Engine, string> = {
  openai: "ChatGPT", anthropic: "Claude", gemini: "Gemini", grok: "Grok", perplexity: "Perplexity",
};

export interface Coverage {
  asked: number;
  answered: number;
  engines: { engine: Engine; asked: number; answered: number }[];
  /** Engines that answered under half of what they were asked. */
  missing: Engine[];
  /** Under 75% of all answers came back: the scan must not be published. */
  blocked: boolean;
}

export function summarizeCoverage(results: { engine: Engine; ok: boolean }[]): Coverage {
  const byEngine = new Map<Engine, { engine: Engine; asked: number; answered: number }>();
  for (const r of results) {
    const e = byEngine.get(r.engine) ?? { engine: r.engine, asked: 0, answered: 0 };
    e.asked++;
    if (r.ok) e.answered++;
    byEngine.set(r.engine, e);
  }
  const engines = [...byEngine.values()];
  const asked = results.length;
  const answered = results.filter(r => r.ok).length;
  return {
    asked, answered, engines,
    missing: engines.filter(e => e.answered < e.asked / 2).map(e => e.engine),
    blocked: asked > 0 && answered / asked < MIN_COVERAGE,
  };
}

function listNames(engines: Engine[]): string {
  const names = engines.map(e => ENGINE_NAMES[e]);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Based on 4 of 5 AI tools. Gemini didn't respond.", or null when nothing is missing. */
export function coverageLabel(c: Coverage | null): string | null {
  if (!c || c.missing.length === 0) return null;
  const total = c.engines.length;
  return `Based on ${total - c.missing.length} of ${total} AI tools. ${listNames(c.missing)} didn't respond.`;
}

export function blockedReason(c: Coverage): string {
  const pct = c.asked ? Math.round((100 * c.answered) / c.asked) : 0;
  const who = c.missing.length ? ` ${listNames(c.missing)} didn't respond.` : "";
  return `Only ${pct}% of answers came back.${who}`;
}
```

- [ ] Run → PASS.

---

### Task 2: Scan runner — retry, coverage, block, reach

**Files:** `src/db/schema.ts`, `src/services/scan-runner.ts`, `tests/services/scan-runner.test.ts`
**Consumes:** Task 1. **Produces:** `runScan(...)` returns `{ scanId: string; score: number | null; newFindings: NewFinding[]; blocked: boolean; coverage: Coverage }`; `ScanOptions.finalRetryDelayMs?: number`; `scans.coverage: Coverage | null`; status `"blocked"`.

- [ ] Schema: `scanStatusEnum` → `["running", "complete", "failed", "blocked"]`; in `scans` after `websiteCheck`:
  ```ts
  // How many of the answers the scan asked for came back, per engine. Null on
  // scans from before this was recorded.
  coverage: jsonb("coverage").$type<import("@/core/coverage").Coverage>(),
  ```
- [ ] Tests (append a `describe("runScan coverage")`; every call passes `{ retryDelaysMs: [], finalRetryDelayMs: 0 }`):
  1. *retries a failed call once at the end*: adapter fails the first 1 call then succeeds → 1 check, coverage answered = asked = 1, `blocked` false.
  2. *labels a short scan but still scores it*: prompts 2 category; openai ok, anthropic ok, grok ok, perplexity ok, gemini always fails → status complete, `coverage.missing` = ["gemini"], score > 0, and `breadthScore` = 100 when all four answering engines named the client (reach over answering engines).
  3. *blocks a badly short scan and keeps last week's*: first scan all ok (complete); second scan where 3 of 4 engines always fail → second scan status "blocked", `score` null, no checks with that scanId, `getLatestScan` returns the first scan's id, result `blocked: true`, and an internal activity starting "scan blocked:".
- [ ] Run → FAIL. Implement in `runScan`:
  - After `gathered = await mapPool(...)`, retry failed ones: extract the worker body into `const gather = async ({prompt, run, adapter}) => {...}` (the existing arrow), then
    ```ts
    const failed = gathered.map((g, i) => (g.ok ? -1 : i)).filter(i => i >= 0);
    if (failed.length) {
      await sleep(options.finalRetryDelayMs ?? 5_000);
      const retried = await mapPool(failed.map(i => tasks[i]), concurrency, gather);
      failed.forEach((i, k) => { gathered[i] = retried[k]; });
    }
    const coverage = summarizeCoverage(gathered.map(g => ({ engine: g.adapter.name, ok: g.ok })));
    if (coverage.blocked) {
      await db.update(scans).set({ status: "blocked", coverage, finishedAt: new Date() }).where(eq(scans.id, scan.id));
      await logActivity(db, practiceId, `scan blocked: ${blockedReason(coverage)}`);
      return { scanId: scan.id, score: null, newFindings: [], blocked: true, coverage };
    }
    ```
    (`await websiteCheck` is left un-awaited on block — attach `.catch(() => null)` already; that's fine.)
  - `engineCount` = `new Set(gathered.filter(g => g.ok).map(g => g.adapter.name)).size || adapters.length`.
  - Add `coverage` to the final `scans` update; return `{ scanId, score, newFindings, blocked: false, coverage }`.
- [ ] Update callers for `score: number | null`: `scripts/scan-once.ts` (print "blocked" when `blocked`), `weekly-scan.ts` (Task 3).
- [ ] Run scan-runner tests → PASS; `npx tsc --noEmit`.

---

### Task 3: Weekly fan-out and blocked alert

**Files:** `src/services/weekly-scan.ts`, `src/services/alert-email.ts`, `src/app/api/cron/weekly-scan/route.ts`, create `src/app/api/cron/scan-practice/route.ts`, `tests/app/cron.test.ts`, `tests/services/send-alert.test.ts`
**Produces:** `composeBlockedAlert({ practiceName, slug, reason, appUrl }): { subject; html }`, `sendBlockedAlert(db, practice, coverage, transport?)`; `scanPracticeWeekly(db, practice, deps): Promise<WeeklyScanResult>`; `dispatchWeeklyScans(db, trigger: (practiceId: string) => Promise<void>): Promise<{ practice: string; dispatched: boolean; error?: string }[]>`; `WeeklyScanResult` gains `| { practice: string; blocked: true }`.

- [ ] Tests:
  - send-alert: `composeBlockedAlert` subject `Mirror: scan blocked for Glow MedSpa`, html contains the escaped reason and "Last week's score stays up".
  - cron: runWeeklyScans with an adapter that always throws for a practice → result `{ practice, blocked: true }`, findings `send` not called, blocked sender called once.
  - cron: `dispatchWeeklyScans` calls trigger once per **active** practice; a throwing trigger yields `dispatched: false` with error and the others still run.
- [ ] Implement:
  - `alert-email.ts`: `composeBlockedAlert` (escapeHtml the reason; link to `/admin`), `sendBlockedAlert` (same transport/recipient/`logActivity`-on-failure pattern as `sendAlert`).
  - `weekly-scan.ts`: `scanPracticeWeekly(db, practice, { adapters, judge, extractor, send = sendAlert, sendBlocked = sendBlockedAlert, scanOptions })` → runs `runScan`; blocked → `sendBlocked` and `{ practice: slug, blocked: true }`; else existing alert path. `runWeeklyScans(db, adapters, judge, extractor, send, scanOptions, sendBlocked?)` keeps its signature (new optional last param) and loops `scanPracticeWeekly` in try/catch. `dispatchWeeklyScans` loops active practices with `Promise.allSettled`.
  - `api/cron/scan-practice/route.ts`: `maxDuration = 800`, `dynamic = "force-dynamic"`, GET checks bearer, reads `id`, loads the practice (404 if missing/inactive), `after(() => scanPracticeWeekly(getDb(), practice, { real deps }).catch(err => console.error(...)))`, returns `Response.json({ queued: practice.slug }, { status: 202 })`.
  - `api/cron/weekly-scan/route.ts`: `maxDuration = 60`; `dispatchWeeklyScans(db, id => fetch(`${APP_URL}/api/cron/scan-practice?id=${id}`, { headers: { authorization: `Bearer ${CRON_SECRET}` } }).then(r => { if (!r.ok) throw new Error(`scan-practice ${r.status}`); }))`.
- [ ] Run tests → PASS; tsc.

---

### Task 4: Pulse — skip after a bad scan, show the label

**Files:** `src/lib/queries.ts` (add `getLatestScanAttempt`), `src/services/pulse-email.ts`, `tests/services/send-pulse.test.ts`, `tests/services/pulse-email.test.ts`

- [ ] Tests: sendPulse doesn't call transport when a newer `blocked` scan exists after a complete one; composePulse with `coverageNote: "Based on 4 of 5 AI tools. Gemini didn't respond."` includes it; with null doesn't.
- [ ] Implement: `getLatestScanAttempt(db, practiceId)` = newest scan of any status. `sendPulse`: `const attempt = await getLatestScanAttempt(...)`; `if (!attempt || attempt.status !== "complete") return;` then proceed with `latest = attempt`. `PulseArgs.coverageNote: string | null`; `composePulse` pushes `row(escape(note))` after the score row. Pass `coverageLabel(latest.coverage)`.

---

### Task 5: Show it — dashboard, report, admin

**Files:** `src/report/types.ts` (`scan.coverageNote: string | null`), `src/report/build-report.ts`, `src/report/sample-audit.json` (`"coverageNote": null`), `src/report/pages/master-score-tools.tsx`, `src/report/pages/master-method.tsx`, `src/app/dashboard/[slug]/page.tsx`, `src/app/admin/practices/[id]/page.tsx`, `tests/report/build-report.test.ts`

- [ ] Test: report built from a scan where one engine always fails has `scan.coverageNote` = the label; the existing fixture's is null.
- [ ] Implement: build-report sets `coverageNote: coverageLabel(scan.coverage)` and `tools` stays as engines with checks. P03 and method page render the note (small, `#B45309`) when set. Dashboard renders it under the explanation line. Admin: fetch `getLatestScanAttempt`; when its id ≠ latestScan's id or it has a label, show a line: blocked → `Latest attempt {date} blocked: {blockedReason}`; running → `Scan running since {time}`; failed → `Latest attempt {date} failed — see diagnostics`; complete with label → the label.
- [ ] Full verification: tsc, eslint, `npm test`, `npm run build`.
