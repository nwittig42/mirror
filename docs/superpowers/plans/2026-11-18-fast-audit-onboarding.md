# Fast Audit and Step-by-Step Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A visitor who pastes a website gets a quick audit in 1 to 2 minutes, behind a three-step onboarding with the audit's progress pinned on top, and sees it in their dashboard once they have a login; the full audit follows in the background.

**Architecture:** A new scan purpose `quick` (ChatGPT and Claude, one try per question, all asks at once, tight time limits) runs first from the existing prospect setup. Its completion, whatever the outcome, starts today's full `prospect` scan in a function call of its own. One shared rule decides which complete scan each surface shows. `/audit/[id]` becomes a stepper under a sticky progress bar.

**Tech Stack:** Next.js App Router (server actions, `after()`), TypeScript, Drizzle on Neon Postgres, Auth.js credentials, vitest with PGlite (`tests/helpers/db.ts`).

**Spec:** `docs/superpowers/specs/2026-11-18-fast-audit-onboarding-design.md`

## Global Constraints

- No schema change: `scans.purpose` is free text; `"quick"` is a new value.
- No commits unless Nick asks. Where a task says "checkpoint", run the named tests and move on.
- Never run `next build` while the dev server on localhost:3000 is up; if it goes down, restart it with `npm run dev`.
- The local database is the live Neon database. Tests use PGlite only. Do not delete rows.
- Copy is plain, sentence case, no jargon, no em dashes. Name only AI tools that were actually asked.
- Audits already in flight (purpose `prospect`) and existing `/audit/<id>` links must keep working.
- Quick scan values: tools `openai` and `anthropic`; `runs: 1`; no new ask after 45 s; stop waiting at 75 s; one retry delay of 2 s; final retry pause 3 s; one step only.
- Verify with `npm test` and `npm run lint` (both exist in package.json).

## Review Focus

1. One of the two quick tools fails every ask (50% coverage, so the quick scan is blocked): the visitor never sees "failed", and the full audit starts. Pinned in Task 3 and Task 5.
2. The quick scan's completion is delivered twice: exactly one full scan is started. Pinned in Task 3.
3. A visitor submits a password before the business record exists: a "try again in a moment" message, not an error page. Pinned in Task 6.
4. An old link for a lead that is `ready` with an email and no login (previously the public results page): the page offers the login step and says the audit is ready. Pinned in Task 7.
5. The dashboard shows a quick scan, then the full one lands: the full one is shown with no "change since last scan" against the quick one. Pinned in Task 1.

---

### Task 1: One rule for which complete scan is shown

**Files:**
- Create: `src/lib/published-scan.ts`
- Modify: `src/lib/queries.ts:55-75` (`getLatestScan`, `getScoreHistory`), `src/lib/report.ts:136-155`, `src/services/pulse-email.ts:144`
- Test: `tests/lib/published-scan.test.ts`, extend `tests/lib/queries.test.ts`

**Interfaces:**
- Produces:
  - `export const QUICK_PURPOSE = "quick"`
  - `export function shownScanWhere(practiceId: string): SQL` — complete scans of the practice, leaving out quick ones once any complete non-quick scan exists.
  - `export function fullScanWhere(practiceId: string): SQL` — complete scans that are not quick.

- [ ] **Step 1: Write the failing tests** in `tests/lib/published-scan.test.ts` (PGlite via `makeTestDb`, `seedPractice`; insert `scans` rows directly with `status`, `purpose`, `startedAt`):

```ts
it("shows the quick scan while it is the only complete one", ...)      // getLatestScan(db, id)?.purpose === "quick"
it("ignores the quick scan once a full scan is complete", ...)          // quick older, prospect newer -> latest is prospect; getScoreHistory returns 1 row
it("ignores a quick scan that is newer than the full one", ...)         // prospect older, quick newer -> latest is prospect
it("keeps showing the quick scan when the full one is blocked", ...)    // quick complete, prospect blocked -> latest is quick
it("never gives a quick scan to the report", ...)                        // rows matching fullScanWhere exclude quick
```

- [ ] **Step 2: Run** `npx vitest run tests/lib/published-scan.test.ts` — expected: FAIL, module not found.
- [ ] **Step 3: Implement** `shownScanWhere` as `status = 'complete' AND (purpose <> 'quick' OR NOT EXISTS (complete non-quick scan of the same practice))` with drizzle `sql`/`and`/`notExists`; `fullScanWhere` as `status = 'complete' AND purpose <> 'quick'`.
- [ ] **Step 4: Use them.** `getLatestScan` and `getScoreHistory` take `shownScanWhere`; the three queries in `report.ts` and the one in `pulse-email.ts` take `fullScanWhere`. Leave `admin-queries.ts` and the admin pages as they are (the operator sees every scan).
- [ ] **Step 5: Run** `npx vitest run tests/lib tests/services/pulse-email.test.ts` — expected: PASS.

### Task 2: The quick scan's tools, options and time limits

**Files:**
- Create: `src/services/quick-scan.ts`
- Modify: `src/services/scan-runner.ts:203` (`ScanPurpose`), `src/services/scan-chain.ts` (`StepDeps`, `runStep`), `src/services/scan-live.ts`
- Test: `tests/services/quick-scan.test.ts`, extend `tests/services/scan-chain.test.ts`

**Interfaces:**
- Consumes: `QUICK_PURPOSE` from Task 1.
- Produces:
  - `ScanPurpose = "manual" | "weekly" | "prospect" | "quick"`
  - `export const QUICK_ENGINES = ["openai", "anthropic"] as const`
  - `export function quickAdapters(all: EngineAdapter[]): EngineAdapter[]` — those of `all` named in `QUICK_ENGINES`, in that order.
  - `export function quickToolsLabel(all?: EngineAdapter[]): string` — "ChatGPT and Claude", "ChatGPT", "Claude" or "" from `quickAdapters(all ?? getAdapters())` (display names: openai "ChatGPT", anthropic "Claude").
  - `StepDeps` gains optional `startBudgetMs?: number`, `hardStopMs?: number`, `maxSteps?: number`, `settleOnLast?: boolean`.
  - `liveStepDeps("quick", invokedAt)` returns: `adapters: quickAdapters(getAdapters())`, `scanOptions: { runs: 1, rateTone, concurrency: 64, retryDelaysMs: [2_000], finalRetryDelayMs: 3_000 }` (no `checkWebsite`, no `checkAiOverviews`), `startBudgetMs: 45_000`, `hardStopMs: 75_000`, `maxSteps: 1`, `settleOnLast: true`.

- [ ] **Step 1: Write the failing tests.**

```ts
// tests/services/quick-scan.test.ts
it("keeps only ChatGPT and Claude, in that order", ...)       // quickAdapters([grok, anthropic, google, openai]).map(a => a.name) equals ["openai","anthropic"]
it("is empty when both are switched off", ...)                // quickAdapters([grok, google]) equals []
it("labels the tools actually asked", ...)                    // "ChatGPT and Claude"; with only anthropic: "Claude"

// tests/services/scan-chain.test.ts (same fakes the file already uses)
it("a quick step with a call still hanging at the hard stop records what came back instead of handing off", ...)
//  deps: maxSteps 1, settleOnLast true, hardStopMs small, one adapter that never resolves, one that answers
//  expect: runStep resolves "finished", triggerNext not called, onComplete called once, scan status is "complete" or "blocked" (not "running")
it("without settleOnLast a step that runs out of time still hands off", ...)   // existing behaviour unchanged
```

- [ ] **Step 2: Run** `npx vitest run tests/services/quick-scan.test.ts tests/services/scan-chain.test.ts` — expected: the new tests FAIL.
- [ ] **Step 3: Implement.** In `runStep`: budgets come from `deps.startBudgetMs ?? STEP_START_BUDGET_MS` and `deps.hardStopMs ?? STEP_HARD_STOP_MS`; `last` is `step >= (deps.maxSteps ?? MAX_STEPS)`; when `!done && last && deps.settleOnLast`, skip the handoff and go on to `finishScan` (it already counts unsaved asks as failed). Everything else in `runStep` stays.
- [ ] **Step 4: Run** the same command — expected: PASS. Then `npx vitest run tests/services/scan-runner.test.ts` — expected: PASS.

### Task 3: The full audit starts when the quick one ends

**Files:**
- Create: `src/app/api/cron/scan-start/route.ts`, `src/services/full-scan-start.ts`
- Modify: `src/services/scan-completion.ts` (`completionFor`)
- Test: `tests/services/full-scan-start.test.ts`, extend `tests/app/cron.test.ts`

**Interfaces:**
- Consumes: `liveStepDeps`, `startScanChain`, `finishProspect`, `makeStepTrigger`'s header pattern.
- Produces:
  - `export async function claimFullScan(db: Db, practiceId: string): Promise<boolean>` — true only for the first caller: false when the practice already has any scan with purpose `prospect`.
  - `export function makeFullScanTrigger(args: { appUrl: string; cronSecret: string; bypassSecret?: string; fetchImpl?: typeof fetch }): (practiceId: string) => Promise<void>` — GET `${appUrl}/api/cron/scan-start?practice=<id>` with the bearer secret, 20 s timeout, throws on a non-2xx.
  - `completionFor(purpose, deps?: { startFull?: (practiceId: string) => Promise<void> })`: for `"quick"`, both `onComplete` and `onFailed` call `startFull(practiceId)`; if that throws, they call `finishProspect(db, practiceId, { error: "the full audit couldn't be started" }, prospect)`.
  - Route `GET /api/cron/scan-start?practice=<uuid>`: 401 without the bearer secret, 400 on a bad id, 404 for an unknown practice, 202 otherwise; in `after()`: `if (await claimFullScan(db, id)) await startScanChain(db, id, "prospect", liveStepDeps("prospect", invokedAt))`, then `sweepStuckScans`. `maxDuration = 300`, `dynamic = "force-dynamic"`.

- [ ] **Step 1: Write the failing tests.**

```ts
it("a complete quick scan starts the full audit", ...)            // completionFor("quick", { startFull }).onComplete(...) -> startFull called with the practice id
it("a blocked quick scan starts the full audit too", ...)         // result.blocked true -> startFull called; lead status still "preparing"
it("a failed quick scan starts the full audit", ...)              // onFailed -> startFull called; lead status still "preparing"
it("marks the lead when the full audit can't be started", ...)    // startFull rejects -> lead status "needs_attention", note mentions it couldn't be started
it("claims the full scan once", ...)                              // claimFullScan twice -> true then false after a prospect scan row exists
// tests/app/cron.test.ts
it("scan-start refuses a request without the secret", ...)        // 401
```

- [ ] **Step 2: Run** `npx vitest run tests/services/full-scan-start.test.ts tests/app/cron.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** the three pieces. `claimFullScan` and the scan row insert must not both succeed for two concurrent callers: do the check and `startScan` insert inside one statement or guard with the practice row (`select ... for update` in a transaction if the driver allows; otherwise an `insert ... where not exists`).
- [ ] **Step 4: Run** the same command — expected: PASS.

### Task 4: Faster setup, and the quick scan first

**Files:**
- Modify: `src/services/prospect-setup.ts:119-260` (`prepareProspect`), `src/services/prospect-start.ts`
- Test: extend `tests/services/prospect-setup.test.ts`

**Interfaces:**
- Consumes: `quickAdapters`, `liveStepDeps("quick", …)` from Task 2.
- Produces: no new exports. `ProspectDeps` is unchanged.

- [ ] **Step 1: Write the failing tests.**

```ts
it("drafts facts and questions at the same time", ...)        // draftFacts and draftQuestions fakes each record start/end; both have started before either has ended
it("does not wait for the forecast before scanning", ...)     // draftForecast fake never resolves until released; deps.scan is still called
it("a failing forecast doesn't fail the setup", ...)          // draftForecast rejects -> lead not needs_attention
```

- [ ] **Step 2: Run** `npx vitest run tests/services/prospect-setup.test.ts` — expected: the new tests FAIL.
- [ ] **Step 3: Implement.** In `setUp`: fetch pages first (the drafters need them); run `fetchLogo` alongside it; then `Promise.all` the fact and question drafts, each keeping its existing `.catch(failed(...))`. Run `deps.draftForecast` alongside `deps.scan` (`Promise.all`, forecast errors swallowed as today). Every existing note, fallback and write stays, in the same order of database writes where order matters (facts and prompts before the scan).
- [ ] **Step 4: In `prospect-start.ts`,** the `scan` dep becomes: if `quickAdapters(getAdapters()).length > 0`, `startScanChain(db, practiceId, "quick", liveStepDeps("quick", Date.now()))`; otherwise today's `"prospect"` chain with `invokedAt`. Update the file's comment.
- [ ] **Step 5: Run** `npx vitest run tests/services/prospect-setup.test.ts` — expected: PASS (fix any existing test that asserted the old strict order of drafting).

### Task 5: Progress that understands two scans

**Files:**
- Modify: `src/services/audit-progress.ts`
- Test: extend `tests/services/audit-progress.test.ts`, `tests/app/audit-route.test.ts`

**Interfaces:**
- Consumes: `QUICK_PURPOSE` (Task 1), `quickToolsLabel` (Task 2).
- Produces: `AuditProgress` gains `asking: string` — what the "asking" stage names: `quickToolsLabel()` while the scan under way is quick (falling back to "the AI tools" if empty), else "the AI tools".

- [ ] **Step 1: Write the failing tests** (rules in this order):

```ts
it("is done once any scan is complete, even with a full scan running after it", ...)     // quick complete + prospect running -> stage "done", percent 100
it("stays done when the full audit fails after a quick result", ...)                      // quick complete, prospect failed, lead needs_attention -> "done"
it("follows the quick scan while it runs", ...)                                           // quick running, 10 of 20 answers -> "asking", total 20, asking "ChatGPT and Claude"
it("is not failed when the quick scan is blocked and the full one hasn't started", ...)   // quick blocked, lead preparing, fresh -> "asking", percent 20, asking "the AI tools"
it("follows the full scan after a blocked quick one", ...)                                // quick blocked + prospect running 30 of 120 -> "asking", total 120
it("is failed when the lead needs attention and nothing completed", ...)                  // unchanged behaviour
```

- [ ] **Step 2: Run** `npx vitest run tests/services/audit-progress.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** by reading all of the practice's scans once and applying: any complete scan -> done; else `needs_attention` -> today's failed / not-started split; else the stale rule as today; else the newest scan: running -> its counts; quick and not running -> `at("asking", 20)`; otherwise failed. Keep the `!lead.practiceId` and no-scan-yet branches as they are.
- [ ] **Step 4: Run** `npx vitest run tests/services/audit-progress.test.ts tests/app/audit-route.test.ts` — expected: PASS.

### Task 6: Login before the audit finishes, and the phone later

**Files:**
- Modify: `src/app/audit/actions.ts` (`submitDetails`, `createAccount`; new `savePhone`), `src/services/leads.ts` if a phone-only update helper is needed
- Test: extend `tests/app/audit-actions.test.ts`

**Interfaces:**
- Produces:
  - `submitDetails`: unchanged signature; `phone` is no longer in `DETAIL_FIELDS` (the schema already treats it as optional).
  - `createAccount(leadId, prev, formData)`: needs only `lead.practiceId`. With none: `{ error: "We're still setting up your audit. Try again in a few seconds." }`. A non-empty `email` field that differs from the lead's replaces the lead's email under the same claim-and-give-back logic used today for a lead with no email. On success it signs in with `redirectTo: \`/audit/${leadId}?step=call\``. `AccountState` gains `reason?: "has-account"` so the form can offer the login link.
  - `export async function savePhone(leadId: string, _prev: { saved?: boolean; error?: string }, formData: FormData): Promise<{ saved?: boolean; error?: string }>` — validates with `auditRequestSchema.shape.phone`, updates `leads.phone`, unknown lead gives the usual "couldn't find this audit" error.

- [ ] **Step 1: Write the failing tests.**

```ts
it("makes the login while the audit is still running", ...)             // practice exists, no complete scan -> account created, signIn called with redirectTo "/audit/<id>?step=call"
it("asks them to try again when the business isn't set up yet", ...)   // lead without practiceId -> error text above, no user row
it("refuses an address that already has a login and says why", ...)    // -> reason "has-account", lead email unchanged
it("takes a different address after a refusal", ...)                    // email field set to a new address -> lead.email updated, account created
it("saves a phone number later", ...)                                   // savePhone -> leads.phone set
it("saves details without a phone", ...)                                // submitDetails with no phone -> success
```

- [ ] **Step 2: Run** `npx vitest run tests/app/audit-actions.test.ts` — expected: the new tests FAIL.
- [ ] **Step 3: Implement.** Remove the `done` scan lookup from `createAccount`. Keep "one login per business from this page" and "only a brand-new address" exactly as `createAccountFromAudit` enforces them.
- [ ] **Step 4: Run** the same command — expected: PASS.

### Task 7: The onboarding page

**Files:**
- Create: `src/app/audit/[id]/audit-bar.tsx`, `src/app/audit/[id]/onboarding.tsx`, `src/app/audit/[id]/call-step.tsx`
- Modify: `src/app/audit/[id]/page.tsx`, `details-form.tsx`, `account-form.tsx`, `src/app/landing.css`
- Delete: `src/app/audit/[id]/audit-live.tsx`, `results-teaser.tsx`, `thank-you.tsx` once nothing imports them (check `/book` first; keep any file it still uses)
- Test: rewrite `tests/app/audit-page.test.tsx`, adjust `tests/app/audit-details-form.test.tsx`

**Interfaces:**
- Consumes: `AuditProgress` with `asking` (Task 5); `submitDetails`, `createAccount`, `savePhone` (Task 6).
- Produces:
  - `export type OnboardingStep = "details" | "login" | "call" | "waiting" | "has-login" | "stopped"`
  - `export function onboardingStep(args: { stage: AuditStage; hasEmail: boolean; hasLogin: boolean; signedInAsMember: boolean; stepParam?: string; hasCalendly: boolean }): OnboardingStep` in `onboarding.tsx` (pure, exported for tests).
  - `<AuditBar leadId initial />` — sticky at the top of the page; polls `/api/audit/<id>` every 4 s until settled (move the polling, elapsed clock and status lines from `audit-live.tsx`); stage wording: "Reading your website", "Writing the questions your customers ask", `Asking ${progress.asking}`, "Scoring your answers"; on done: "Your audit is ready". No "This takes 5-7 minutes" line; use "About a minute or two."

- [ ] **Step 1: Write the failing tests** for `onboardingStep`:

```ts
it("starts at details", ...)                                    // no email -> "details"
it("goes to the login once the email is in", ...)               // email, no login -> "login"
it("offers the login on an old link whose audit is ready", ...) // stage "done", email, no login -> "login"
it("shows the call after signing up", ...)                      // signed in member, stepParam "call", hasCalendly -> "call"
it("skips the call with no scheduling link", ...)               // signed in member, no calendly -> "waiting"
it("waits after the call step", ...)                            // signed in member, stepParam "done" -> "waiting"
it("points a returning visitor with a login at the login page", ...) // hasLogin, not signed in -> "has-login"
it("stops at details when the audit didn't start or failed", ...)    // stage "failed" or "not-started" -> "stopped"
```

  and for the page render (same style as the existing `audit-page.test.tsx`): the bar is present on every step; no score, ranking or competitor name is rendered for any step; the "stopped" state shows today's failure or capacity message and the details form only.

- [ ] **Step 2: Run** `npx vitest run tests/app/audit-page.test.tsx` — expected: FAIL.
- [ ] **Step 3: Build the page.** Server side in `page.tsx`: load the lead, progress, whether a client login exists for the practice (`practiceMembers` joined to `users` with role `client`), and whether the signed-in session (`auth()`) is a member. Render `<AuditBar>` then the step:
  - `details`: `DetailsForm` titled "Step 1 of 3 · About you", fields name, email, business name, type of business (optional), city (optional), button "Continue".
  - `login`: "Step 2 of 3 · Create your login", the email shown as text, password field, button "Create account". When the audit is already done, a line above says "Your audit is ready. Create your login to see it." On `reason: "has-account"`: "That email already has a login." with a link to `/login` and an email field to use a different address.
  - `call`: "Step 3 of 3 · Want us to walk you through it?" marked optional, the Calendly embed, the optional phone field (saves through `savePhone`), and a link button "Skip, show me my audit" to `/audit/<id>?step=done`.
  - `waiting`: a client component that sends the browser to `/app` as soon as progress is done (immediately if it already is); until then one line, "Almost there. Your audit opens as soon as it's ready."
  - `has-login`: "Your audit is in your dashboard." with a "Log in" button to `/login`.
  - `stopped`: today's messages and the details form (no later steps).
- [ ] **Step 4: Style** in `landing.css` with new `mk-audit-bar` (sticky, full width, the existing progress fill colour) and `mk-step-eyebrow` rules, reusing `mk-form-card`, `mk-field`, `mk-btn`. Check it at 390 px wide: no sideways scroll, the bar stays one or two lines.
- [ ] **Step 5: Run** `npx vitest run tests/app` — expected: PASS. Then `npm run lint` — expected: clean.

### Task 8: The dashboard says what it is showing and keeps itself fresh

**Files:**
- Create: `src/lib/scan-state.ts`, `src/components/scan-refresher.tsx`
- Modify: `src/app/dashboard/[slug]/page.tsx` (and `preview-summary.tsx` if the locked preview renders its own header)
- Test: `tests/lib/scan-state.test.ts`, extend `tests/app/dashboard-preview.test.tsx`

**Interfaces:**
- Consumes: `getLatestScan` (Task 1), `QUICK_PURPOSE`, `quickToolsLabel`.
- Produces:
  - `export type ScanNotice = "quick-full-running" | "quick-full-failed" | "first-running" | "first-failed" | null`
  - `export async function scanNotice(db: Db, practiceId: string): Promise<ScanNotice>`:
    shown scan is quick and a `prospect` scan is running (or none exists yet) -> `"quick-full-running"`; shown scan is quick and the newest `prospect` scan is failed or blocked -> `"quick-full-failed"`; no complete scan and the practice's lead is `needs_attention` -> `"first-failed"`; no complete scan otherwise -> `"first-running"`; else null.
  - `<ScanRefresher active />` — client component; while `active`, calls `router.refresh()` every 10 s; stops when the prop turns false.

- [ ] **Step 1: Write the failing tests** — one per branch of `scanNotice` above (five cases), plus in `dashboard-preview.test.tsx`: the quick notice text is rendered when the shown scan is quick, and is absent for a full scan.
- [ ] **Step 2: Run** `npx vitest run tests/lib/scan-state.test.ts tests/app/dashboard-preview.test.tsx` — expected: FAIL.
- [ ] **Step 3: Implement.** Notice copy (with `quickToolsLabel()` in place of the names):
  - quick-full-running: "This is a quick look from ChatGPT and Claude. Your full audit across every AI tool is running and will replace it in a few minutes."
  - quick-full-failed: "This is a quick look from ChatGPT and Claude. We're finishing your full audit by hand and will email you."
  - first-failed: "Something went wrong on our side. We'll finish your audit by hand and email it to you." (replaces "Your first scan is running" in that case)
  - `ScanRefresher` is active for `quick-full-running` and `first-running`.
- [ ] **Step 4: Run** the same command, then `npx vitest run tests/app` — expected: PASS.

### Task 9: Whole-flow check on localhost

**Files:** none new. Fixes go back into the owning task's files.

- [ ] **Step 1:** `npm test` and `npm run lint` — expected: all pass.
- [ ] **Step 2:** Confirm `http://localhost:3000` answers 200 (restart `npm run dev` if not).
- [ ] **Step 3:** In a browser on localhost, paste a website not audited in the last day. Record the seconds from submit to the bar saying "Your audit is ready". Expected: under 120.
- [ ] **Step 4:** Complete the three steps with a new email address. Expected: lands on the dashboard showing the ranking, with the quick-look notice.
- [ ] **Step 5:** Query the database for that practice's scans. Expected: one `quick` scan `complete`, one `prospect` scan `running` then `complete`; after it completes the dashboard reloads by itself, the notice is gone, and the report email was sent (`leads.audit_emailed_at` set).
- [ ] **Step 6:** Open the same `/audit/<id>` link in a private window. Expected: "Your audit is in your dashboard." and no results.
- [ ] **Step 7:** If Step 3 took longer than 120 s, look at where the time went (setup vs asking, from row timestamps) and tune the limits in `quick-scan.ts` / `scan-live.ts`; repeat once.
