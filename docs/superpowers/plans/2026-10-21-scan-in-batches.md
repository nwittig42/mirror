# Scan in batches — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A scan finishes on the Vercel Hobby plan (300s per function) by running as a chain of short steps, each its own function call, instead of one 5–7 minute call that Vercel kills.

**Architecture:** Every answer an engine gives (plus its extractor, judge and tone reading) is saved to a new `scan_answers` table the moment it is read. A step works through the answers not yet saved until its time budget runs out, then starts the next step with an HTTP request to `/api/cron/scan-step`. When every answer is saved (and the one retry pass is done), a final step rebuilds the `Gathered[]` list from the table and runs today's record phase unchanged. What happens after a scan (weekly alerts, the prospect email and lead status) moves into a per-purpose completion hook, because the function that started the scan is long gone by then.

**Tech Stack:** Next.js 16 (`after` from `next/server`), drizzle + Neon (PGlite in tests), vitest.

**Spec:** None written; the design is the Architecture above plus the diagnosis below.

**Diagnosis (2026-10-21):** `SCAN_DEADLINE_MS = 650_000` assumes Vercel Pro's 800s; every route is `maxDuration = 300`. Finished scans took 304s and 414s. Both scans from 2026-10-15 were killed and left `running` (since marked `failed` by hand). The weekly stagger (`staggerSeconds`, up to 275s) also comes out of the same 300s. Lead setup does site reading and drafting before the scan, inside the same budget.

## Global Constraints

- Every route that runs a step keeps `maxDuration = 300`.
- `STEP_START_BUDGET_MS = 150_000`: no new engine call (or retry) starts after this, measured from when the step's function was invoked.
- `STEP_HARD_STOP_MS = 250_000`: at this point the step stops waiting for calls still running and hands off. Those answers stay unsaved and are asked again by the next step.
- `MAX_STEPS = 12`: a scan that hasn't finished by then is marked `failed` with the activity note `scan failed: ran out of steps`.
- Answers are keyed `(scan_id, prompt_id, run, engine)`, unique. Writes use `onConflictDoNothing`, so a late write from an abandoned call or a cron delivered twice can't create duplicates.
- Behaviour must not change: the same checks, findings, coverage, block rule, scores, band and activity lines as today's `runScan`. Today's `tests/services/scan-runner.test.ts` must pass unchanged against the new path.
- Don't commit unless Nick asks. Other sessions work in this folder (see memory).

## Review Focus

1. A step delivered twice (Vercel retry, double fetch): only one step runs for each step number (Task 3 test: second claim returns null).
2. The handoff request fails (network, bad `APP_URL`): the scan must not hang in `running` forever. `scanLooksStuck` uses `updatedAt`, so it is marked failed 10 minutes after the last progress (Task 3 test).
3. A practice with zero active prompts: the first step finds no tasks and goes straight to finish (Task 2 test).
4. The weekly stagger delay is longer than the start budget: step 1 saves nothing and hands off, and the scan still completes (Task 4 test).
5. A prospect scan that blocks still leaves the lead in `needs_attention` with the blocked note. One that completes still sends the audit email exactly once (Task 5 test).

---

### Task 1: Stopgap. Make today's scans settle inside 300s

Ships on its own, before the rest, so the live site stops leaving scans stuck as `running`.

**Files:**
- Modify: `src/services/scan-runner.ts:99-104` (`SCAN_DEADLINE_MS`)
- Modify: `src/app/api/cron/scan-practice/route.ts` (delay handling)
- Test: `tests/services/scan-runner.test.ts`

- [ ] **Step 1: Failing test.** `it("SCAN_DEADLINE_MS leaves room inside a 300s function")`: `expect(SCAN_DEADLINE_MS).toBeLessThanOrEqual(150_000)`.
- [ ] **Step 2:** Run `npx vitest run tests/services/scan-runner.test.ts`. Expected: FAIL (650000).
- [ ] **Step 3:** Set `SCAN_DEADLINE_MS = 150_000`. Rewrite its comment to say it fits Hobby's 300s and that engine calls time out at 120s. In `scan-practice/route.ts`, cap `delaySec` at 60 instead of 300.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.

Expect more blocked scans until Task 4 lands, since fewer answers come back in 150s. Blocked is better than stuck: it shows up in admin and sends the blocked alert.

---

### Task 2: Save answers as they come back, and split `runScan` into gather and finish

**Files:**
- Modify: `src/db/schema.ts`: new table `scanAnswers`; on `scans`, add `step integer not null default 0`, `purpose text not null default 'manual'` (`'manual' | 'weekly' | 'prospect'`) and `updatedAt timestamp not null default now()`.
- Create: `drizzle/0004_*.sql` via `npx drizzle-kit generate`.
- Modify: `src/services/scan-runner.ts`
- Test: `tests/services/scan-runner.test.ts`, `tests/db/schema.test.ts`

`scan_answers` columns: `id uuid pk`, `scanId → scans.id`, `promptId → prompts.id`, `run int`, `engine text`, `ok bool`, `retriable bool`, `attempts int default 1`, `answer text null`, `citations jsonb`, `searchQueries jsonb`, `tone jsonb null`, `discovered jsonb null`, `judged jsonb null` (stored as `{ result: JudgeResult | null } | null`, so "not judged", which is `undefined` today, and "judge failed", which is `null`, stay different), `createdAt`. Unique index on `(scanId, promptId, run, engine)`.

**Interfaces (produces):**
- `startScan(db: Db, practiceId: string, opts: { runs: number; purpose: ScanPurpose }): Promise<string>` inserts the scan row and returns its id.
- `gatherStep(db: Db, scanId: string, adapters: EngineAdapter[], judge: Judge, extractor: Extractor, options: ScanOptions & { startBy: number; stopBy: number }): Promise<{ done: boolean }>`. It loads the same context `runScan` loads today and builds the same task list. It skips tasks already saved with `ok` or with `attempts >= 2`, and runs the rest through today's `mapPool`/`limiter`/`read`, saving each result with `onConflictDoNothing` (a retry pass updates `attempts`, `ok` and the payload by key). It returns `done: true` when no task still needs a call. The retry pass is any saved `ok=false, retriable=true, attempts=1` row, and it runs only once every task has a row. The website check and AI overviews run only in the step where `scans.websiteCheck` / `aiOverviews` are still null; they write their result to the scan row straight away and stop waiting at `stopBy`. Every saved answer bumps `scans.updatedAt`.
- `finishScan(db: Db, scanId: string, adapterNames: string[], options: Pick<ScanOptions, "rateTone">): Promise<ScanResult>` rebuilds `Gathered[]` from `scan_answers` in task order and runs today's lines 353–624 unchanged: the warnings, coverage/block, record phase, findings, scores and activity. Website check and overviews come from the scan row, not promises.
- `runScan(...)` keeps its signature: `startScan`, then `gatherStep` with no budget until done, then `finishScan`. This keeps the admin button, tests and local runs working.
- `withRetry` gains an optional `startBy`: it doesn't sleep or retry past it, and throws the last error instead.

- [ ] **Step 1: Failing tests** in `scan-runner.test.ts`:
  - `"a scan gathered over several steps records the same checks as one run"`: one fake adapter counts its calls. Run `gatherStep` with `startBy` already passed after 1 call (inject a clock via `options.now?: () => number`). Repeat until `done`, then call `finishScan`. Expect `checks` rows = prompts × runs × adapters, and each task's adapter called exactly once.
  - `"a step skips answers already saved"`: insert one `scan_answers` row by hand; expect that task's adapter not to be called.
  - `"zero prompts goes straight to done"`: `gatherStep` returns `{ done: true }` on the first call, and `finishScan` completes.
  - `"judged undefined vs null survive the round trip"`: a judge that throws on one answer. Expect the `judge failed` activity line exactly as `runScan` logs it today.
- [ ] **Step 2:** Run `npx vitest run tests/services/scan-runner.test.ts`. Expected: the new tests FAIL (the exports don't exist yet).
- [ ] **Step 3:** Schema plus `npx drizzle-kit generate`, then the four functions above.
- [ ] **Step 4:** Run `npm test`. Expected: all pass, including every existing `runScan` test, unchanged.

---

### Task 3: The step route and the chain

**Files:**
- Create: `src/services/scan-chain.ts`
- Create: `src/app/api/cron/scan-step/route.ts`
- Modify: `src/services/scan-runner.ts` (`scanLooksStuck`)
- Test: `tests/services/scan-chain.test.ts`, `tests/app/cron.test.ts`

**Interfaces (produces):**
- `claimStep(db: Db, scanId: string, step: number): Promise<boolean>` runs `update scans set step = $step, updated_at = now() where id = $id and step = $step - 1 and status = 'running'`. True only when the update hit a row.
- `runStep(db: Db, scanId: string, step: number, deps: StepDeps): Promise<"continued" | "finished" | "skipped">`, where `StepDeps = { adapters, judge, extractor, scanOptions, invokedAt: number, triggerNext: (scanId: string, step: number) => Promise<void>, onComplete: (db, scanId, result: ScanResult) => Promise<void> }`. It claims the step (`skipped` if the claim fails) and stops at `MAX_STEPS` (marks the scan failed). It calls `gatherStep` with `startBy = invokedAt + STEP_START_BUDGET_MS` and `stopBy = invokedAt + STEP_HARD_STOP_MS`. If that isn't done it calls `triggerNext(scanId, step + 1)`; if it is done it calls `finishScan` and then `onComplete`.
- `makeStepTrigger({ appUrl, cronSecret, bypassSecret })`: same shape as `makeScanTrigger` in `weekly-scan.ts`. It sends `GET /api/cron/scan-step?scan=<id>&step=<n>` with the bearer and bypass headers and a 20s timeout, and throws on a non-2xx response.
- `startScanChain(db, practiceId, purpose, deps)` is `startScan` followed by `runStep(…, 1, …)`. Every caller uses this from now on.
- Route `scan-step`: `maxDuration = 300`, `dynamic = "force-dynamic"`, the same bearer check as `scan-practice`. It answers `202` straight away and runs `runStep` in `after()` with `invokedAt = Date.now()` taken before `after`. `onComplete` comes from `completionFor(purpose)` (Task 5).
- `scanLooksStuck(updatedAt: Date, now?)` measures from the last progress, 10 minutes (`SCAN_STUCK_AFTER_MS = 10 * 60_000`). Callers pass `scan.updatedAt` instead of `startedAt`.

- [ ] **Step 1: Failing tests** in `scan-chain.test.ts`:
  - `"a second claim of the same step is refused"`: the first `claimStep(…, 1)` returns true and the second returns false.
  - `"runStep hands off when gather isn't done, and finishes when it is"`: a fake `triggerNext` records its calls, and a test loop calls `runStep` for each recorded step. Expect the scan to end `complete`, `onComplete` called once, and `triggerNext` called once per unfinished step.
  - `"MAX_STEPS marks the scan failed"`.
  - `"a scan with no progress for 10 minutes looks stuck"`.
  - In `cron.test.ts`: `"scan-step rejects a bad token"`.
- [ ] **Step 2:** Run `npx vitest run tests/services/scan-chain.test.ts tests/app/cron.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.

---

### Task 4: Move weekly scans and the admin "run scan" button onto the chain

**Files:**
- Modify: `src/app/api/cron/scan-practice/route.ts`, `src/services/weekly-scan.ts` (`scanPracticeWeekly` splits into "start" and a `weeklyComplete(db, scanId, result)` hook that sends today's alerts), `src/app/admin/actions.ts:395-403`
- Test: `tests/app/cron.test.ts`, `tests/app/admin-actions.test.ts`

- [ ] **Step 1: Failing tests:**
  - `"scan-practice starts a chain with purpose weekly"`: the scan row has `purpose = 'weekly'` and `step = 1`.
  - `"a stagger longer than the start budget still completes"`: `invokedAt` is set 200s in the past, so step 1 saves nothing and triggers step 2, and step 2 completes.
  - `"weeklyComplete sends the findings alert, or the blocked alert when blocked"` (move today's two assertions here).
  - Admin: `"run scan starts a chain with purpose manual"`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Swap the `runScan` calls for `startScanChain`. The stagger delay now counts against step 1's budget, because `invokedAt` is taken before the sleep.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.

---

### Task 5: Move lead setup onto the chain

**Files:**
- Modify: `src/services/prospect-setup.ts`, `src/services/prospect-start.ts`
- Create: `completionFor(purpose)` in `src/services/scan-chain.ts`, which maps `weekly → weeklyComplete`, `prospect → prospectComplete` and `manual → no-op`
- Test: `tests/services/prospect-setup.test.ts`

`ProspectDeps.scan` becomes `startScan: (db, practiceId) => Promise<void>`. `prepareProspect` stops right after starting the chain and leaves the lead `preparing`. A new `prospectComplete(db: Db, scanId: string, result: ScanResult, deps: Pick<ProspectDeps, "notify" | "sendAudit">)` finds the lead by `leads.practiceId`, then does lines 168–184 of today's `setUp`: a blocked scan gives `needs_attention` with the blocked note, otherwise it sends the audit, sets `auditEmailedAt` and marks the lead `ready`. If the scan is marked `failed`, the lead gets `needs_attention` with `The first scan failed: …`.

- [ ] **Step 1: Failing tests:**
  - `"setup leaves the lead preparing once the scan has started"`.
  - `"prospectComplete marks ready and emails once"`: call it twice and expect one email (it skips when `auditEmailedAt` is already set).
  - `"prospectComplete on a blocked scan sets needs_attention with the reason"`.
  - Keep today's site/drafting tests, adjusted for the new `startScan` dep.
- [ ] **Step 2:** Run `npx vitest run tests/services/prospect-setup.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`, then `npm run lint`. Expected: clean.

---

### Task 6: Check it on a live preview

- [ ] Push the branch and wait for the Vercel preview (`gh api repos/nwittig42/mirror/deployments`, status `success`).
- [ ] Confirm `APP_URL` and `VERCEL_AUTOMATION_BYPASS_SECRET` are set for Preview in Vercel. Every handoff depends on them.
- [ ] Press "run scan" on one business in preview admin. Watch the `scans` row: `step` should climb to 2–3, then `status = complete` within about 8 minutes, with `checks` = prompts × runs × engines minus failures.
- [ ] Submit `/book` with a test lead. The lead should reach `ready`, and the audit email should arrive.
- [ ] Separately: production hasn't deployed since 2026-10-05 (that build failed). Run `npx vercel inspect dpl_683ozccnnofB3XU7M2WXtDmpnS79 --logs`, fix the cause, and redeploy production once this is merged.
