# Mirror

Mirror is an AI-visibility monitoring platform for aesthetic medical practices — "See what AI tells your patients." It runs weekly citation scans across ChatGPT, Claude, Gemini, and Perplexity, detects hallucinations against a practice's fact sheet, and reports an AI Visibility Score on a client dashboard.

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

## Environment

All environment variables are validated at startup via `src/lib/env.ts` (see `.env.example` for the full list). LLM vendor model IDs (`OPENAI_MODEL`, `ANTHROPIC_MODEL`, `GEMINI_MODEL`, `PERPLEXITY_MODEL`, `JUDGE_MODEL`) are read from env with defaults there — never hardcode a model ID elsewhere in the codebase.

## Security

- **Operator credentials are a plaintext env var for MVP.** `OPERATOR_PASSWORD` (checked against `OPERATOR_EMAIL` in the Credentials provider in `src/lib/auth.ts`) is compared as plain text, not hashed. This is acceptable while there's a single operator account and `AUTH_SECRET`/env vars are managed via a secrets-aware host (e.g. Vercel env vars), but it should be replaced with a hashed password (bcrypt/argon2) and a proper operator-account table before adding a second operator or any self-serve operator signup.
- Client auth is passwordless (Resend magic links via `EMAIL_FROM`), so this only affects the single operator login path.
- **The operator account can only be reached via the Credentials provider.** `src/lib/auth.ts`'s `signIn` callback rejects the Resend (magic-link) provider whenever the email matches `OPERATOR_EMAIL`, so knowing the operator's email address alone is never enough to sign in as operator — the password is always required.
- `AUTH_SECRET` must be a strong random value in every real deployment — Auth.js throws at runtime if it's missing in production.
- **`trustHost: true` (set in `src/lib/auth.ts`, required for Vercel) trusts the incoming request's `Host` header for building callback/magic-link URLs unless `AUTH_URL` is set.** Set `AUTH_URL` to your canonical `https://` domain in every real deployment — see `.env.example`. Without it, a spoofed `Host` header could redirect magic links to an attacker-controlled domain.
- `loadEnv()` (`src/lib/env.ts`) refuses to start when `NODE_ENV === "production"` **and** `AUTH_URL` is set **and** `OPERATOR_EMAIL`/`OPERATOR_PASSWORD` are still the dev defaults — this catches a deploy that forgot to set real operator credentials. It's gated on `AUTH_URL` (not `NODE_ENV` alone) specifically so `next build`, which itself runs with `NODE_ENV=production`, never trips it — the check only fires when `loadEnv()` runs at real runtime against a deployment that has set `AUTH_URL` per the bullet above.

## Known limitation: API vs. consumer answers

Mirror's scans call the four vendors' APIs (OpenAI, Anthropic, Gemini, Perplexity) with web search enabled, rather than driving the consumer chat apps directly. API responses closely track what a patient would see in ChatGPT, Claude, Gemini, or Perplexity's consumer apps, but they are not guaranteed to be byte-for-byte identical — the underlying model version, system prompt, and search grounding can differ slightly between the API and consumer surfaces. This is the standard tradeoff every commercial GEO (generative-engine optimization) monitoring tool makes in order to get automated, repeatable, and auditable results, and it is why Mirror stores every scored number as a `check` row tied back to the exact prompt and response used.
