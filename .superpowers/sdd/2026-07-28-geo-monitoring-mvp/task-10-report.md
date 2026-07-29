# Task 10 Report: Auth + role-guarded routing

## What was done

1. **`tests/lib/authz.test.ts`** — written verbatim from the brief's Step 1 code block. Ran — confirmed FAIL (`Cannot find package '@/lib/auth'`), the expected TDD red state.
2. **`src/db/schema.ts`** — resolved the deferred Auth.js adapter-tables item:
   - Added `image: text("image")` to `users` (the only existing-table change; required because `@auth/drizzle-adapter`'s `DefaultPostgresUsersTable` type mandates an `image` column and TS structural typing rejected the table without it — matches the brief's carve-out for a "strictly required" column change).
   - Added `accounts`, `sessions`, `verification_tokens` tables mirroring `@auth/drizzle-adapter`'s documented `defineTables` Postgres shape (`lib/pg.ts`), with `userId` switched from the adapter's default `text` to `uuid` referencing our uuid-keyed `users.id` (`onDelete: "cascade"`), and `type: text("type").$type<AdapterAccountType>()` for fidelity to the documented shape.
   - Ran `npx drizzle-kit generate` → `drizzle/0001_fantastic_queen_noir.sql` (3 new tables, `users.image` column, 2 new FKs). Reviewed — matches schema.
3. **`src/lib/env.ts`** — added `EMAIL_FROM` (default `onboarding@resend.dev`), `OPERATOR_EMAIL` (default `operator@example.com`), `OPERATOR_PASSWORD` (default `change-me-dev-only`), all optional per the resolution. Mirrored into `.env.example`.
4. **`src/lib/auth.ts`**:
   - `canAccessPractice(user, practiceId)` — pure function, exact brief semantics.
   - `NextAuth(() => {...})` using the **lazy/function-config** form (confirmed via `node_modules/next-auth/index.js` that this defers `loadEnv()`/`getDb()` to request time, not module-import time — necessary since this repo has no `.env.local` and `npm run build` must succeed with zero env vars set).
   - Drizzle adapter wired with the four new tables; `session: { strategy: "jwt" }`; `trustHost: true`; `pages: { signIn: "/login" }`.
   - Providers: Resend (`apiKey`/`from` from env, magic links) and Credentials (checks `email === OPERATOR_EMAIL && password === OPERATOR_PASSWORD`, upserts/promotes the operator user row on first login, returns `role: "operator"`).
   - `jwt`/`session` callbacks embed `id` + `role` into the token/session; module augmentation on `next-auth`'s `Session` and `next-auth/jwt`'s `JWT`.
   - `requireOperator()` → `auth()`; `notFound()` unless `role === "operator"`; returns `session.user`.
   - `requirePracticeAccess(slug)` → loads practice by slug (`notFound()` if missing), allows operators unconditionally, else queries `practice_members` for a matching row (`notFound()` if absent); returns the practice row.
5. **`src/middleware.ts`** — deliberately does **not** import `@/lib/auth` (which pulls in the Drizzle adapter, Resend, Credentials). Uses `getToken` from `next-auth/jwt` directly (only needs `AUTH_SECRET`), redirects unauthenticated requests to `/login` (except `/login` itself and `/api/auth/*`, which is excluded via the matcher), and for `/admin/**` rewrites to a non-existent path when `token.role !== "operator"` so Next's normal not-found page renders — mirroring `requireOperator()`'s page-level `notFound()`.
6. **`src/app/login/page.tsx`** — two forms: client magic-link (`signIn("resend", ...)`, server action) and an operator email/password form tucked in a `<details>` disclosure (`signIn("credentials", ...)`, server action with `AuthError` → redirect-with-error handling). Heading reads `process.env.NEXT_PUBLIC_APP_NAME` directly (not `loadEnv()`, to avoid forcing the full required-env schema to be satisfied just to render a heading). Tailwind only, light/dark aware.
7. **`src/app/api/auth/[...nextauth]/route.ts`** — `export const { GET, POST } = handlers` from `@/lib/auth`.
8. **`src/app/layout.tsx`** — replaced the Create-Next-App boilerplate metadata with `"Mirror — See what AI tells your patients"` + a real description.
9. **`vitest.config.ts`** — added `test.server.deps.inline: ["next-auth", "@auth/core", "@auth/drizzle-adapter"]`. Needed because `next-auth` is pure ESM and does bare imports like `import { NextRequest } from "next/server"`; `next` (16.2.12) has no `package.json` `"exports"` map, so Node's native ESM resolver (which Vitest uses for externalized `node_modules` deps) can't resolve the extensionless subpath and throws `Cannot find module '.../next/server'`. Verified this is a genuine Node ESM behavior (reproduced with plain `node -e "import('next/server')"`, independent of Vitest), not a bug in our code. Inlining forces Vite's own (bundler-style) resolver to handle it, matching how `next build`'s Webpack/Turbopack resolver already handles it fine.
10. **`README.md`** — added a Security section documenting the plaintext `OPERATOR_PASSWORD` env-var tradeoff for MVP and what to harden before adding a second operator.
11. Ran the authz test — confirmed PASS. Ran `npm run test` (full suite) — PASS. Ran `npx tsc --noEmit` — clean. Ran `npx next build` (after `rm -rf .next`, with **zero** env vars set in the shell) — succeeded.
12. One commit: `feat: auth with operator and client roles`.

## Deviations from the brief and why

- Brief's Interfaces note says `requirePracticeAccess` "returns the practice row if the user is operator OR a `practice_members` row links them; otherwise `notFound()`" — implemented exactly, plus a `notFound()` guard for the no-session case (defense in depth; middleware should already have redirected unauthenticated requests before any dashboard page renders, but the helper doesn't assume that).
- Brief's controller resolution allowed `getToken`-based middleware "dependency-light" as an explicit option; used it instead of `export { auth as middleware }` to keep the Drizzle adapter and provider SDKs (Resend, DB driver) out of the edge bundle entirely.
- Next.js 16.2.12 prints a deprecation notice at build time: `The "middleware" file convention is deprecated. Please use "proxy" instead.` The brief's file list explicitly specifies `src/middleware.ts`, so kept that filename; the warning is non-fatal (build output still shows `ƒ Proxy (Middleware)` registered correctly). Flagging for a future cleanup task if the team wants to adopt the new `proxy.ts` convention.
- `users.image` column added — the one "strictly required" existing-table change the brief pre-authorized; everything else about `users` is unchanged.

## Test commands run and output summary

- `npx vitest run tests/lib/authz.test.ts` (before `src/lib/auth.ts` existed): **FAIL** — `Cannot find package '@/lib/auth'` (expected red state).
- `npx vitest run tests/lib/authz.test.ts` (after implementation): **2 passed**.
- `npx vitest run` (full suite): **10 files / 46 tests passed**, including the PGlite `pushSchema` tests exercising the new `accounts`/`sessions`/`verification_tokens` tables and `users.image`.
- `npx tsc --noEmit`: clean, exit 0.
- `npx eslint` on all new/changed files: 0 errors, 0 warnings.
- `rm -rf .next && npx next build` with no env vars set in the shell: succeeded — `/`, `/_not-found` static; `/api/auth/[...nextauth]`, `/login` dynamic; middleware/proxy registered.
- `npx drizzle-kit generate`: 1 new migration (`0001_fantastic_queen_noir.sql`), reviewed manually — 3 `CREATE TABLE`, 1 `ALTER TABLE ... ADD COLUMN "image"`, 2 FK constraints.

## Concerns

- **No automated end-to-end auth test**, per the task's own scope note — Auth.js needs a running server and real Resend delivery for the magic-link path, and the Credentials/operator path needs a live DB. Manual walkthrough (`npm run dev`, log in as operator, visit `/admin`; confirm a client session gets a 404 on `/admin`) is deferred to Task 15's checklist as instructed.
- The Credentials provider's operator upsert runs on every login attempt with matching env credentials (select-then-insert-or-promote). Fine for a single operator account at MVP scale; if operator accounts are ever created via a different path, revisit for a race condition on concurrent first-logins (negligible risk for a single hardcoded operator).
- Plaintext `OPERATOR_PASSWORD` comparison is intentional per the resolution and documented in the new README Security section — flagged there as needing hashing before any second operator or self-serve operator signup is added.
- Middleware's `/admin` rewrite-to-nonexistent-path trick depends on no route ever matching `/__not_found__`; low risk but worth a comment if the routing table changes.
