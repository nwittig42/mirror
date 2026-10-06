# Mirror

Mirror is an AI-visibility monitoring platform for small businesses: "See what AI tells your customers." Every week it asks ChatGPT, Claude, Gemini, Grok and Perplexity (Grok needs `XAI_API_KEY`; see the ship checklist) the questions a business's customers ask, records whether the business was named and where it ranked against competitors, checks every claim about the business against its fact sheet, and reports an AI Visibility Score on a client dashboard. It works for any business customers find by asking for a kind of service in a place: a plumber, a bakery, a law firm, a gym, a med spa.

The current design is `docs/superpowers/specs/2026-10-05-general-business-algorithm-design.md`. It supersedes the older vocabulary lock in `docs/plans/2026-07-28-geo-monitoring-mvp.md`: every word a person reads says "business", "customers", "team" or "people", and "services". Database identifiers and routes (`practices`, `practice_id`, `/admin/practices/[id]`, `/dashboard/[slug]`) keep their names.

## Getting Started

Install dependencies and copy the env template:

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` with real credentials, then run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Testing

```bash
npm run test
```

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in real credentials
npm run db:push              # push the drizzle schema to your database
npm run seed                 # creates the operator user + the demo business
npm run dev
```

`npm run seed` does not load `.env.local` on its own; when the keys live there, run `npx tsx --env-file=.env.local scripts/seed.ts`. The demo is Harbor Plumbing and Drain, a fictional plumber in Portland, OR (`/dashboard/harbor-plumbing`): facts in all seven categories, ten prompts (every one naming the city), three competitors and two name variations. The same business is the landing page's example card and the report preview's sample data (`src/report/sample-audit.json`), so the three agree on what it offers and does not offer: in particular, there is no 24/7 emergency line anywhere. The seed is idempotent by slug, so a database that already holds the older demo simply gains this one.

## What to expect on the first scan after this upgrade

The named rate moves the first time an existing client is scanned after the general-business algorithm ships, and no formula changed. Name matching is now tolerant (so "Harbor Plumbing" counts for "Harbor Plumbing LLC" and "Joes Pizza" for "Joe's Pizza"), which adds mentions that exact matching missed; echo detection ("I couldn't find any information about Harbor Plumbing" is not a mention), the longer-name guard ("Harbor Plumbing & Heating" is a different business) and the namesake guard (the Denver "Harbor Plumbing" is not the Portland client) remove mentions that were never real. Expect a one-week step in each client's trend, in either direction, and explain it on the call as the measurement getting more accurate, not as their visibility changing. `docs/handoff.md` carries the same note.

## The /book form

`/book` asks for the business name and website, the contact's name, email, phone and best times to reach them, and two optional fields: "What kind of business is it?" (placeholder "Plumber, bakery, law firm, med spa", 60 characters) and "City or area" (placeholder "Portland, OR", 80 characters). Both are saved on the lead, shown in the admin leads list and the internal audit-request email, and copied to the business when prospect setup runs. They matter: the question drafter states them as fact instead of guessing from the website, the namesake guard uses the location to tell the client apart from a business with the same name somewhere else, and when the drafter returns no questions but both are known, a fixed fallback set of six questions (four category, two branded, every one naming the location) is used so the lead is still scanned. When either is missing and the drafter returns nothing, the lead is parked as "needs a look" and nothing is scanned or emailed. The honeypot, the rate cap and the write-then-send order are unchanged.

## Website checks

The audit report's website page runs seven checks against the business's site (`src/core/website-check.ts`, `src/services/website-check.ts`):

1. **AI assistants are allowed to read your site** (`ai_allowed`): robots.txt does not block the AI crawlers.
2. **Your text is readable without special page code** (`readable_text`): the homepage text is in the page itself, not only rendered by scripts.
3. **You have a clear facts page** (`facts_page`): an about page plus a services page passes, since many trades never publish a price list; fees, estimates and "how you quote" count as pricing.
4. **Prices and FAQs are labeled for machines** (`machine_labels`): Offer, Product, Service or FAQPage schema markup.
5. **You have a sitemap** (`sitemap`).
6. **Your business is labeled for machines** (`business_schema`): LocalBusiness or Organization JSON-LD with a phone or an address, and a name that matches one of the business's name variations.
7. **Your phone, address and hours are easy to find** (`contact_visible`): a phone number or a street address, and opening hours, in the plain text of the homepage or the contact page (licence numbers are not phone numbers; JSON-LD `openingHours` counts).

Older scans stored five checks and keep rendering.

## Ship checklist

- [ ] Neon database created and `DATABASE_URL` set
- [ ] `npm run db:push`
- [ ] All required env keys set in Vercel:
  - `DATABASE_URL`
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `GEMINI_API_KEY`
  - `PERPLEXITY_API_KEY`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - `CRON_SECRET`
  - `AUTH_SECRET`
  - `AUTH_URL` (canonical `https://` domain, required in production, see Security)
  - `APP_URL`
  - `OPERATOR_EMAIL` (real value; production refuses the dev default once `AUTH_URL` is set)
  - `OPERATOR_PASSWORD` (real value; same guard)
  - `XAI_API_KEY` (must be set in production: the landing page, `/book`, its success screen and the prospect emails all promise five engines, and Grok only runs when this key is present. The code treats it as optional so local dev works without it. `GROK_MODEL` overrides its model)
  - `VERCEL_AUTOMATION_BYPASS_SECRET` (set by Vercel when Protection Bypass for Automation is on; lets the weekly cron call the per-business scan route on a protected deployment)
  - `ALERT_EMAIL` (optional; where internal accuracy alerts go, falls back to `OPERATOR_EMAIL`)
  - `LEADS_EMAIL` (optional; where `/book` audit requests go, falls back to `OPERATOR_EMAIL`)
  - `CALENDLY_URL` (optional; scheduling link shown after `/book` is submitted. Unset, the form falls back to a "we'll email you" panel and no scheduler renders)
  - `SCAN_RUNS` (optional, default 3; how many times each prompt is asked of each engine per scan. The score is built from every run and the low/high band is shown next to it. Each extra run adds about a third to scan time and engine cost)
  - `SUPPORT_EMAIL` (optional; where client "Need help?" requests from the dashboard's Help tab go, falls back to `OPERATOR_EMAIL`)
- [ ] Vercel project is on a **paid plan**. The cron route and the admin scan-trigger pages set `maxDuration = 800` for the multi-minute scan, which the free Hobby tier's 10s/60s function limit cannot satisfy
- [ ] `vercel deploy`
- [ ] Both cron jobs visible in the Vercel dashboard (scan Thursday, pulse Friday)
- [ ] `npm run seed` run against the prod database
- [ ] Operator login works
- [ ] `npm run smoke` passes all five engines (it runs 4 when `XAI_API_KEY` is missing, which is the sign the key above was skipped)
- [ ] Trigger the first real scan from `/admin`
- [ ] Create the first client's account from their business page in `/admin` and read them the temporary password on the onboarding call

**Cost note:** at 10 prompts × 5 engines × 3 runs (`SCAN_RUNS`), expect roughly 150 search-enabled engine calls per business per week, plus the fact judge, the tone rater and the competitor extractor on `JUDGE_MODEL`. A full scan takes a few minutes and has cost a few dollars in API calls. Recheck vendor pricing at deploy time, because model pricing changes.

## The weekly cycle runs as two crons, on purpose

`vercel.json` schedules two jobs, and the gap between them is a product decision, not an accident:

| | When | What it does | Who hears about it |
|---|---|---|---|
| `/api/cron/weekly-scan` | Thursday 14:00 UTC | Scans every active business, then emails the operator an **internal accuracy alert** for any *new* critical/major finding | Operator only |
| `/api/cron/weekly-pulse` | Friday 15:00 UTC | Sends each client their weekly Pulse ("What AI told customers about <name> this week") off the latest complete scan | Client |

The ~25-hour gap is the operator's window to fix what the scan found, so the Pulse can read "handled" instead of handing the client a fire drill. Folding `sendPulse` back into the scan loop silently removes that window; `tests/app/cron.test.ts` has a test that fails if someone does.

Minor findings never trigger an alert. They appear in the dashboard and in the Pulse's open-issue count. Paging the operator for them would train them to ignore the alert.

Manual scans triggered from `/admin` do **not** send an alert: the operator is already looking at the screen, and a newly-onboarded business would otherwise blast a baseline's worth of findings into their inbox.

## Environment

All environment variables are validated at startup via `src/lib/env.ts` (see `.env.example` for the full list). LLM vendor model IDs (`OPENAI_MODEL`, `ANTHROPIC_MODEL`, `GEMINI_MODEL`, `PERPLEXITY_MODEL`, `GROK_MODEL`, `JUDGE_MODEL`) are read from env with defaults there. Never hardcode a model ID elsewhere in the codebase.

## Security

- **Passwords are scrypt hashes in `users.password_hash`,** never plaintext, for operators and clients alike. `src/lib/password.ts` uses Node's built-in `scrypt` (no new dependency) and stores the cost parameters inside each hash, so the cost can be raised later without locking out anyone hashed under the old one. Verification is constant-time and fails closed on a null or malformed hash.
- **`OPERATOR_PASSWORD` is a bootstrap, not a stored credential.** The first time the operator signs in, it seeds their hash; from then on it is ignored, so an operator who changes their password at `/change-password` is not still reachable through a stale env var. It remains required (and guarded against the dev default, below) so a fresh deployment has a way in.
- **Clients get a password on the onboarding call.** The operator issues one from the business page in `/admin`, reads it aloud, and it is shown on screen exactly once: it is never emailed, never written to the activity log, and never recoverable. The account is flagged `must_change_password`, and middleware pins the client to `/change-password` until they choose their own.
- **Forgot-password is the magic link.** A client who has lost their password signs in via the Resend link and sets a new one, so there is no separate reset-token table or email. A link session is not asked for the current password (it could not supply one); a password session that is not mid-forced-change is.
- **The operator account can only be reached via the Credentials provider.** `src/lib/auth.ts`'s `signIn` callback rejects the Resend (magic-link) provider whenever the email matches `OPERATOR_EMAIL`, so knowing the operator's email address alone is never enough to sign in as operator. The password is always required. The trade-off is that the operator has no magic-link recovery: if they forget a password they set in-app, clear `password_hash` on their `users` row and sign in again with `OPERATOR_PASSWORD` to re-bootstrap.
- `AUTH_SECRET` must be a strong random value in every real deployment. Auth.js throws at runtime if it's missing in production.
- **`trustHost: true` (set in `src/lib/auth.ts`, required for Vercel) trusts the incoming request's `Host` header for building callback/magic-link URLs unless `AUTH_URL` is set.** Set `AUTH_URL` to your canonical `https://` domain in every real deployment; see `.env.example`. Without it, a spoofed `Host` header could redirect magic links to an attacker-controlled domain.
- `loadEnv()` (`src/lib/env.ts`) refuses to start when `NODE_ENV === "production"` **and** `AUTH_URL` is set **and** `OPERATOR_EMAIL`/`OPERATOR_PASSWORD` are still the dev defaults. This catches a deploy that forgot to set real operator credentials. It's gated on `AUTH_URL` (not `NODE_ENV` alone) specifically so `next build`, which itself runs with `NODE_ENV=production`, never trips it. The check only fires when `loadEnv()` runs at real runtime against a deployment that has set `AUTH_URL` per the bullet above.

## Known limitation: API vs. consumer answers

Mirror's scans call the vendors' APIs (OpenAI, Anthropic, Gemini, Perplexity, and xAI when Grok is enabled) with web search enabled, rather than driving the consumer chat apps directly. API responses closely track what a customer would see in ChatGPT, Claude, Gemini, Grok, or Perplexity's consumer apps, but they are not guaranteed to be byte-for-byte identical, because the underlying model version, system prompt, and search grounding can differ slightly between the API and consumer surfaces. This is the standard tradeoff every commercial GEO (generative-engine optimization) monitoring tool makes in order to get automated, repeatable, and auditable results, and it is why Mirror stores every scored number as a `check` row tied back to the exact prompt and response used.

## Audit tools

- **Audit report:** `/dashboard/<slug>/audit`, a printable one-scan readout (score and run-to-run range, visibility, fact accuracy, who AI recommends, where it gets its answers, what it gets wrong, the seven website checks, what to do first). Print, then Save as PDF. Linked from the admin business page.
- **Sources tab:** `/dashboard/<slug>/sources`, the sites engines cited and the ones cited when a competitor was recommended instead.
- **Fact sheet:** seven categories, Identity, People and credentials, Services and products, Not offered, Pricing, Logistics, and Licenses and compliance. "Draft from website" on the admin business page, or `npx tsx --env-file=.env.local scripts/draft-facts.ts <slug> [--dry-run]`, drafts them; drafts are ignored by scans until approved. Call script: `docs/fact-sheet-intake.md`.
- **Support:** clients use the Help tab; requests land in the queue at the top of `/admin` and are emailed to `SUPPORT_EMAIL`.
