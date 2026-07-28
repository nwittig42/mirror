# Task 1 Report: Scaffold project, tooling, env

## What was done

1. **Scaffold.** `create-next-app@latest` refuses to run into a non-empty directory, so it was run into a temp dir (`app` subfolder of a scratch dir) with flags `--ts --tailwind --app --src-dir --import-alias "@/*" --use-npm --eslint --no-turbopack`, then all generated files (`.gitignore`, `eslint.config.mjs`, `next-env.d.ts`, `next.config.ts`, `node_modules`, `package.json`, `package-lock.json`, `postcss.config.mjs`, `public/`, `src/app/*`, `tsconfig.json`) were moved into `/Users/nicholaswittig/geo-platform`, preserving the existing `docs/` and `.superpowers/`. The scaffold's own `.git` was discarded (the destination already has its own repo). Two Next.js-generated agent-instruction files (`AGENTS.md`, `CLAUDE.md`) were dropped — out of scope for the brief and risk of colliding with future project conventions.
2. **Installed exactly the brief's dependency line:** `drizzle-orm @neondatabase/serverless zod resend next-auth@beta @auth/drizzle-adapter recharts` (prod) and `drizzle-kit vitest @vitest/coverage-v8 @electric-sql/pglite tsx` (dev). Nothing beyond that list.
3. **package.json**: renamed `name` from the scaffold default `"app"` to `"mirror"`; added `"test": "vitest run"` script per the task instructions (not in the brief's literal snippet but called out explicitly by the resolutions).
4. **tsconfig.json**: scaffold already produced `strict: true` and `"@/*": ["./src/*"]` — verified, no changes needed.
5. **vitest.config.ts**: created, aliasing `@` to `./src` via `path.resolve(__dirname, "./src")` so `tests/lib/env.test.ts` can `import("@/lib/env")`.
6. **tests/lib/env.test.ts**: written per the brief's snippet, with one addition per the task's ambiguity resolution — `vi.resetModules()` added inside `beforeEach` (imported `vi` from vitest) so each test's dynamic `import("@/lib/env")` re-evaluates the module against the mutated `process.env` rather than hitting Vitest's module cache.
7. **Ran the test — confirmed FAIL** with `Cannot find package '@/lib/env'` (module not yet created), matching the brief's expected TDD red state.
8. **src/lib/env.ts**: implemented exactly per the brief's snippet — zod schema with all required string keys (`DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `AUTH_SECRET`, `APP_URL`) and defaulted model/name keys (`OPENAI_MODEL` default `gpt-5.1`, `ANTHROPIC_MODEL` default `claude-sonnet-5`, `GEMINI_MODEL` default `gemini-2.5-flash`, `PERPLEXITY_MODEL` default `sonar-pro`, `JUDGE_MODEL` default `claude-haiku-4-5-20251001`, `NEXT_PUBLIC_APP_NAME` default `Mirror`). `loadEnv()` throws `Invalid environment: <dotted paths>` on failure — matches the test's `toThrow(/DATABASE_URL/)` assertion.
9. **Ran the test — confirmed PASS** (2/2).
10. **.env.example**: created listing every key from the schema with placeholder values, grouped by concern (database, LLM keys, LLM model IDs, email, cron, auth, app).
11. **README.md**: replaced the create-next-app boilerplate with a Mirror-specific README (what it is, getting started, testing, environment note pointing at `src/lib/env.ts`) plus the required "Known limitation: API vs consumer answers" paragraph, worded per the brief.
12. **.gitignore**: kept the scaffold-generated ignores and added `!.env.example` (so the required `.env*` ignore doesn't also hide the example file) and `.superpowers/` per the global constraints.
13. Two commits, in the order the brief's steps imply:
    - `chore: scaffold next.js app` — scaffold output (deps, tsconfig, next/eslint/postcss config, public/, src/app/*, .gitignore) with the original boilerplate README, so the "chore" commit reflects only the scaffold step.
    - `feat: env validation with model defaults` — vitest.config.ts, src/lib/env.ts, tests/lib/env.test.ts, .env.example, and the rewritten README.
14. This report is committed as a third, final commit (`.superpowers/` is gitignored per the constraints above, so it required `git add -f`).

## Deviations from the brief and why

- **create-next-app flags**: used `--src-dir --eslint --no-turbopack` instead of the brief's literal (invalid) `--no-src-dir=false`; intent (App Router, TS, Tailwind, src/, `@/*` alias, npm) preserved, per the pre-authorized resolution.
- **Scaffolded in a temp dir and moved files in**, since `create-next-app` refused the non-empty target directory — per the pre-authorized resolution.
- **Dropped `AGENTS.md`/`CLAUDE.md`** that recent `create-next-app` versions auto-generate. Not called for by the brief; left out to avoid an unreviewed root `CLAUDE.md` conflicting with future project conventions. Can be restored if wanted.
- **Renamed `package.json` `name`** from `"app"` (an artifact of scaffolding into a dir literally named `app`) to `"mirror"`. Not in the brief's file list explicitly but avoids a permanently wrong package name.
- **Added `"test": "vitest run"` script** — per the task's explicit resolution note, not in the brief's snippet.
- **Added `vi.resetModules()`** to the test's `beforeEach` — per the task's explicit resolution note, not in the brief's literal test snippet (the literal snippet as written would pass on a fresh process but is fragile to Vitest's module cache across the two `it` blocks; the resolution asked for this defensively and it doesn't change the test's behavior here since both tests currently pass either way).
- **`zod` resolved to v4.4.3** (latest at scaffold time) rather than a v3 pin. `z.string().url()` as written in the brief is still supported in zod v4 (verified directly), so no schema changes were needed. Flagging in case a later task assumes zod v3 semantics elsewhere.
- **package-lock.json is large** (~10.4k lines) — standard for a fresh Next.js + all listed deps install; not trimmed.

## Test commands run and output summary

- `npx vitest run tests/lib/env.test.ts` (before implementing `env.ts`): **2 failed** — `Cannot find package '@/lib/env'` (expected red state).
- `npx vitest run tests/lib/env.test.ts` (after implementing `env.ts`): **2 passed**.
- `npm run test` (full suite, final): **1 test file, 2 tests passed**.
- `npx tsc --noEmit`: clean, no output, exit 0.
- `npx eslint .`: clean, no output, exit 0 (not required by the brief, run as an extra check).
- `git grep -il venturecite` on tracked files: only hit is `docs/plans/2026-07-28-geo-monitoring-mvp.md` line 13, which is the plan doc's own prose *stating* the constraint ("The string \"VentureCite\" must never appear anywhere...") — pre-existing from the `docs: add implementation plan` commit before this task started, not new content introduced by this task, and not used as a product name anywhere in code/UI. No occurrences in any file created or modified by Task 1.
- Manual grep for hardcoded model ID literals (`gpt-5.1`, `claude-sonnet-5`, `gemini-2.5-flash`, `sonar-pro`, `claude-haiku-4-5`) across `src/`: only appear in `src/lib/env.ts` as zod `.default(...)` values, as required.

## Concerns

- None blocking. The pre-existing `VentureCite` mention in `docs/plans/2026-07-28-geo-monitoring-mvp.md` is worth a human glance if the global constraint is meant to apply to docs prose too, but it long predates this task and describing the constraint in the plan seems intentional (it's literally defining the rule), not a violation of it.
- `AGENTS.md`/`CLAUDE.md` from the scaffold were discarded; if a later task or the user wants Next.js's bundled agent-guidance file, it can be regenerated or restored from the scaffold output.
