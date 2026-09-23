# Mirror

Mirror is an AI-visibility monitoring platform for aesthetic medical practices: "See what AI tells your patients." It runs weekly citation scans across ChatGPT, Claude, Gemini, and Perplexity, detects hallucinations against a practice's fact sheet, and reports an AI Visibility Score on a client dashboard.

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
npm run seed                 # creates the operator user + demo "Glow MedSpa" practice
npm run dev
```

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
  - `ALERT_EMAIL` (optional; where internal accuracy alerts go, falls back to `OPERATOR_EMAIL`)
  - `LEADS_EMAIL` (optional; where `/book` audit requests go, falls back to `OPERATOR_EMAIL`)
  - `CALENDLY_URL` (optional; scheduling link shown after `/book` is submitted. Unset, the form falls back to a "we'll email you" panel and no scheduler renders)
- [ ] Vercel project is on a **paid plan**, and the four `maxDuration` exports are raised back up. The scan routes currently declare `maxDuration = 60`, the Hobby ceiling, so that the project deploys on the free plan. A real scan takes 3 to 7 minutes, so **on Hobby the weekly cron and the admin "Run scan now" button both time out mid-scan and leave the `scans` row stuck `running`**. Run scans locally (`npx tsx --env-file=.env.local scripts/scan-once.ts <slug>`) until the plan is upgraded. On Pro, restore `800` in `src/app/api/cron/weekly-scan/route.ts`, `src/app/admin/page.tsx`, `src/app/admin/practices/[id]/page.tsx`, and `300` in `src/app/api/cron/weekly-pulse/route.ts`
- [ ] `vercel deploy`
- [ ] Both cron jobs visible in the Vercel dashboard (scan Thursday, pulse Friday)
- [ ] `npm run seed` run against the prod database
- [ ] Operator login works
- [ ] `npm run smoke` passes all 4 engines
- [ ] Trigger the first real scan from `/admin`
- [ ] Invite the first client email

**Cost note:** at 10 prompts × 4 engines × roughly weekly scans, expect about 40 search-enabled calls plus about 8 judge calls per practice per week. Budget a few dollars per practice per month, and recheck vendor pricing at deploy time, because model pricing changes.

## The weekly cycle runs as two crons, on purpose

`vercel.json` schedules two jobs, and the gap between them is a product decision, not an accident:

| | When | What it does | Who hears about it |
|---|---|---|---|
| `/api/cron/weekly-scan` | Thursday 14:00 UTC | Scans every active practice, then emails the operator an **internal accuracy alert** for any *new* critical/major finding | Operator only |
| `/api/cron/weekly-pulse` | Friday 15:00 UTC | Sends each client their weekly Pulse off the latest complete scan | Client |

The ~25-hour gap is the operator's window to fix what the scan found, so the Pulse can read "handled" instead of handing the client a fire drill. Folding `sendPulse` back into the scan loop silently removes that window; `tests/app/cron.test.ts` has a test that fails if someone does.

Minor findings never trigger an alert. They appear in the dashboard and in the Pulse's open-issue count. Paging the operator for them would train them to ignore the alert.

Manual scans triggered from `/admin` do **not** send an alert: the operator is already looking at the screen, and a newly-onboarded practice would otherwise blast a baseline's worth of findings into their inbox.

## Environment

All environment variables are validated at startup via `src/lib/env.ts` (see `.env.example` for the full list). LLM vendor model IDs (`OPENAI_MODEL`, `ANTHROPIC_MODEL`, `GEMINI_MODEL`, `PERPLEXITY_MODEL`, `JUDGE_MODEL`) are read from env with defaults there. Never hardcode a model ID elsewhere in the codebase.

## Security

- **Passwords are scrypt hashes in `users.password_hash`,** never plaintext, for operators and clients alike. `src/lib/password.ts` uses Node's built-in `scrypt` (no new dependency) and stores the cost parameters inside each hash, so the cost can be raised later without locking out anyone hashed under the old one. Verification is constant-time and fails closed on a null or malformed hash.
- **`OPERATOR_PASSWORD` is a bootstrap, not a stored credential.** The first time the operator signs in, it seeds their hash; from then on it is ignored, so an operator who changes their password at `/change-password` is not still reachable through a stale env var. It remains required (and guarded against the dev default, below) so a fresh deployment has a way in.
- **Clients get a password on the onboarding call.** The operator issues one from the practice page in `/admin`, reads it aloud, and it is shown on screen exactly once: it is never emailed, never written to the activity log, and never recoverable. The account is flagged `must_change_password`, and middleware pins the client to `/change-password` until they choose their own.
- **Forgot-password is the magic link.** A client who has lost their password signs in via the Resend link and sets a new one, so there is no separate reset-token table or email. A link session is not asked for the current password (it could not supply one); a password session that is not mid-forced-change is.
- **The operator account can only be reached via the Credentials provider.** `src/lib/auth.ts`'s `signIn` callback rejects the Resend (magic-link) provider whenever the email matches `OPERATOR_EMAIL`, so knowing the operator's email address alone is never enough to sign in as operator. The password is always required. The trade-off is that the operator has no magic-link recovery: if they forget a password they set in-app, clear `password_hash` on their `users` row and sign in again with `OPERATOR_PASSWORD` to re-bootstrap.
- `AUTH_SECRET` must be a strong random value in every real deployment. Auth.js throws at runtime if it's missing in production.
- **`trustHost: true` (set in `src/lib/auth.ts`, required for Vercel) trusts the incoming request's `Host` header for building callback/magic-link URLs unless `AUTH_URL` is set.** Set `AUTH_URL` to your canonical `https://` domain in every real deployment; see `.env.example`. Without it, a spoofed `Host` header could redirect magic links to an attacker-controlled domain.
- `loadEnv()` (`src/lib/env.ts`) refuses to start when `NODE_ENV === "production"` **and** `AUTH_URL` is set **and** `OPERATOR_EMAIL`/`OPERATOR_PASSWORD` are still the dev defaults. This catches a deploy that forgot to set real operator credentials. It's gated on `AUTH_URL` (not `NODE_ENV` alone) specifically so `next build`, which itself runs with `NODE_ENV=production`, never trips it. The check only fires when `loadEnv()` runs at real runtime against a deployment that has set `AUTH_URL` per the bullet above.

## Known limitation: API vs. consumer answers

Mirror's scans call the four vendors' APIs (OpenAI, Anthropic, Gemini, Perplexity) with web search enabled, rather than driving the consumer chat apps directly. API responses closely track what a patient would see in ChatGPT, Claude, Gemini, or Perplexity's consumer apps, but they are not guaranteed to be byte-for-byte identical, because the underlying model version, system prompt, and search grounding can differ slightly between the API and consumer surfaces. This is the standard tradeoff every commercial GEO (generative-engine optimization) monitoring tool makes in order to get automated, repeatable, and auditable results, and it is why Mirror stores every scored number as a `check` row tied back to the exact prompt and response used.
