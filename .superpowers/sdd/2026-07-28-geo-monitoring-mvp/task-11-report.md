# Task 11 Report: Admin UI (practices, facts, prompts, scan trigger, findings triage)

## What was done

1. **`tests/app/admin-actions.test.ts`** (TDD Step 1) — covers `addFact` (inserts an active, practice-scoped fact row) and `updateFindingStatus` (sets `resolvedAt` + writes a `Fixed:`/`Dismissed:` activity on fixed/dismissed/verified; clears `resolvedAt` on reopen). Mocks `@/lib/auth`'s `requireOperator` to a no-op fake-operator session (documented inline — there's no real session outside a request). Also mocks `next/cache`'s `revalidatePath`, discovered necessary because it throws `Invariant: static generation store missing` when called outside a real Next.js request/render scope — verified this independently with a throwaway test before writing the real suite. Ran — confirmed FAIL (`Cannot find package '@/app/admin/actions'`), expected red state.
2. **`src/app/admin/actions.ts`** — all 10 server actions from the interface, each `"use server"`, each calling `requireOperator()` first, each using `getDb()`, each calling `revalidatePath` for its affected admin page:
   - `createPractice`, `addFact`, `archiveFact`, `addCompetitor`, `addNameVariation` — straightforward inserts/updates.
   - `addPrompt` — enforces the 10-active-prompt cap (`throw new Error("Deactivate a prompt first")` at ≥10 active); `togglePrompt` flips `active` (no cap check on reactivation, per brief scope — only `addPrompt` enforces it).
   - `inviteClient` — creates a `role: "client"` user if the email hasn't been seen, links via `practice_members` with `.onConflictDoNothing()`; does **not** send a magic link (Resend sends one automatically on the client's next `/login` sign-in, per brief).
   - `triggerScan` — fires `runScan(db, practiceId, getAdapters(), judgeAnswer)` as a detached (`void`) promise with `.catch` logging `scan failed: <msg>` as an activity; the action itself returns immediately after calling `revalidatePath`.
   - `updateFindingStatus` — sets/clears `resolvedAt` based on membership in `["fixed","verified","dismissed"]`; logs `Fixed:`/`Verified:`/`Dismissed: <claim>` on resolution; no activity written on reopen (no spec'd message for it).
3. **`src/app/admin/page.tsx`** — practice list (name/slug/website/status) + `createPractice` form.
4. **`src/app/admin/practices/[id]/page.tsx`** — sections in brief order: Fact Sheet (category-grouped table, add form, per-row Archive), Prompts (active/10 cap note, add form, per-row Activate/Deactivate), Competitors (add + pill list), Name variations (add + pill list), Run scan now (redirects to `?scanStarted=1`, which renders "Scan started; refresh in ~2 min"), Open findings (table with a per-row status `<select>` + Update button wired to `updateFindingStatus`), plus an Invite client section (email → `inviteClient`) and Recent activity (last 20, newest first) — both required by the action interface but not explicitly ordered in the brief's section list. Both pages call `requireOperator()` first; header uses `NEXT_PUBLIC_APP_NAME` (falls back to "Mirror"), same pattern as the existing `/login` page. Plain Tailwind tables, no component library. Form-to-action wiring uses small local `"use server"` FormData-parsing wrappers per Next.js's documented `action={fn.bind(null, id)}` pattern, since the typed actions in `actions.ts` (e.g. `addFact(practiceId, {category,label,value})`) aren't themselves valid raw `<form action>` signatures.
5. `src/db/index.ts` already exported `setDbForTests` (a prior task added it) — no change needed there.
6. One commit: `feat: admin practice management and scan trigger` (`2a77a8e`).

## Verification

- `npx vitest run tests/app/` — before implementation: FAIL as expected; after: **1 file / 4 tests passed**.
- `npm run test` (full suite): **11 files / 53 tests passed**.
- `npx tsc --noEmit`: clean.
- `npm run build` (with dummy required env vars): succeeded — `/admin` and `/admin/practices/[id]` both render as dynamic (`ƒ`) routes. One pre-existing, unrelated warning (`middleware` → `proxy` convention deprecation, flagged in the Task 10 report) — not touched here.

## Concerns

- `addPrompt`'s cap violation throws a raw `Error`, which will surface as Next's default server-action error UI (no inline form message) — matches the brief's literal spec ("throw Error(...)") but isn't a polished UX; flagging in case a later task wants a friendlier inline error.
- No end-to-end manual walkthrough against a real Postgres + live engine keys was performed in this session (brief's Step 4 "trigger scan with real keys, inspect via `drizzle-kit studio`") — out of scope for an automated implementation pass; recommend as a manual QA step before this ships.
- Fact-sheet "add" and "archive" are both present, but there's no edit-in-place for an existing fact's value — matches the brief (`addFact`/`archiveFact` only, no `updateFact`), noting in case product wants correction-without-archive later.
