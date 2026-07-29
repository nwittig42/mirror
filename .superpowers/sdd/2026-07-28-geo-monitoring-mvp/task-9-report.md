# Task 9 Report: Scan runner

## What was done

1. **`tests/helpers/db.ts`** — extracted `makeTestDb()` from `tests/db/schema.test.ts` (PGlite client + `drizzle-orm/pglite` + `drizzle-kit/api`'s `pushSchema`/`apply`, unchanged mechanism), typed to return `Db` with no cast (confirms Task 2's `Db = PgDatabase<PgQueryResultHKT, typeof schema>` base-class typing works for this too). Added `seedPractice(db, input)`: inserts a practice (auto-slug via name + random suffix unless `slug` given), a name variation equal to the practice name, and optional prompts/facts/competitors, returning all the generated ids.
2. **`tests/db/schema.test.ts`** — refactored to `import { makeTestDb } from "../helpers/db"` and call it instead of the inline `testDb()` helper. Assertions untouched.
3. **`src/services/activity.ts`** — `logActivity(db, practiceId, description)`, a one-line insert into `activities`. Exported for reuse (per resolution #6).
4. **`tests/services/scan-runner.test.ts`** — the brief's two tests transcribed as-is, plus a third: a judge that always throws, asserting the scan still completes (`status: "complete"`), a score > 0 is returned, zero findings are written, and an activity row `"scan warning: judge failed on prompt <text>"` exists.
5. **`src/services/scan-runner.ts`** — `runScan(db, practiceId, adapters, judge)`:
   - Inserts the `scans` row (`status: "running"`), then wraps the entire body in `try { ... } catch (err) { set status='failed'; throw err; }` (resolution #8) — inline per-engine and per-judge failures are caught separately inside the loop and never reach this outer catch, so it only fires on genuinely unexpected errors (bad query, etc).
   - Loads practice, active prompts, name variations, competitors, and **active-only** facts (resolution #1) in parallel; `practiceNames` = `Set([practice.name, ...variations])` deduped (seedPractice also stores the practice name as a variation, so this avoids doubling it up when building the mention/position inputs).
   - Per prompt: `Promise.allSettled` across adapters. Rejected settlements log `"scan warning: <engine> failed on prompt <text>"` and insert nothing. Fulfilled ones run `detectMention` + `classifyPosition`, insert a `checks` row, and accumulate a `{engine, promptKind, mentioned, position}` tuple for scoring (checks table has no `promptKind` column, so this is tracked alongside the insert rather than re-derived via a join later).
   - For every check whose prompt is `branded` and whose `answerText` is present (resolution wording), calls `judge({answer, facts})` inside its own `try/catch`. On throw: logs `"scan warning: judge failed on prompt <text>"` and moves on — no findings, no crash (resolution #2). On success: counts the check toward `brandedChecksWithFinding` iff any returned finding is `critical` or `major` (resolution #3 — minor findings don't count against accuracy). Each returned finding is deduped by an exact-match query for an existing `open` finding with the same `claim` for the practice (resolution #4) before inserting; inserted findings look up a matching fact by `factLabel` to populate `factId`/`factValue` when available.
   - After the loop, re-queries **all** open findings for the practice (resolution #5 — includes any pre-existing open findings from earlier scans, so a prior open critical still caps this scan's score) and calls `computeScore`.
   - Updates the `scans` row: `status: "complete"`, the four component scores as `Math.round(fraction * 100)` integers, `finishedAt: new Date()`.
   - Logs the closing activity in the exact required format: `` `Weekly scan complete — score ${score} (${mentioned}/${total} checks cited)` `` (resolution #7), where `mentioned`/`total` are computed from the scoring-check accumulator (i.e., only checks actually inserted this scan, matching "checks cited" semantics).
   - Returns `{ scanId, score }`.

## Deviations from the brief's elided pseudocode

- The pseudocode sketch queries `[promptRows, variations, comps, factRows]` without the practice row; I added `practices` to the same `Promise.all` since `practice.name` is needed to build `practiceNames`.
- `judge`'s type parameter is `typeof judgeAnswer` (imported as a type-only import) per controller resolution #2, not the brief's inline `(args: {answer; facts: FactRow[]}) => Promise<JudgeFinding[]>` signature — structurally compatible, and lets production callers pass the real `judgeAnswer` with no adapter shim.

## Test evidence

- `npx vitest run tests/services/scan-runner.test.ts` — 3/3 pass (full scan + findings, engine-failure survival, judge-failure survival).
- `npm run test` — **9 test files, 44 tests, all pass**.
- `npx tsc --noEmit` — clean, no output.
- `npx eslint src/services/scan-runner.ts src/services/activity.ts tests/helpers/db.ts tests/services/scan-runner.test.ts tests/db/schema.test.ts` — clean, no errors/warnings.
- Confirmed red state before implementing: running the new test file before `src/services/scan-runner.ts` existed failed with `Cannot find package '@/services/scan-runner'`.

## Concerns

- `brandedCheckCount`/`brandedChecksWithFinding` are scoped to *this scan's* branded checks only (not cumulative across scans), matching the brief's "Compute `computeScore` over this scan's checks" wording — flagging in case product intent was actually a practice-wide accuracy rate.
- Fact-to-finding matching (`factId`/`factValue` lookup by `factLabel`) is best-effort: if the judge returns a `factLabel` that doesn't exactly match any loaded active fact's `label`, the finding is still inserted with `factId: undefined`/`factValue: undefined` rather than rejected — no spec guidance on that case, treated as "log it anyway, just without the fact link."
- Dedup is scoped to the practice (not the specific check or prompt), per resolution #4 as written — a genuinely new occurrence of an already-open identical claim from a different check in the same scan will not get its own `findings` row, only the first insert survives.
