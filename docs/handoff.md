# Mirror handoff (last updated 2026-10-05)

Paste the block below into a fresh session started in `~/geo-platform`.

---

## PROMPT

You are picking up work on **Mirror**, a GEO monitoring platform at `~/geo-platform`.
Branch `feat/audit-onboarding`. Next.js 16, Drizzle ORM, Neon Postgres, Auth.js, Resend.

**What the product does:** for each client practice it fires 10 tracked prompts at
ChatGPT, Claude, Gemini, and Perplexity, records whether the practice was named and
where it ranked against competitors, judges every branded answer against an
operator-maintained fact sheet to catch hallucinations, computes a 0-100 visibility
score, and emails the client a weekly Pulse. Operator triages findings in `/admin`.

### Everything below has been verified live, not just in tests

- **All four engine keys work.** Real scans have run end to end against real vendors.
- **The hallucination judge works** (Anthropic, `JUDGE_MODEL`). Tested on both a med spa
  and a SaaS fact sheet.
- **Resend key is valid** and send-only (it cannot read account settings, by design).
- **Neon Postgres is live**, all 14 tables created via `npx drizzle-kit push`.
- **The Calendly booking flow works end to end**, including the Google Meet link on the invite.
- 155 tests pass. `tsc --noEmit`, `npm run lint`, and `npm run build` are all clean.

### Built in the previous session

1. **Internal accuracy alert** (`src/services/alert-email.ts`). When a scan opens a new
   critical or major finding, the operator gets one digest email per practice. Clients
   never see it. Minor findings deliberately never alert.
2. **Split crons** (`vercel.json`). `weekly-scan` Thursday 14:00 UTC runs the scan and
   sends the operator alert. `weekly-pulse` Friday 15:00 UTC sends the client email.
   **The ~25 hour gap is the whole point**: it gives the operator a working day to fix
   what the scan found before the client reads about it. A test in
   `tests/app/cron.test.ts` fails if anyone folds `sendPulse` back into the scan loop.
3. **Calendly scheduler on `/book`** (`src/app/book/calendly-embed.tsx`). After the audit
   form is submitted, an inline Calendly widget replaces the old "we'll email you" panel,
   prefilled with the name and email just typed, with practice name and website carried
   in `utm_content` so the booking notification identifies the lead. Falls back to the old
   panel when `CALENDLY_URL` is unset.
4. **Judge generalized** from "medical aesthetics practice" to business-neutral, so the
   same engine can scan non-medical clients. Med spa behavior regression-tested, unchanged.
5. **Bug fixed: findings never linked to their facts.** The judge was returning the fact's
   *category* ("pricing") where the scanner matched on *label* ("Botox pricing"), so every
   finding was stored with a null `factId`/`factValue`. That blanked the truth column on
   the client accuracy page, the monthly report, the admin table, and the alert email. Fixed
   by rendering the fact sheet with explicit `label:` / `category:` fields.
6. **Bug fixed: dead Gemini model.** `gemini-2.5-flash` is closed to new API projects
   (404 "no longer available to new users"). Default is now `gemini-3.6-flash`.
7. **Copy:** em dashes removed from the onboarding flow, and every "fifteen minutes"
   promise changed to thirty to match the real Calendly event duration.

### Built 2026-09-03: automatic competitor discovery and the Competitors tab

The operator's typed competitor list is now a seed, not the ceiling. During a scan every
answer goes through `src/services/competitor-extractor.ts` (Anthropic, `JUDGE_MODEL`),
which returns the businesses the engine actually recommended. The practice is then ranked
against everyone named, and new names are saved to `competitors` with `source =
'discovered'`. Operator can hide a wrong one in `/admin` (`status = 'ignored'`), and hidden
names are never re-added. `checks.named_order` stores every business an answer named, in
order, practice included.

- `src/core/competitors.ts`: parsing plus `reconcileCompetitors`, which strips location
  tails ("Cienega Medical Spa – Santa Monica"), merges prefix variants ("SkinLab Santa
  Monica" onto "SkinLab"), drops the practice's own name, and respects hidden names.
- `src/services/scan-runner.ts`: takes the extractor as a fifth argument. Only names that
  literally appear in the answer are kept, so paraphrases like "Nurse Jamie's practice"
  never become rows. Extractor failure logs a warning and falls back to the known list.
- `src/lib/competitor-report.ts`: pure view model (share of voice, head-to-head table).
- `/dashboard/[slug]/competitors`: the client-facing tab. Overview links to it.
- `scripts/scan-once.ts <slug> [--reset-discovered]`: runs one real scan and prints what
  discovery found. `scripts/mint-operator-session.ts` prints a signed operator session
  cookie for driving the headless browser against the local dev server (the gstack
  browser cannot submit the login form's server action, but a `cookie` step in a
  `chain` works).

Verified live on Glow MedSpa: a real scan discovered roughly sixty Santa Monica businesses.
The first run exposed the same business under three or four spellings, which is why the
canonicalisation above exists. Expect scores to drop on the first re-scan of every
practice: a "first mention" that was really fourth behind three untyped competitors now
reads as what it is.

### Data currently in the database

- **Glow MedSpa** (`/dashboard/glow`), the fictional demo practice. Score 29.
- **Offerloop** (`/dashboard/offerloop`), a real product the user also works on. Score 35
  from a scan run against an incomplete fact sheet. The sheet has since been corrected to
  28 active facts but **has not been re-scanned**.

### Environment

Everything lives in **`.env.local`**. A `.env` file also exists and is a trap: Next.js
loads both, `.env.local` wins on any duplicate key, and this silently overrode real keys
twice. If a key looks set but behaves as missing, check for a duplicate in `.env`.

Set and working: the four engine keys, `RESEND_API_KEY`, `DATABASE_URL` (Neon),
`CALENDLY_URL`, `ALERT_EMAIL`, `LEADS_EMAIL`, `GEMINI_MODEL`.

### Open work, roughly in priority order

1. **Client password auth. Designed, approved in principle, not built.** Clients currently
   have no password; they log in by magic link. The user wants email and password set up
   with the client on the onboarding call. Agreed design:
   - Hashed password column on `users`, using Node's built-in `scrypt` (no new dependency,
     the project is deliberately dependency-light).
   - Operator creates the account in `/admin` and the screen shows a temporary password
     once, read to the client on the call. Client is forced to change it on first login.
   - Forgot-password reuses the existing magic link. No new token table, no new email.
   - Move the operator onto the same hashed path so the plaintext `OPERATOR_PASSWORD`
     comparison in `src/lib/auth.ts` goes away. The env var becomes the bootstrap that
     seeds the operator's hash. The README already flags the plaintext compare as a known
     limitation to fix before a second account exists.
   - Roughly half a day with tests.
2. **Re-scan Offerloop** against the corrected 28-fact sheet. The current score of 35 was
   computed against a sheet whose one-line "what Offerloop is" summary fact was read by the
   judge as an exhaustive definition, so four real features got flagged as hallucinations.
   That fact is archived; a clean re-scan should show only genuine findings.
3. **Gemini is contributing nothing.** On the free tier it rate-limits out on all 10 prompts,
   every scan, on both practices. Needs billing enabled on the Google Cloud project.
4. **Partial scans silently inflate the score.** When an engine fails, its checks are never
   recorded, so the citation rate is computed over a smaller denominator and reads better
   than reality. Nothing in the client's Pulse or monthly report says the sample was short.
   The operating manual promises every client claim traces to a logged check, so this needs
   a decision: surface "based on 3 of 4 engines," or refuse to score a badly incomplete scan.
5. **Dashboard vocabulary is med-spa-only.** Every surface says "practice," "patients," and
   "providers." Fine for the real ICP, wrong for any non-medical client like Offerloop.

### Real findings about Offerloop's own site, worth telling the user again

Its three main pages describe three different products, which is very likely the root cause
of what the AIs get wrong about it:
- Homepage: "finds the jobs, **applies for you**, emails the right people, preps you for interviews"
- About: "a networking and outreach platform, **not an email provider**" (it does send email)
- Pricing: only contacts, drafting, export, tracking. No job applications, no interview prep.

Also: the homepage carries an **App Store badge for an app that has not launched**, and three
of four engines claim Offerloop scrapes LinkedIn, which it does not.

### Gotchas learned the hard way

- Run scripts with `npx tsx --env-file=.env.local <script>`. `npm run seed` and `npm run smoke`
  do **not** load `.env.local` on their own.
- One-off scripts must live in the **project root**, not a temp directory, or Node cannot
  resolve `node_modules` and the `@/` alias.
- The Claude-in-Chrome extension was unreliable in this session. The gstack headless browser
  (`~/.claude/skills/gstack/browse/dist/browse`) worked well for scraping JS-rendered sites.
- Resend's sandbox sender only delivers to the address the Resend account is registered
  under until a domain is verified. A `/book` submit that errors instead of showing the
  scheduler is usually this, not a bug in the form.
- A full scan takes 3 to 7 minutes and costs a few dollars in API calls.

### Working agreements

- Nothing is committed. All of the above is uncommitted on `feat/audit-onboarding`.
  Ask before committing.
- No em dashes in user-facing copy.
- Verify with real runs, not just tests. The judge bug and the dead Gemini model were both
  invisible to a green test suite.

---

## 2026-10-05: the general small-business algorithm (`feat/general-business-algorithm`)

Everything above this line describes the branch as it stood on 2026-09-03 and is left as
written. This section is what the next session needs to know about the branch on top of it.

**Where the design is:** `docs/superpowers/specs/2026-10-05-general-business-algorithm-design.md`,
approved after a three-lens adversarial review. Every rule in it is a decision procedure with
named test inputs, and those inputs are the unit tests. It supersedes the vocabulary lock in
`docs/plans/2026-07-28-geo-monitoring-mvp.md`. Open work item 5 above ("Dashboard vocabulary is
med-spa-only") is closed by it.

**What did not change:** the score formulas, weights, caps and thresholds (visibility 50/20/15
rescaled over 0.85, fact score 100 minus 25/12/4 with price errors x1.5, overall 70/30 with a
critical cap at 70), branded prompts never counting toward visibility, the 75% coverage block,
the Thursday scan and Friday Pulse, the engine adapters, the PDF renderer, and every database
identifier and route (`practices`, `practice_id`, `/admin/practices/[id]`, `/dashboard/[slug]`).

**What changed, by spec section:**

1. **Name matching** (`src/core/mention.ts`, `src/core/position.ts`): a tolerant matcher
   (trailing legal suffixes and a leading article optional, apostrophes and case boundaries
   forgiven, every other token required, so "Harbor Plumbing" counts for "Harbor Plumbing LLC"
   but "Main Street Dental Group" never matches "Main Street Dental Associates"); a longer-name
   guard ("Harbor Plumbing & Heating" is a different business); echo detection ("I couldn't find
   any information about Harbor Plumbing" is not a mention). One analysis now drives both
   `mentioned` and `position`, so a check can no longer be named with position absent. A
   branded answer that only echoes the name is not judged and cannot push the fact score up.
2. **Namesake guard** (`src/services/tone-rater.ts`, `src/services/scan-runner.ts`): the tone
   rater also says whether the answer is about the same business and quotes its evidence. A
   check is vetoed only when the business has a location, the evidence is really in the
   answer, and the sentence naming the business lacks its city. Vetoed checks count as absent,
   are not judged, show a "Different business" pill in the admin answers tab, and are never
   quoted as the "AI recommended others" line. The admin "Add a business" form takes a category
   and a location so a hand-made business has them from the start.
3. **Competitor extraction for any trade** (`src/services/competitor-extractor.ts`,
   `src/core/competitors.ts`): chains and franchises count as competitors; directories, review
   sites and marketplaces are dropped by exact name; a discovered name that is a client name
   plus a conjunction tail is a different business and is kept.
4. **Questions for any trade** (`src/services/question-drafter.ts`, `src/core/prompts.ts`,
   `src/services/prospect-setup.ts`): the drafter is told the lead's category and location as
   fact when the lead gave them; a deterministic six-question fallback (four category, two
   branded, every one naming the location) is used when the drafter returns nothing and both
   are known. No "near me" phrasing anywhere: the engine adapters send no user location.
5. **/book** gains "What kind of business is it?" and "City or area" (optional, 60 and 80
   characters); `leads` gains `category` and `location`, applied with `npm run db:push`. Both
   show in the admin leads list and the internal audit-request email, and are copied to the
   business on prospect setup.
6. **Sources from every trade** (`src/core/citations.ts`): home-services, legal, dining,
   travel, real-estate, automotive, care and wedding directories classify as reviews; the six
   source types in the report are unchanged.
7. **Website checks** go from five to seven: `business_schema` ("Your business is labeled for
   machines") and `contact_visible` ("Your phone, address and hours are easy to find"), with
   `facts_page` made trade-neutral (about plus services passes; fees, estimates and quotes
   count as pricing). The report's website page fits seven rows on one sheet. Older scans
   stored five checks and keep rendering.
8. **Words people read**: "business", "customers", "team" or "people" and "services"
   everywhere a prospect, client or operator reads, including the landing page, `/book`,
   `/login`, `/app`, `/change-password`, the dashboard and admin, the report pages, the
   emails, the README and the call script. The Pulse subject is now "What AI told customers
   about <name> this week". Fact categories keep their enum values and read Identity, People
   and credentials, Services and products, Not offered, Pricing, Logistics, Licenses and
   compliance. Acceptance gate: `grep -rniE "patient|practice|provider|treatment|med ?spa|botox|injector" src --include=*.tsx --include=*.ts`
   finds nothing inside a user-facing string.
9. **Demo data**: `scripts/seed.ts` now creates Harbor Plumbing and Drain, a fictional plumber
   in Portland, OR (`/dashboard/harbor-plumbing`, category "Plumber", location "Portland, OR"),
   with facts in all seven categories, ten prompts (six category, two branded, two
   informational, the city in every category and branded prompt), three competitors and two
   name variations. Still idempotent by slug. A database that holds the old "glow" demo keeps
   it and gains this one. The landing page's example card and `src/report/sample-audit.json`
   are the same business.

**The first scan after this ships: say this on the call.** The named rate moves the first time
every existing client is scanned, and no formula changed. Tolerant matching adds mentions that
exact matching missed; echo detection, the longer-name guard and the namesake guard remove
mentions that were never real. Expect a one-week step in each client's trend, in either
direction, and explain it as the measurement getting more accurate, not as their visibility
changing. The README carries the same note.

**Verification before merge**, per the spec's Testing section: the full suite, `tsc --noEmit`,
`npm run lint` and `next build`; then, against a local database with the seed loaded, submit
`/book` with the new fields and watch the lead reach admin with them, create a business with a
category and a location, run a scan with fake engines, open the dashboard, the four report
variants (the website page with seven rows) and the admin overview, issue a client password,
sign in as the client, change it, and land on the dashboard. The `drizzle/` migration folder
was deliberately not regenerated; schema changes go in with `npm run db:push` as they have
since audit v2.
