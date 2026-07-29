### Task 14: Printable monthly report — Report

**Status:** Complete.

**Files:**
- Created: `src/lib/report.ts` (`buildReportData`, `formatMonthLabel`)
- Created: `src/app/dashboard/[slug]/report/page.tsx`, `src/app/dashboard/[slug]/report/report.css`
- Created: `src/components/print-button.tsx`
- Created: `tests/lib/report.test.ts` (7 tests)
- Modified: `src/db/schema.ts` (nullable `practices.reportNotes` text column) + migration `drizzle/0002_absurd_sabra.sql`
- Modified: `src/app/admin/actions.ts` (`updateReportNotes`), `src/app/admin/practices/[id]/page.tsx` (notes textarea/form)
- Modified: `src/components/dashboard-header.tsx` (Report tab, `print:hidden` on nav)
- Refactor for reuse: `extractSnippet` moved from `src/services/pulse-email.ts` into `src/core/mention.ts` (exported, used by both pulse-email and report); `ENGINE_LABELS` moved from `src/components/answer-card.tsx` into `src/core/types.ts` (re-exported from answer-card.tsx for the existing `finding-card.tsx` import; `pulse-email.ts`'s own loosely-typed `ENGINE_DISPLAY_NAMES` was left as-is since it accepts arbitrary external strings and a shared `Record<Engine,string>` type would have forced a cast there).

**Implementation notes:**
- `buildReportData(db, practiceId, monthISO)` scopes to completed scans with `startedAt` in `[monthStart, monthEnd)` UTC. `score`/`bestQuote` derive from the latest in-month scan; `perEngine` aggregates checks across *all* in-month scans (all four engines always present, 0/0 when a practice had no checks that month); `prevMonthScore` is the latest completed scan's score from the prior calendar month; the verdict's `pct`/`prevPct` are computed independently from checks (not from the score field) per the locked template, aggregated the same way as `perEngine`. Accuracy ledger: `found` = findings created in-month, `fixed`/`verified` = resolved in-month with matching status, `open` = currently open regardless of age. Activities capped at 30, newest first, in-month only. Degrades gracefully (`score: null`, empty trend, `bestQuote: null`, zeroed ledger, "No AI-visibility checks were run..." verdict) when there are no in-month scans.
- Report page: `?month=YYYY-MM` search param (default = current UTC month), prev/next month links, sections in the locked order, print-only `<h1>` for context once nav/controls hide. Print CSS forces black-on-white regardless of OS dark-mode (Tailwind's `dark:` variant otherwise still fires under print), hides nav + print button via `print:hidden`, sets `@page { margin: 1.6cm }`, and applies `break-inside-avoid` per section.
- No PDF library — "Print or save as PDF" is a tiny client component calling `window.print()`.

**Gates run:**
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npx vitest run --no-file-parallelism` — 91/91 passed (16 files), including the 7 new `tests/lib/report.test.ts` cases (per-engine math across two scans, accuracy-ledger status/date counting, verdict with/without prior month, graceful degradation, best-quote extraction, activity cap/order).
- `npm run build` — succeeds; `/dashboard/[slug]/report` present in the route table.

**Concern:** Running the full suite with default (parallel) file concurrency times out several unrelated pre-existing test files (`admin-actions`, `cron`, `scan-runner`, `send-pulse`, `queries`, plus the new `report` tests) on this machine — each `makeTestDb()` spins up its own in-memory PGlite instance, and enough of them running concurrently exhausts local resources within the 5s per-test timeout. This reproduces on the pre-existing test files too (not something this task's changes caused) and disappears entirely with `--no-file-parallelism`. Worth a `vitest.config.ts` pool tweak (e.g. capped thread count) in a follow-up if CI hits the same contention.

---

### Fix round 1 (review feedback)

**Issue (Important):** `?month=` was unvalidated — `?month=garbage`, `?month=2026`, `?month=2026-13`, etc. (all user-reachable via a shareable dashboard URL) reached `monthBounds`/`formatMonthLabel` as `NaN`-derived dates, which throw `RangeError` (e.g. `Invalid Date.toLocaleString()`), 500-ing the report page.

**Fix:**
- Added `resolveMonthParam(raw: string | undefined): string` to `src/lib/report.ts`, validating against `/^\d{4}-(0[1-9]|1[0-2])$/`. Missing or malformed input falls back silently to the current UTC month — same behavior as the previous "param absent" default, now also covering "param present but garbage."
- `src/app/dashboard/[slug]/report/page.tsx` now calls `resolveMonthParam(monthParam)` instead of `monthParam ?? currentMonthISO()`; the page's local `currentMonthISO` helper was removed (logic now lives once, in `report.ts`). Both `buildReportData(db, practice.id, month)` and `formatMonthLabel(month)` in the page consume this same validated `month`, so there's no separate unvalidated path into `formatMonthLabel` — it isn't reachable from anywhere else with raw request input.
- Added 6 unit tests for `resolveMonthParam` in `tests/lib/report.test.ts`: `undefined`, `"2026-07"` (valid passthrough), `"garbage"`, `"2026"` (missing month), `"2026-13"` and `"2026-00"` (out-of-range month) — all four invalid cases assert fallback to the current UTC month.

**Gates run:**
- `npx vitest run tests/lib/` — 31/31 passed (4 files).
- `npx vitest run --no-file-parallelism` (full suite, per the known PGlite contention flake) — 97/97 passed (16 files).
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds; `/dashboard/[slug]/report` still present in the route table.

**Concerns:** None new.
