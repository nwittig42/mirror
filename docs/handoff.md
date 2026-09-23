# Mirror handoff (last updated 2026-09-03)

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
