# Task 12 Report: Client dashboard (command center + answers + accuracy)

## What was done

1. **`src/core/mention.ts`** — added `highlightRanges(answer, variations): {start,end}[]`, extending the
   existing word-boundary regex machinery: finds *every* occurrence (not just the first, unlike
   `findMatches`) of each variation via a global regex, then sorts and merges overlapping/adjacent
   ranges (e.g. "Glow" fully inside "Glow MedSpa" collapses to one range) so a caller never
   double-wraps text. `findMatches`/`detectMention`/`detectNames` untouched. Unit tests added to
   `tests/core/mention.test.ts`: multi-occurrence, multi-variation, overlap-merge, word-boundary
   (no false positive), and empty-match cases.
2. **`src/lib/queries.ts`** (TDD — tests written first) — `getLatestScan`, `getScoreTrend`,
   `getChecksForScan` (joined with prompt text/kind), `getOpenFindings`, `getActivities`,
   `getCompetitorPressure` (tallies `competitorsMentioned` jsonb across a scan's checks, desc,
   alphabetical tiebreak), plus one addition beyond the brief's list: `getFindingsForPractice`
   (all findings for a practice, any status, joined with the originating check's `engine`) — the
   accuracy page needs fixed/verified/dismissed findings too, not just open ones, and
   `getOpenFindings` alone can't supply that.
3. **`tests/lib/queries.test.ts`** — TDD Step 1 required `getScoreTrend` (completed-only, ascending,
   capped to N most recent by dropping the *oldest*) and `getCompetitorPressure` (counts + desc
   order); also covered `getLatestScan` (null when nothing's complete, ignores running/failed),
   `getChecksForScan`, `getOpenFindings`, `getFindingsForPractice`, and `getActivities`
   (limit + newest-first) for full coverage of the new module. All scans/checks/findings/activities
   seeded directly via the schema tables (`seedPractice` only covers practice/prompts/facts/competitors).
4. **Components** (`src/components/`): `dashboard-header.tsx` (shared "Mirror" header + Overview |
   Answers | Accuracy tab nav, active-tab underline), `score-card.tsx` (KPI tile with optional
   colored delta), `trend-chart.tsx` (`"use client"`, Recharts `LineChart` — single monotone line,
   one accent `#4f46e5`, no legend since it's a single series, `ResponsiveContainer` height 220,
   short-date x-axis, 0–100 y-axis, subtle dashed grid, hover tooltip; invoked the `dataviz` skill
   first per the brief and followed its single-series/no-legend/no-rainbow guidance), `answer-card.tsx`
   (engine badge via a client-facing `ENGINE_LABELS` map — openai→ChatGPT etc. — position chip,
   citation links, and a `HighlightedText` helper that slices the answer into plain-string/`<mark>`
   React children from `highlightRanges` — no `dangerouslySetInnerHTML` anywhere), `finding-card.tsx`
   (claim vs. fact-value two-column layout, severity chip, engine badge, found/resolved dates,
   status-colored left accent).
5. **Pages** (`src/app/dashboard/[slug]/`):
   - `page.tsx` — command center. Verdict line matches the brief's template exactly:
     `"AI engines named {practice.name} in {cited} of {total} checks this week."` (cited/total from
     the latest scan's checks). Three KPI tiles (score + delta vs. the prior completed scan, derived
     from the last two points of the 12-scan trend array rather than a second query; cited/total;
     open-findings count). Trend chart, competitor pressure list, last-5 activity. No completed scan
     → "Your first scan is running — check back soon." (still shows activity, if any).
   - `answers/page.tsx` — every check from the latest scan as an `AnswerCard`, practice name +
     name-variations fetched once and passed down for highlighting. Empty states for both "no scan
     yet" and "scan has zero checks."
   - `accuracy/page.tsx` — findings grouped open/fixed/verified (each rendered as `FindingCard`,
     empty groups hidden), dismissed shown as a collapsed count-only heading, and the exact footer
     copy: *"Accuracy issues cap your visibility score at 70 until resolved."* (always rendered,
     even in the empty state). Whole-page empty state: "No accuracy issues found — your fact sheet
     and AI answers agree." only when there are zero findings across *every* status.
6. All three pages call `requirePracticeAccess(slug)` first (existing operator-or-member guard);
   none of this task touched `/admin` or its 404 behavior.
7. One commit: `feat: client dashboard with score, answers, accuracy ledger` (`df50644`).

## Verification

- `npx vitest run tests/lib/ tests/core/`: 7 files / 50 tests passed.
- `npm run test` (full suite): 12 files / 69 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run build`: succeeded — `/dashboard/[slug]`, `/dashboard/[slug]/answers`,
  `/dashboard/[slug]/accuracy` all compile as dynamic (`ƒ`) routes alongside the existing admin/auth
  routes. Same pre-existing, unrelated `middleware`→`proxy` deprecation warning noted in prior task
  reports.
- `npx eslint` over all new/changed files: clean.

## Concerns

- No live manual walkthrough (magic-link sign-in → dashboard render against a real Postgres) was
  performed in this session — brief's Step 4 manual QA is recommended before shipping, same caveat
  as Task 11's report.
- `getFindingsForPractice` is an addition beyond the brief's exact function list for
  `src/lib/queries.ts`; called out above with the reasoning (accuracy page needs non-open statuses
  too). Flagging in case a reviewer expected the interface list to be exhaustive.
- The trend chart's score delta is derived from `getScoreTrend(db, practiceId, 12)`'s last two
  points rather than a dedicated "previous scan" query — correct today (the trend's last point is
  always the same scan as `getLatestScan`), but would need a second query if `weeks` were ever
  passed as something other than ≥2 by a caller that also wants the delta.
