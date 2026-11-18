# Fast audit and step-by-step onboarding

Date: 2026-11-18

## Why

A visitor who pastes their website on the home page waits about 8 minutes
before seeing anything, on one page that shows a progress list beside a long
form. Nick wants the visitor to get value fast: the audit should take 1 to 2
minutes, run behind a short onboarding, and be waiting for them the moment
they have an account.

## What Nick asked for (his words, condensed)

- The audit takes 1 to 2 minutes.
- They paste the website as step one, then go through onboarding steps while
  the audit runs in the background.
- A progress bar at the top of onboarding shows where the audit is.
- The call is optional.
- They set a login (email and password) during onboarding.
- They start seeing results once they have created an account.

Everything else below is Claude's proposal unless marked "Nick".

## Goals

1. A first result within 2 minutes of pasting a website, for a normal site.
2. Onboarding is a sequence of short steps, with the audit's progress always
   visible at the top.
3. The account is created during the wait, not after the audit finishes.
4. Results are shown only to a signed-in visitor, in their dashboard.
5. The numbers end up as accurate as today's: the full audit still runs.

## Non-goals

- Email verification (there is none today either).
- Changes to weekly or manually started scans.
- Getting Gemini and Perplexity funded again. They stay switched off by
  `SCAN_SKIP_ENGINES` until their accounts have credit.
- Redesigning the dashboard, beyond one notice (see "Dashboard").

## Anti-goals

- Presenting the quick result as if it were the full audit.
- A quick audit that fails and leaves the visitor stuck with no result.
- Breaking audit links that already exist, or audits in flight at deploy time.
- Naming AI tools on screen that were not actually asked.

## How it works today

- `startAudit` (src/app/audit/actions.ts) creates a lead and calls
  `startProspectSetup`, which runs `prepareProspect` after the response: read
  the website, fetch the logo, draft facts, draft questions, draft the
  forecast, one after another (about 45 to 60 seconds), then start a scan
  chain with purpose "prospect".
- That scan asks every question (10) of every tool that is on, 3 times
  (`SCAN_RUNS`), at most `max(4, tools)` at once. With 4 tools that is 120
  asks, about 8 minutes. A retriable failure gets one more try after a 30 to
  60 second pause.
- When the scan finishes, `finishProspect` marks the lead ready, emails the
  report if there is an address, and tells the operator.
- `/audit/[id]` shows `AuditLive` (progress, polled from `/api/audit/[id]`
  every 4 seconds) beside `DetailsForm` (name, email, phone, business name,
  type, city), which becomes `ThankYou` with the Calendly embed. Only once the
  scan is complete does `ResultsTeaser` replace both and offer `AccountForm`.
- `createAccount` refuses until a complete scan exists, then signs the
  visitor in and sends them to `/app`, which redirects to their dashboard.
- The dashboard shows the latest complete scan (`getLatestScan`).

## Approaches considered

1. **Quick look first, full audit behind it. Picked.** Two tools, each
   question once, all sent together. The full audit then runs in the
   background and replaces the quick result. Fast first value, accurate
   numbers a few minutes later. Costs 20 extra asks per audit.
2. **Quick look only.** Simplest, but the free score stays rough (one try per
   question) and only ever covers two tools, while the site promises more.
3. **Keep the full audit, send more at once.** Still 120 asks: 3 to 4 minutes
   at best, and more likely to hit the AI tools' rate limits.

Nick confirmed the understanding in conversation and handed the how to
Claude; Claude picked 1.

## Design

### 1. The quick audit

A new kind of scan, purpose `quick` (the `purpose` column is free text, so no
schema change is needed for it).

- Tools: ChatGPT and Claude (`openai`, `anthropic`). Claude's call: these are
  the two with working, funded keys. If either is switched off by
  `SCAN_SKIP_ENGINES`, the quick audit uses whatever of the two is left; if
  neither is left, it is skipped and the full audit runs as the only audit.
- Each question asked once (`runs: 1`).
- All asks sent at once (concurrency equal to the number of asks, 20 for 10
  questions).
- No website check and no Google AI Overview check in the quick pass. They
  run with the full audit.
- Time limits: a short pause (a few seconds) before the one extra retry, in
  place of 30 to 60 seconds. No new ask starts after about 60 seconds, and at
  about 90 seconds the scan settles on the answers it has, using the existing
  `startBy` / `stopBy` / `lastChance` options. The existing 75% coverage rule
  still decides whether the result is usable.
- Answers are judged, scored and recorded exactly as any scan's are, so the
  dashboard can show a quick scan with no special cases in scoring.

### 2. A faster setup before it

- Draft the facts and the questions at the same time, not one after the
  other, and fetch the logo alongside them.
- Move the forecast setup (which buys search numbers) out of the path to the
  quick audit: it runs after the quick scan has started.

Target: website pasted to quick result in 60 to 120 seconds.

### 3. The full audit follows

- When the quick scan finishes, whether complete, blocked or failed, the full
  scan starts (purpose `prospect`, all tools that are on, `SCAN_RUNS` tries),
  in a function call of its own, the same way a scan step starts the next
  step. The builder picks the mechanism; it must not eat the quick scan's
  time budget, and it must work on localhost.
- The full scan finishes the lead exactly as today: `finishProspect`, the
  report email, the operator notice. The emailed report is always the full
  audit.
- If the quick scan is blocked or fails, the visitor is not told it failed.
  Their progress bar carries on with the full audit, and they see results
  when that one completes. The lead is only marked "needs attention" if the
  full audit fails, as today.
- Nothing in the prospect path stops the full scan starting straight after
  the quick one (`scanStartedWithin` is only used by the weekly cron route).
- `/api/cron/scan-step` rejects step 1 and picks tools and options by purpose
  through `liveStepDeps`, so the full scan needs a start route of its own and
  the quick scan needs its own options there.
- **Quick result in, full audit then fails or is blocked** (Claude's call):
  the visitor keeps the quick result. The lead is still marked "needs
  attention" so the operator sees it, but the visitor's progress stays
  "done" and nothing on their side says "failed".
- **Both fail** (Claude's call): the lead is "needs attention" as today. A
  visitor who already made a login sees, in the dashboard, the same plain
  line the audit page uses ("Something went wrong on our side. We'll finish
  your audit by hand and email it to you."), not "Your first scan is running"
  forever.
- **What the quick scan leaves behind** (Claude's call): it records findings,
  discovered competitors and its work-log entry like any scan. These are real
  observations and are kept; no special case in recording.

### 4. Which scan the dashboard shows

- A quick scan is shown only until the business has any other complete scan.
  After that it is ignored everywhere: latest scan, score history, trends.
  The full audit must never appear as a "change since last scan" against the
  quick one.
- Complete scans are read in several places besides `src/lib/queries.ts`:
  `src/lib/report.ts`, `src/services/pulse-email.ts`,
  `src/lib/admin-queries.ts` and the admin pages. The rule goes in one shared
  place that all of them use. The emailed report and the weekly Pulse never
  use a quick scan.

### 5. Onboarding steps

All on `/audit/[id]`, one step on screen at a time, with the audit bar pinned
to the top of every step.

```
┌──────────────────────────────────────────────────────────┐
│ Your audit · Proof Bakery                                │
│ ████████████░░░░░░░░░  Asking ChatGPT and Claude · 0:48  │
└──────────────────────────────────────────────────────────┘

  Step 1 of 3 · About you
  Your name            [               ]
  Email                [               ]
  Business name        [ Proof Bakery  ]   (filled in from the site)
  Type of business     [ Bakery        ]   optional
  City                 [ Los Angeles   ]   optional
                                   [ Continue ]

  Step 2 of 3 · Create your login
  Email                nick@example.com   (from step 1)
  Choose a password    [               ]
                                   [ Create account ]

  Step 3 of 3 · Want us to walk you through it?   (optional)
  [ Calendly embed ]
  Phone                [               ]   optional
                 [ Skip, show me my audit ]
```

- **The bar.** Driven by the existing `/api/audit/[id]` poll. It names its
  stages in plain words (reading your website, writing the questions, asking
  the tools, scoring) and names only the tools the quick audit is asking.
  When the result is ready it says so ("Your audit is ready") and stays put;
  results are not shown on this page.
- **Step 1, about you.** Saves the details (today's `submitDetails`), minus
  the phone field. Sends the operator the same lead notice as today.
- **Step 2, login.** Creates the account and signs them in, then continues to
  step 3 in place of going to the dashboard. `createAccount` no longer waits
  for a complete scan: it needs only the business record, which setup creates
  in its first second or two. If that record is not there yet, the form says
  to try again in a moment. All of today's rules stay: one login per business
  from this page, and an address that already has an account is refused.
- **An email that already has a login** (Claude's call): step 2 says so in
  plain words, links to the login page, and lets them go back and use a
  different email for this audit. Attaching a second business to an existing
  login is out of scope.
- **Step 3, the call.** Optional (Nick). The Calendly embed, an optional
  phone field, and a button to skip. With no Calendly link configured, the
  step is skipped.
- **After step 3.** If a result is ready, go to the dashboard (`/app`). If
  not, a short waiting screen with the same bar, which goes to the dashboard
  by itself when the result is ready.
- **Coming back to the link.** The page opens at the first step not done yet:
  no email, step 1; email but no login, step 2; a login exists, a line saying
  the audit is in their dashboard with a button to log in. This replaces the
  public `ResultsTeaser` on this page: results live behind the login (Nick).
- **Audits that did not start or failed** (the daily cap, a repeat site, a
  broken setup): today's messages are kept, the details form is still
  offered, and the login and call steps are not.
- Styling follows the existing marketing styles (`mk-` classes in
  `landing.css`). Layout details are the builder's, and Nick will adjust the
  look after seeing it run locally.

### 6. Dashboard

- While the dashboard is showing a quick scan, one notice at the top says so
  in plain words: this is a quick look from ChatGPT and Claude, and the full
  audit across every AI tool is running and will replace it in a few minutes.
  The notice shows only while a full scan is actually running. If the full
  audit failed, it says the full audit is being finished by hand.
- A login made from the audit page gets today's locked preview dashboard
  (the ranking and the forecast card). That is unchanged.
- The forecast card needs the forecast setup, so that setup runs alongside
  the quick scan, not after it. If it is not ready when the dashboard opens,
  the card shows its existing empty state.
- The dashboard does not refresh itself today. While it shows a quick scan or
  "Your first scan is running", it checks every few seconds and reloads once
  when a newer complete scan lands.

### 7. Progress reporting

`auditProgress` (src/services/audit-progress.ts) changes so that:

- the stage is "done" as soon as the business has any complete scan, even
  while the full scan is running after it;
- while the quick scan runs, percent and counts come from the quick scan;
- if the quick scan was blocked or failed, progress follows the full scan and
  is never reported as "failed" on its account.

## Left to the builder

- Exact time limits for the quick scan, tuned against a real run.
- How the full scan is started in its own function call.
- Whether the quick tools are a constant or a setting.
- Component structure and copy for the steps, in the app's existing plain
  voice (no jargon, sentence case).
- Tests, in the style of the existing vitest suites, for: the quick scan's
  options, the progress rules, account creation before a complete scan, and
  which scan the dashboard picks.

## How we will know it works

- Locally, with real keys: paste a website, finish the three steps, and land
  on a dashboard showing a quick result within 2 minutes of pasting.
- A few minutes later the dashboard shows the full audit, with no trend
  against the quick one, and the report email arrives.
- With one of the two quick tools forced to fail, the visitor still ends up
  with the full audit and never sees a failure message.
- `npm test` and `npm run lint` pass.

## Rollout

The live site deploys by hand from the CLI. Test locally first (it shares the
live database and spends real AI credit), then deploy.
