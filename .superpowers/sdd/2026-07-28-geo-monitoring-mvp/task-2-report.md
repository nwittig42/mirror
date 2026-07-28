# Task 2 Report: Domain types + Drizzle schema

## What was done

1. **`tests/db/schema.test.ts`** — written verbatim from the brief's Step 1 code block (PGlite round-trip test using `drizzle-kit/api`'s `pushSchema`/`apply` to push DDL, then inserting a practice → fact → prompt → scan → check and asserting on the returned rows).
2. **Ran the test — confirmed FAIL**: `Cannot find package '@/db/schema'` (module not yet created), matching the expected TDD red state.
3. **`src/core/types.ts`** — written verbatim from the brief's Interfaces block: `Engine`, `ENGINES`, `PromptKind`, `Position`, `Severity`, `FindingStatus`, `EngineAnswer`, `CheckResult`. No `any`.
4. **`src/db/schema.ts`** — written verbatim from the brief's Step 3 code block: 8 pgEnums (`role`, `fact_category`, `prompt_kind`, `engine`, `position`, `severity`, `finding_status`, `scan_status`) and 11 tables (`users`, `practices`, `practice_members`, `name_variations`, `competitors`, `facts`, `prompts`, `scans`, `checks`, `findings`, `activities`), all using `practices`/`practiceId` ICP vocabulary as given.
5. **`src/db/index.ts`** — implemented per the resolved ambiguity: `getDb()` builds a `drizzle-orm/neon-http` client from `loadEnv().DATABASE_URL` with `{ schema }` passed so `db.query.*` is available; module-level `let override: Db | undefined` plus `setDbForTests(db)` to set it; `getDb()` returns the override if set, otherwise builds the real Neon client. `export type Db = PgDatabase<PgQueryResultHKT, typeof schema>` (from `drizzle-orm/pg-core`) — the shared base class both `NeonHttpDatabase` and `PgliteDatabase` extend. Verified `ReturnType<typeof drizzle<typeof schema>>` from either driver does **not** work: it's a concrete subtype fixed to that driver's query-result HKT, so a PGlite instance is not assignable to a Neon-typed `Db` (confirmed by a throwaway typecheck: `PgliteDatabase<...>` is "missing $withAuth, batch" when checked against `NeonHttpDatabase<...>`). Typing `Db` off the shared `PgDatabase` base class is what lets `setDbForTests` accept either driver's instance with no cast. Documented inline in the file.
6. **`drizzle.config.ts`** — `schema: "./src/db/schema.ts"`, `out: "./drizzle"`, `dialect: "postgresql"`, `dbCredentials.url: process.env.DATABASE_URL ?? "postgres://user:password@localhost:5432/mirror"` (fallback so `drizzle-kit generate` works with no `.env` loaded, per the resolution).
7. **Ran the test — confirmed PASS.**
8. **`npx drizzle-kit generate`** — produced `drizzle/0000_white_lady_deathstrike.sql` (8 `CREATE TYPE`, 11 `CREATE TABLE`, 13 `ALTER TABLE ... ADD CONSTRAINT` for FKs) plus `drizzle/meta/_journal.json` and `drizzle/meta/0000_snapshot.json`. Reviewed the SQL — matches the schema, uses `practice_id` snake_case columns throughout, no stray content.
9. Two commits: `feat: domain types and database schema` (types, schema, db client, drizzle config, test, generated migration) and this report as a follow-up doc commit (`.superpowers/` is gitignored, added with `git add -f` per Task 1's precedent).

## `pushSchema` resolution

The brief's exact import — `const { pushSchema } = await import("drizzle-kit/api")` — worked as-is against the installed `drizzle-kit@0.31.10` / `drizzle-orm@0.45.2`. Verified `node_modules/drizzle-kit/api.d.ts` exports `pushSchema(imports, drizzleInstance, ...)` matching the brief's call signature and return shape (`{ apply }`). No fallback (DDL-file execution or hand-written `CREATE TABLE`) was needed — option (a) from the resolution list applied cleanly. The test helper (`testDb()` inside `tests/db/schema.test.ts`) is a small, self-contained function; later tasks can lift it into a shared `tests/helpers/db.ts` if reused verbatim, but the brief only asked for it inline in this test file so it was left there.

## Deviations from the brief and why

- None in the transcribed code (`src/core/types.ts`, `src/db/schema.ts`, `tests/db/schema.test.ts` are byte-for-byte from the brief).
- `src/db/index.ts` and `drizzle.config.ts` were not given literal code in the brief (only described in prose/resolutions), so they were written fresh following the resolution's exact mechanism (module-level `override`, `setDbForTests`, `getDb()` fallback) and the `{ schema }` / Neon-HTTP / fallback-URL requirements.
- The brief's "Produces tables" line mentions "+ Auth.js tables via adapter" but the literal Step 3 code block does not include `accounts`/`sessions`/`verification_token` tables. Followed the literal code block (transcribe faithfully) rather than adding undocumented tables; Auth.js adapter tables are presumably a later task's concern (NextAuth setup) since `@auth/drizzle-adapter` is already a dependency but not yet wired to this schema.
- The test file's unused `import { sql } from "drizzle-orm"` (present verbatim in the brief) produces one ESLint warning (`no-unused-vars`), 0 errors. Left as-is since the instruction was to transcribe the test exactly.

## Test commands run and output summary

- `npm run test -- tests/db/schema.test.ts` (before implementing schema): **FAIL** — `Cannot find package '@/db/schema'` (expected red state).
- `npm run test -- tests/db/schema.test.ts` (after implementing schema/types/db/config): **1 passed**.
- `npm run test` (full suite, final): **2 test files, 3 tests passed** (env.test.ts's 2 + schema.test.ts's 1).
- `npx tsc --noEmit`: clean, no output, exit 0.
- `npm run lint`: 0 errors, 1 warning (`sql` unused in the brief's verbatim test snippet, see above).
- `npx drizzle-kit generate`: succeeded, 11 tables / 13 FKs reported, migration file reviewed manually.
- `grep -ril "venturecite" .` (case-insensitive, ts/tsx): no hits in this task's files.

## Concerns

- None blocking. The Auth.js adapter tables gap noted above is worth confirming against whichever later task wires up `next-auth` — if that task expects `users`/`accounts`/`sessions` tables shaped exactly per `@auth/drizzle-adapter`'s `PgTable` schema helper, the current hand-rolled `users` table (with an added `role` enum and no `accounts`/`sessions`/`verification_token` tables) will need reconciling then. Flagging now so it isn't a surprise.
- None outstanding on the `Db` type — verified directly (see above) that both `NeonHttpDatabase<typeof schema>` (production) and `PgliteDatabase<typeof schema>` (tests) are assignable to `PgDatabase<PgQueryResultHKT, typeof schema>` with `db.query.*` still available, so later tasks' `setDbForTests(pgliteDb)` calls should type-check with no cast.
