# Task 13 Report: Weekly cron scan + Pulse email

## What was done

1. **`src/services/pulse-email.ts`** (TDD — the brief's 4 `composePulse` tests written first and
   confirmed failing before implementation):
   - `composePulse(args)` — pure. Subject exactly `"What AI told patients about {practiceName} this
     week"`. Inline-styled HTML table, ≤6 content rows: (1) score + delta (`"Score: 42 (+4)"`,
     delta omitted when `prevScore` is `null`), (2) cited-checks sentence containing the exact
     substring `"{cited} of {total} checks"`, (3) verbatim-quote row when `bestQuote` is present
     (engine display name via an `ENGINE_DISPLAY_NAMES` map — openai→ChatGPT etc. — plus an
     italicized snippet), (4) open-accuracy-issues row, singular/plural-aware, only rendered when
     `openFindings > 0`, (5) CTA link to `${appUrl}/dashboard/${slug}` labeled "Open your Mirror
     dashboard".
   - `sendPulse(db, practiceId)` — loads the latest complete scan via `getLatestScan` (skips
     silently if none), the previous complete scan for the delta, checks via `getChecksForScan`
     (cited = mentioned count, total = length), `getOpenFindings` for the count, and practice
     members' emails via a `practiceMembers` ⋈ `users` join. `bestQuote` = the first check where
     `mentioned=true`; its snippet is extracted by a documented heuristic (`extractSnippet`):
     split the answer on `". "`, take the first sentence containing the practice name, truncate to
     ~160 chars — falls back to `null` if no mentioned check or no matching sentence. Recipients
     with zero members short-circuits before touching Resend. The Resend SDK (`resend` package) is
     imported *lazily* inside the try block (`await import("resend")`) specifically so tests that
     exercise `runWeeklyScans` with a fake `send` never construct it. Send failures are caught and
     logged via `logActivity(db, practiceId, "pulse email failed: <msg>")`, never thrown — a flaky
     email provider can't fail the cron loop.
2. **`src/services/weekly-scan.ts`** — new module (not in the brief's file list, added for
   testability per the controller resolution): `runWeeklyScans(db, adapters, judge, send =
   sendPulse)` extracts the route's loop body — active practices → `runScan` → `send` → push a
   `{practice, score}` or `{practice, error}` result row, with a per-practice try/catch so one
   failure never aborts the rest.
3. **`src/app/api/cron/weekly-scan/route.ts`** — per the brief verbatim, wired to
   `runWeeklyScans(db, getAdapters(), judgeAnswer)`. Bearer `CRON_SECRET` check → 401 `"nope"` on
   mismatch. `export const maxDuration = 800;` and `export const dynamic = "force-dynamic";` set,
   with a comment noting `maxDuration` beyond the free-tier ceiling requires a paid Vercel plan.
4. **`vercel.json`** — brief's cron config verbatim: Thursday 14:00 UTC.
5. **`tests/services/pulse-email.test.ts`** — the brief's 4 `composePulse` tests verbatim; no
   Resend integration test (documented in the file/report — `sendPulse`'s Resend call path is
   intentionally untested here since it's a real network dependency; `runWeeklyScans` tests below
   cover its DB-facing behavior via a fake `send`).
6. **`tests/app/cron.test.ts`**:
   - `runWeeklyScans` (direct, via PGlite + fakes): per-practice result rows with a real scan row
     created; a failing `send` for one practice doesn't abort the loop or block the other
     practice's scan row from being created.
   - Route auth: missing header and wrong bearer token → 401, both via `beforeEach`-seeded
     `process.env.CRON_SECRET` and dynamic `import()` of the route (mirrors the `vi.resetModules()`
     pattern in `tests/lib/env.test.ts`).
   - Route success path: `vi.mock("@/engines")` / `vi.mock("@/services/hallucination-judge")`
     (moved to top-of-file scope after Vitest warned that nested `vi.mock` calls are hoisted
     regardless of position) swap in a fake adapter/judge; because `vi.resetModules()` runs in
     `beforeEach`, the statically-imported `"@/db"` module instance and the one the freshly
     `import()`ed route resolves are different — `setDbForTests` is called via a matching dynamic
     `import("@/db")` in that test so both sides share the same module instance. `sendPulse` runs
     for real inside this test but short-circuits at the zero-recipients guard (no practice members
     seeded), so it never reaches the Resend SDK.
7. One commit: `feat: weekly cron scan and pulse email` (`b4c760b`).

## Verification

- `npx vitest run tests/services/ tests/app/`: 5 files / 17 tests passed.
- `npm run test` (full suite): 14 files / 78 tests passed on a clean run. One run hit 5 timeouts
  (`tests/app/cron.test.ts`, `tests/db/schema.test.ts`, `tests/lib/queries.test.ts`,
  `tests/services/scan-runner.test.ts`) at the default 5s timeout — reproduced as a pre-existing
  PGlite "Pulling schema from database" contention flake under full-suite parallelism, not caused
  by this task's changes (a clean re-run passed all 78 tests; the flaking files span both new and
  untouched pre-existing tests).
- `npx tsc --noEmit`: clean.
- `npm run build`: succeeded with dummy env vars — `/api/cron/weekly-scan` compiles as a dynamic
  (ƒ) route alongside the existing routes. Same pre-existing `middleware`→`proxy` deprecation
  warning noted in prior task reports.
- `npx eslint` over all new/changed files: clean.
- Step 4's manual `curl` walkthrough (real keys, live Resend send) was **not** performed in this
  session — see Concerns.

## Concerns

- **`maxDuration = 800` requires a paid Vercel plan.** The Hobby (free) tier caps serverless
  function duration well below 800s (10s on Hobby for most regions); this route will need a Pro (or
  higher) plan in production, or the value should be lowered to fit whatever plan is actually
  deployed. Flagging since this is easy to miss until the cron silently times out in production.
- **No live manual QA.** The brief's Step 4 (`curl` against a running server with real
  `RESEND_API_KEY`/`CRON_SECRET` and a seeded active practice, confirming a scan row plus a
  received email) was not run — recommended before this ships, consistent with the same caveat in
  the Task 11/12 reports.
- **`src/services/weekly-scan.ts` is a new file not listed in the brief's file list** — added per
  the controller resolution specifically to make the cron loop unit-testable without hitting real
  adapters/judge/Resend. The route itself stays a thin wrapper matching the brief's handler
  verbatim.
- **No Resend integration test**, by design (per the controller resolution) — `sendPulse`'s actual
  `resend.emails.send` call is exercised by neither the unit tests nor the route test (the route
  test's seeded practice has zero members, so `sendPulse` returns early before importing the SDK).
  If Resend's request shape (from/to/subject/html) ever regresses, only a live send or a future
  mocked-fetch test would catch it.
