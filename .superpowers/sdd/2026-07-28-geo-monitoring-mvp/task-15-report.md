# Task 15 report: seed script, deployment, ship checklist

## Status: DONE

## Commits
- `06fd3ed` — chore: seed, scripts, ship checklist (tagged `v0.1.0`)

## Test summary
`npm run test` (twice): 16 test files, 97 tests, all green both runs. `npx tsc --noEmit`: clean. `npm run lint`: clean. `npm run build`: succeeds (Next.js 16 Turbopack build, all routes compile).

## What changed
- **`scripts/seed.ts`** (new): upserts the operator user by `OPERATOR_EMAIL` (create-or-promote, mirroring `src/lib/auth.ts`'s Credentials-provider upsert), then upserts the demo practice "Glow MedSpa" (slug `glow`, website `https://glow-medspa.example`) by slug. If the practice already exists, all child inserts are skipped — documented in the file header as the idempotency contract (simplest robust approach; re-running won't create duplicates but won't pick up seed-data edits either). On first run it inserts: 8 facts across categories (identity, providers×2, services×2, not_offered, pricing, logistics — including "Surgical procedures — NOT offered"), 10 prompts (6 category / 2 branded / 2 informational, Santa Monica med-spa queries), 3 competitors, 2 name variations.
- **`package.json`**: added `seed` (`tsx scripts/seed.ts`), `smoke` (`tsx scripts/smoke-engines.ts`), `db:push` (`drizzle-kit push`), `db:studio` (`drizzle-kit studio`). `test` already existed.
- **`vitest.config.ts`**: set `fileParallelism: false` with a comment explaining PGlite instance contention across worker processes was causing flaky timeouts (previously reproduced: 7 files failed under default parallelism before the fix, 0 failed after, across two full runs).
- **`README.md`**: added a `## Local dev` section (env setup, `db:push`, `seed`, `dev`) and a literal `## Ship checklist` section with the full deploy sequence, the complete list of required Vercel env keys, and the cost note (~40 search calls + ~8 judge calls per practice per week, budget a few dollars/practice/month, recheck vendor pricing at deploy time).

## Concerns
- The brief's step 3 said "all 8 env keys in Vercel" without naming them. Cross-checking `src/lib/env.ts`'s zod schema, the technically-required-with-no-default set is actually 9 (`DATABASE_URL`, 4 vendor API keys, `RESEND_API_KEY`, `CRON_SECRET`, `AUTH_SECRET`, `APP_URL`), and a correct production deploy additionally needs `AUTH_URL`, `OPERATOR_EMAIL`, and `OPERATOR_PASSWORD` overridden (the prod-default guard in `loadEnv()` requires this). Rather than force-fit "8," the README checklist lists the complete, accurate set (13 keys) with a one-line note on why `AUTH_URL`/`OPERATOR_EMAIL`/`OPERATOR_PASSWORD` matter. Flagging in case "8" was meant to exclude some of these deliberately.
- `scripts/seed.ts` is untested against a real Neon/Postgres instance in this session (no `DATABASE_URL` available in the sandbox) — verified only via `tsc --noEmit` and manual review against the schema/enum values. Recommend a quick `npm run db:push && npm run seed` dry run against a scratch database before using it on prod.
- No other structural issues found; full gate (test ×2, tsc, lint, build) is green.
