# Scan reliability — design

Date: 2026-09-30
Status: approved in chat

## Goal

A scan never quietly publishes a score built from fewer answers than it
claims, and the weekly job scans every active client, however many there are.

## What Nick decided

- Label short scans; block badly short ones ("Label it, block if bad").
- Threshold: a scan is blocked when fewer than 75% of the answers it asked
  for came back.

## Problems today

1. A failed engine call records nothing (`scan-runner.ts`), so rates are
   computed over fewer answers and nothing says the sample was short.
2. Tool reach divides by engines asked, so an engine that failed entirely
   counts as "doesn't name you".
3. `runWeeklyScans` scans practices one after another inside one 800s
   function; at 3–7 minutes per scan only 2–4 practices fit.

## Design

### Coverage

- After the network phase, every failed (prompt, run, engine) call is retried
  once more, after a short pause (default 5s, injectable for tests).
- Coverage is computed per engine: `asked` and `answered`. An engine "didn't
  respond" when it answered under half of what it was asked.
- Pure module `src/core/coverage.ts`:
  - `summarizeCoverage(results: { engine; ok }[]): Coverage`
  - `Coverage = { asked, answered, engines: {engine, asked, answered}[], missing: Engine[], blocked }`
  - `blocked = asked > 0 && answered / asked < 0.75`
  - `coverageLabel(c)`: null when no engine is missing, else
    `"Based on 4 of 5 AI tools. Gemini didn't respond."`
  - `blockedReason(c)`: `"Only 60% of answers came back. Gemini and Grok didn't respond."`
- Stored on the scan as `scans.coverage` (jsonb, nullable; old scans null ⇒ no label).

### Blocked scans

- New scan status `blocked`. A blocked scan records its coverage and
  `finishedAt`, and **nothing else**: no checks, findings, competitors or
  scores. `getLatestScan` (complete only) keeps returning last week's scan, so
  every client surface keeps last week's numbers.
- The operator gets an email: "Scan blocked for <client>: <blockedReason>".
- An internal activity line records it.
- The next morning's client Pulse is skipped when the practice's newest scan
  attempt isn't `complete`.

### Tool reach

- Reach = engines that named the client ÷ engines that returned at least one
  answer (not engines asked).

### Where the label shows

- Client dashboard, under the overall score line.
- Report: score page (P03) under the explanation line, and the method page.
- Weekly Pulse email.
- Admin practice page: the latest attempt's status, and its label or blocked
  reason when it isn't a clean complete scan.

### Weekly fan-out

- `/api/cron/weekly-scan` (the Vercel cron) no longer scans. It lists active
  practices and calls `/api/cron/scan-practice?id=<id>` for each, with the
  cron secret, in parallel.
- `/api/cron/scan-practice` checks the secret, schedules the scan with
  Next's `after()`, and returns 202 at once. Each practice therefore gets its
  own 800s function.
- The per-practice work (scan → findings alert or blocked alert) lives in
  `scanPracticeWeekly` in `src/services/weekly-scan.ts`; `runWeeklyScans`
  (used by tests and scripts) loops over it.

## Out of scope

Booking/confirmation copy that says "4 engines" (goes with onboarding).
Queueing or retry of a whole failed practice.

## Database changes

- `scan_status` enum gains `blocked`.
- `scans.coverage jsonb null`.

## Testing

- coverage: counts, missing threshold, blocked threshold, labels, zero-asked.
- scan-runner: failed call retried once at the end; short-but-ok scan stores
  coverage and label-worthy missing list; blocked scan stores no checks or
  scores and keeps the previous complete scan as latest; reach measured over
  answering engines.
- weekly-scan: blocked scan sends the blocked alert, not the findings alert;
  dispatcher calls the trigger once per active practice and survives a
  failing trigger.
- pulse: skipped when the newest attempt is blocked; shows the label.
- report: coverage note present when an engine was missing.
