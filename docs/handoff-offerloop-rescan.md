# Offerloop re-scan handoff, 2026-08-06

Paste the block below into a fresh session started in `~/geo-platform`.

---

## PROMPT

You are working on **Mirror**, a GEO monitoring platform at `~/geo-platform`, branch
`feat/audit-onboarding`. Next.js 16, Drizzle ORM, Neon Postgres, Auth.js, Resend.

Mirror fires 10 tracked prompts at ChatGPT, Claude, Gemini, and Perplexity for each
client, records whether the client was named and where it ranked, judges every branded
answer against an operator-maintained fact sheet to catch hallucinations, computes a
0-100 visibility score, and emails a weekly Pulse. The operator triages findings in `/admin`.

**Your job: re-scan Offerloop against its corrected fact sheet, then work out which of
the 13 open findings were real and which were artifacts of a bad fact sheet.**

### Why this needs doing

Offerloop's only scan ran against a fact sheet containing a one-line "What Offerloop is"
summary fact. The judge read that one line as an exhaustive definition of the product, so
four or more genuine features got flagged as hallucinations. That fact has since been
archived and the sheet rebuilt to 28 active facts. Nothing has been re-scanned since.

### Exact state right now, read from the live database

- Practice `Offerloop`, slug `offerloop`, id `b4bf77af-9faa-4c67-8bdc-d57c9bd613ea`,
  website `https://www.offerloop.ai`
- **28 active facts**, 1 archived (`[identity] What Offerloop is`, the culprit)
- **10 active prompts**
- Competitors tracked: Apollo, LinkedIn, Handshake
- Name variations: Offerloop, Offerloop.ai, OfferLoop, Offer Loop
- **One scan**, `d0054970-9c5d-404b-9f9e-7e9a2d7226d1`, complete, 2026-08-06 19:37
  - **stored score 35**, which is a stale number, see below
  - checks by engine: **openai=10, anthropic=10, perplexity=9, gemini=0**

### The scoring formula changed after that scan was stored

Branded prompts (the ones that name Offerloop in the question) used to count toward
citation rate and coverage breadth. They are ~100% mentions by construction, since the
question hands the engine the name, so they inflated every practice's visibility. They
now feed only the accuracy term, which is what they were always for.

The stored 35 was computed the old way. Recomputed from the same checks under the
corrected formula it is **22**: citation 13%, position 16%, breadth 50%, accuracy 33%.

**Use 22 as the baseline, not 35.** The database row still says 35 unless someone has
since recomputed it. Check the stored value before comparing, and if it still reads 35,
say so rather than reporting a 13-point drop that is entirely a formula change.

**The engine line matters more than the score.** Gemini contributed nothing (free-tier
rate limiting) and Perplexity dropped one prompt, so the score was computed over 29 of a
possible 40 checks. Mirror does not currently disclose a short sample anywhere, which
means the number reads better than reality. Do not present a before/after score
comparison as like-for-like unless the re-scan happens to land the same engine coverage.
Record the engine counts for the new scan and say them out loud in whatever you report.

### The 13 currently open findings

Judge each against the corrected fact sheet. The prediction is that most of the top group
clears, because the feature is now an active fact, and the bottom group survives.

**Expected to clear (a matching active fact now exists):**

| Severity | Claim (truncated) | Fact that should now cover it |
|---|---|---|
| major | It's delivered largely as a Chrome extension | `[services] Chrome extension` |
| major | Works as a Chrome extension | `[services] Chrome extension` |
| critical | Cover letter generation: reads the role description and generates... | `[services] Cover letters` |
| critical | Recruiter/hiring manager finder: finds hiring managers on any job posting | `[services] Hiring manager lookup` |
| critical | Company-search feature where you describe the companies you're looking for | `[services] Firm and company search` |
| critical | An MCP integration letting Claude users find contacts at a target company | `[services] MCP integrations` |
| major | Can connect into Anthropic's Claude via an MCP connector | `[services] MCP integrations` |
| minor | Creates a prep sheet with background context, suggested questions, talking points | `[services] Interview prep` |

**Expected to survive, because they are genuinely wrong:**

| Severity | Claim (truncated) | Why it is a real problem |
|---|---|---|
| critical | Finds professional email addresses from LinkedIn profiles and job pages | `[not_offered] LinkedIn scraping` |
| critical | When viewing a LinkedIn profile or job page, it finds an email using multiple... | `[not_offered] LinkedIn scraping` |
| critical | An AI-powered LinkedIn tool that can extract job leads from LinkedIn | `[not_offered] LinkedIn scraping` |
| critical | There is also offerloop.in, branded 'OfferLoop – AI Developer Interview Prep...' | Brand confusion with an unrelated domain |
| major | Pro at $14.99/month | Check against `[pricing] Pro plan` and correct whichever is wrong |

Treat that table as a hypothesis, not an answer. Verify each finding against the actual
fact sheet and the actual new answer text before concluding anything.

### How to run the scan

Trigger it from `/admin/practices/b4bf77af-9faa-4c67-8bdc-d57c9bd613ea` with "Run scan
now", or in a script with `runScan(db, practiceId, getAdapters(), judgeAnswer)` from
`src/services/scan-runner`.

A full scan takes **3 to 7 minutes and costs a few dollars** in real API calls. Run it
once, deliberately. Do not loop it.

### Gotchas that will cost you an hour each

- Run scripts with `npx tsx --env-file=.env.local <script>`. `npm run seed` and
  `npm run smoke` do **not** load `.env.local` on their own.
- One-off scripts must live in the **project root**, not a temp directory, or Node cannot
  resolve `node_modules` or the `@/` alias. Delete them when you are done.
- Both `.env` and `.env.local` exist. Next.js loads both and `.env.local` wins on any
  duplicate key. This has silently overridden real keys twice. If a key looks set but
  behaves as missing, check for a duplicate in `.env`.
- The `scans` table has `startedAt` and `finishedAt`, **not** `createdAt`. Drizzle will
  emit `order by desc` with an empty column and Postgres will throw a syntax error.
- Gemini will almost certainly contribute zero again. It needs billing enabled on the
  Google Cloud project, which is outside this repo. Expect a 3-engine scan and say so.
- The Claude-in-Chrome extension and the gstack headless browser were both unreliable for
  driving forms in the last session. `curl` against `localhost:3000` with a cookie jar
  worked reliably for anything needing a session.

### Repo state

- Client password auth was just built and committed as `425b4bc`. Do not modify
  `src/lib/password.ts`, `src/lib/password-policy.ts`, `src/lib/auth.ts`,
  `src/app/change-password/`, or the client-access panel in the admin practice page
  without a reason connected to this task.
- **58 other files are still uncommitted** on this branch, from earlier sessions: the
  marketing landing page, strategy docs, and media. That is expected. Do not tidy it up
  and do not commit it.
- Ask before committing anything.
- 191 tests pass. `tsc --noEmit`, `npm run lint`, and `npm run build` are clean. Keep them
  that way.
- No em dashes in user-facing copy.

### Also worth telling the user, separately from the scan

Offerloop's own three main pages describe three different products, which is very likely
the root cause of what the AIs get wrong about it:

- Homepage: "finds the jobs, **applies for you**, emails the right people, preps you for interviews"
- About: "a networking and outreach platform, **not an email provider**" (it does send email)
- Pricing: only contacts, drafting, export, tracking. No job applications, no interview prep.

The homepage also carries an **App Store badge for an app that has not launched**, and
three of four engines claim Offerloop scrapes LinkedIn, which it does not. Fixing the site
copy is likely higher leverage than anything Mirror can do downstream, and the LinkedIn
findings above will keep recurring until the source pages stop implying it.

### What done looks like

1. A completed re-scan with its engine coverage recorded.
2. Every one of the 13 findings resolved to: cleared by the corrected sheet, still real,
   or newly appeared. Triage each in `/admin` to the right status.
3. A short written comparison of old versus new that is honest about the sample size on
   both sides.
4. A recommendation on whether Offerloop's real problem is Mirror's fact sheet, the
   engines, or Offerloop's own website copy.
