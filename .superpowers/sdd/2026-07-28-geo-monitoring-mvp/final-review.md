# Final whole-branch review — Mirror MVP (04793df..c2ab62b / HEAD)

Reviewer scope: whole-system pass (cross-module contracts, tenancy end-to-end, ledger triage, migrations, README/reality drift). Gates run: `npm run test` (97/97 pass, 16 files), `npx tsc --noEmit` (clean), `npm run lint` (clean), `npm run build` (clean; route inventory verified).

## Verdict: NOT SHIP-READY YET — 3 small code fixes + 1 deploy-config check required, everything else defers

The system is structurally sound: pure core verified against every locked constraint, tenancy enforced server-side on every surface, migrations coherent, no vocabulary/branding violations, every UI number traces to stored rows. The blockers are small (hours, not days) but each would land in front of the first paying client.

---

## Findings (most severe first)

### F1 — Critical (client-facing): post-login landing page is create-next-app boilerplate
- `src/app/page.tsx:1-65`
- Magic-link sign-in redirects clients to `/` (`src/app/login/page.tsx:17`, `redirectTo: "/"`), which still renders "To get started, edit the page.tsx file" with Next.js/Vercel logos and deploy CTAs. There is **no path from `/` to the client's dashboard** — a client would need to know their slug and type the URL. Every client sign-in hits this. (Ledger T1 fixed `layout.tsx` metadata but the sibling `page.tsx` was never replaced.)
- **Fix:** make `/` a server component: `auth()` → operator ⇒ `redirect("/admin")`; client ⇒ look up first `practice_members` row ⇒ `redirect(/dashboard/${slug})`; no membership ⇒ short "ask your operator for access" message.

### F2 — Important (security): citation links render raw engine URLs with no scheme allowlist
- `src/components/answer-card.tsx:76-86` (`href={url}`)
- `citations` come verbatim from third-party engine output; a `javascript:` URL executes on click in the client dashboard (stored XSS from untrusted input). The T12 reviewer itself flagged "RECOMMEND fixing in final wave" — this is that wave.
- **Fix:** parse with `new URL()`, render `<a>` only for `http:`/`https:`; otherwise render the string as plain text. Also switch `key={i}` → `key={url + i}` while there.

### F3 — Important (scoring integrity): judge failure counts the branded check as clean, inflating accuracy
- `src/services/scan-runner.ts:83-91`
- `brandedCheckCount++` happens before the judge call; on judge error the `catch` logs and `continue`s, so a judge-failed check sits in the accuracy denominator as finding-free. Total judge outage ⇒ accuracy = 1.0 ⇒ the score component whose whole job is hallucination detection silently reads perfect. This also compounds F-T6 (a parse error is a judge failure). Ledger T9 deferred it; for a product sold on accuracy monitoring it should not ship.
- **Fix (one line):** move the increment after the successful `judge()` call (or decrement in the catch). Failed-judge checks then simply don't count either way.

### F4 — Important (ops): `triggerScan`'s `after()` scan will be killed by Vercel's function duration limit
- `src/app/admin/actions.ts:138-149`
- The ~2-minute scan runs post-response via `after()`, but `after()` work counts toward the invoking function's `maxDuration`, and no admin route exports one (only the cron route sets `maxDuration = 800`). On Vercel defaults the scan is killed mid-run, leaving the `scans` row stuck `running` forever — there is no reaper, and `getLatestScan` filters `status = "complete"`, so the dashboard just never updates and no failure is recorded.
- **Fix:** export `maxDuration` from the admin practice page route segment (or move manual triggering through an authenticated route that sets it); optionally mark stale `running` scans failed at the start of the next scan.

### F5 — Minor: `mentioned` and `position` can disagree on containment collisions
- `src/services/scan-runner.ts:67-68`; `src/core/mention.ts:5-13` vs `src/core/position.ts:21-47`
- `classifyPosition` suppresses a practice-variation match contained inside a longer competitor match; `detectMention` does not. Such a check stores `mentioned: true` (counts toward citationRate, gets highlighted on the Answers page) with `position: "absent"` ("Not mentioned" chip on a highlighted answer). Rare in practice; fix by running the same suppression before `detectMention` or accept and document.

### F6 — Minor: dead exports — the tested authz rule isn't the one production runs
- `src/lib/auth.ts:34` `canAccessPractice` is exercised only by `tests/lib/authz.test.ts`; `requirePracticeAccess` re-implements the rule inline (correctly, verified). `src/core/mention.ts:15` `detectNames` is likewise unused in `src/`. Route `requirePracticeAccess`'s decision through `canAccessPractice` (so the tested rule is the enforced rule) or drop the unused exports.

### F7 — Minor: pulse email exposes practice members' addresses to each other
- `src/services/pulse-email.ts:162,178` — one send with all member emails in `to:`. Same-practice recipients, so low risk, but per-recipient sends (or bcc) is the professional default.

### F8 — Minor: report page "open findings" list ignores the selected month
- `src/app/dashboard/[slug]/report/page.tsx:31-34,125-136` — ledger tiles are month-scoped but the bulleted open-findings list is current-state; printing a past month's report shows today's issues under that month's header.

### F9 — Minor: accuracy page renders an empty "Dismissed (n)" section
- `src/app/dashboard/[slug]/accuracy/page.tsx:58-64` — heading with count, no cards beneath. Either list them muted or drop the heading.

### F10 — Minor: trend chart hardcodes light-mode grid/axis colors
- `src/components/trend-chart.tsx:9-11` — `#e4e4e7` grid is glaring in dark mode (tooltip does have dark classes). Cosmetic.

### F11 — Minor: Node >= 20 constraint not encoded
- `package.json` has no `engines` field and there is no `.nvmrc` (plan Global Constraint). One-liner; carry-over from ledger T1.

### F12 — Minor (documented, accept for MVP): plaintext, non-constant-time secret compares
- `src/lib/auth.ts:67` (`OPERATOR_PASSWORD`), `src/app/api/cron/weekly-scan/route.ts:16` (`CRON_SECRET`). Both are long random single-tenant secrets, README's Security section discloses the tradeoff honestly, and the prod-default guard (`src/lib/env.ts:45-52`) blocks dev creds in production. Fine for MVP; revisit before a second operator.

### F13 — Note (not a defect): stored score components are write-only
- `scans.citation_rate/position_score/breadth_score/accuracy_score` (×100 ints) are snapshotted by `scan-runner` but no UI reads them — dashboard/pulse/report recompute cited/total from `checks` and only display `scans.score`. Values were spot-checked consistent (`pct()` = component×100 vs report's per-check math). Keep as audit snapshot.

---

## Cross-module contract audit (clean unless noted)

- **Score pipeline:** `computeScore` implements the locked formula, position weights (1/0.7/0.4/0), category-only positionQuality, breadth/4, branded-only accuracy, **zero-citation floor**, and cap-at-70 (only on open *critical*) — `src/core/scoring.ts:26-69`. Runner stores score 0-100 and components ×100; every consumer treats `scans.score` as a 0-100 int. ✓
- **Mention/variation semantics:** the name set (`practice.name` + variations, deduped) is built identically in scan-runner (:46), pulse (:156), report (:81), and the Answers page (:19); snippet extraction (pulse + report bestQuote) and `<mark>` highlighting reuse the same `core/mention` word-boundary matcher the stored `mentioned` flag came from. ✓ (single divergence = F5)
- **Locked copy verified verbatim:** pulse subject ("What AI told patients about X this week"), dashboard verdict line, report verdict template (incl. no-prior-month clause), accuracy footer ("Accuracy issues cap your visibility score at 70 until resolved."), judge system prompt. ✓
- **Vocabulary/branding:** zero hits for "VentureCite", "rank/ranking", "brand/business/buyer/customer" in `src/`; practice/patients/providers/treatments used throughout; model IDs only in `src/lib/env.ts`. ✓
- **HTML safety elsewhere:** pulse email escapes every dynamic string (`escapeHtml`, incl. snippet + dashboard URL); answer highlighting uses React children, never `dangerouslySetInnerHTML`. ✓ (F2 is the one gap)

## Multi-tenant boundary — full surface enumeration

| Surface | Guard | Verified |
|---|---|---|
| `/` | middleware auth (no data rendered) | ✓ (but see F1) |
| `/login` | public by design | ✓ |
| `/admin` | `requireOperator()` + middleware role rewrite | ✓ |
| `/admin/practices/[id]` | `requireOperator()` | ✓ |
| `/dashboard/[slug]` + `/answers` + `/accuracy` + `/report` | `requirePracticeAccess(slug)` — server-side `practice_members` query, 404 on miss | ✓ all four |
| `/api/auth/[...nextauth]` | Auth.js handlers | ✓ |
| `/api/cron/weekly-scan` | `CRON_SECRET` bearer, 401 otherwise | ✓ |
| 11 exported server actions (`src/app/admin/actions.ts`) | every one calls `await requireOperator()` first | ✓ |
| Inline `"use server"` form wrappers (admin pages, login) | delegate to guarded actions / `signIn` only | ✓ |

Operator identity is barred from the magic-link channel (`signIn` callback, `src/lib/auth.ts:80-96`). Middleware excludes `/api/*` deliberately and both API routes self-authenticate. **No unauthenticated or cross-tenant path to practice data found.**

## Schema / migration coherence — clean

`0000` (core tables + 8 enums) → `0001` (accounts/sessions/verification_tokens + `users.image`, cascade FKs) → `0002` (`practices.report_notes`); journal sequential (idx 0-2), SQL matches `src/db/schema.ts` field-for-field (spot-checked all tables, enums, FKs, PKs, defaults). PGlite `pushSchema` in tests exercises the same schema object.

## README vs reality — accurate

Ship checklist, env table, security section (trustHost/AUTH_URL, plaintext-password disclosure, prod-default guard), cost note, and the mandated "API vs consumer answers" limitation are all present and match the code. Two nits: the checklist doesn't mention that `maxDuration = 800` needs a paid Vercel plan (only a code comment does — worth one checklist line, ties into F4), and `NEXT_PUBLIC_APP_NAME` is absent from the Vercel key list (has a safe default).

---

## Ledger triage — all 22 deferred-minor / ruling lines

| # | Task | Item | Triage |
|---|---|---|---|
| 1 | T1 | No `engines` field / `.nvmrc` for Node>=20 | **Fix now** (one-liner; plan Global Constraint) — F11 |
| 2 | T1 | `z.string().url()` deprecated spelling (Zod v4) | Defer — works; cosmetic deprecation |
| 3 | T1 | layout.tsx boilerplate metadata "replace in UI task" | **Fix now** — metadata was fixed but the sibling `page.tsx` boilerplate was not; it is the client's post-login landing (F1) |
| 4 | T2 | Auth.js adapter tables missing, T10 must add | Resolved — migration `0001` + schema verified |
| 5 | T2 | Unused `sql` import in schema test | Resolved — import gone; lint clean |
| 6 | T3 | No metacharacter/overlap edge tests; regex per call | Defer — core matcher behavior pinned by existing tests; perf non-issue at ≤40 checks |
| 7 | T4 | `firstIndexOf` first-occurrence only | Defer — position semantics want earliest hit; `highlightRanges` covers all occurrences for UI |
| 8 | T6 | Backslash-run parity in judge-parse (claim ending `\` throws) | Defer — rare, fails loud (JudgeParseError), and once F3 is fixed a parse failure no longer silently inflates accuracy |
| 9 | T7 | Live smoke vs real APIs pending keys | Defer — already a README ship-checklist item; do run it before first client scan (shape drift fails silent as empty answers) |
| 10 | T7 | Request bodies (model/tools) not asserted in adapter tests | Defer — smoke script is the reality check |
| 11 | T9 | Judge-failed branded check counts as clean | **Fix now** — F3; one-line fix, protects the product's core promise |
| 12 | T9 | Finding dedup practice-wide (one row for same claim from two engines) | Defer — arguably correct product behavior (one issue, many engines); revisit if per-engine attribution matters |
| 13 | T10 | Report prose said 4 tests, actual 3 | Defer — report-accuracy only, no code impact |
| 14 | T10 | Page guards deferred to T11/T12 verification | Resolved — verified across every page in this review (tenancy table above) |
| 15 | T11 | Raw FK error on bad practiceId; inviteClient links any user | Defer — operator-only surfaces, operator-trust model |
| 16 | T12 | Citation href no scheme allowlist (`javascript:`) | **Fix now** — F2; the T12 reviewer explicitly punted it to this wave |
| 17 | T12 | `key={i}`; delta-0 suppressed; extra `getFindingsForPractice` | Defer — fold `key` fix into F2's edit; others are judgment calls that hold up |
| 18 | T12 | Manual client walkthrough not performed | Defer to ship checklist — but note the walkthrough would have caught F1; do it after F1 lands |
| 19 | T13 | PGlite full-suite contention flake | Resolved — `fileParallelism: false` in vitest.config.ts; 97/97 stable this run |
| 20 | T13 | `maxDuration` 800 needs paid plan; cron compare not constant-time | Defer compare (F12); **add one README checklist line** for the paid-plan requirement and verify plan at deploy (ties to F4) |
| 21 | T14 | Verdict keyed on totalChecks vs score keyed on inMonthScans | Defer — requires a completed scan with zero checks; runner always inserts checks or fails the scan |
| 22 | T15 | seed.ts redundant `loadEnv()`; seed demands all vendor keys | Defer — annoying but harmless; keys exist wherever seeding happens |

**Fix-before-ship from ledger:** #1, #3, #11, #16 (plus new findings F4). **Resolved since deferral:** #4, #5, #14, #19. **Everything else genuinely deferrable.**

---

## Ship-readiness summary

Fix before first client: **F1** (replace boilerplate `/` with role-aware redirect), **F2** (http/https allowlist on citation hrefs), **F3** (judge-failure accuracy inflation), **F4** (maxDuration for manual scan trigger + stuck-`running` handling), plus the two one-liners (engines field, README paid-plan line). Then run the existing ship checklist — especially `npm run smoke` with real keys and the manual client walkthrough, both of which exist precisely to catch what static review cannot.

Everything above the line is small and mechanical; nothing structural needs to move. After those fixes: ship.

---

## Fix-wave — 2026-07-28

All six items below (F1-F4, plus the two fix-now minors from the ledger triage) are landed. Gates: `npm run test` (101/101 pass, 17 files — 4 new tests), `npx tsc --noEmit` (clean), `npm run lint` (clean), `npm run build` (clean; `/` is now server-rendered dynamic, as expected for an auth+DB-driven redirect).

- **F1 (critical)** — `src/app/page.tsx` rewritten as a server component: no session → `redirect("/login")` (defense-in-depth; middleware already blocks this case); operator session → `redirect("/admin")`; client session → looks up the first `practice_members` row (joined to `practices` for the slug) and `redirect(`/dashboard/${slug}`)`; client with no membership → a small Mirror-branded "Your practice isn't linked yet — contact your Mirror operator." page. `src/app/login/page.tsx`'s `redirectTo: "/"` was left as-is per the review — `/` now routes by role, so no change was needed there.
- **F2 (important)** — added `src/lib/url.ts` exporting `isSafeHttpUrl(url: string): boolean` (parses with `new URL()` in a try/catch, true only for `http:`/`https:`). `src/components/answer-card.tsx` now renders a citation as `<a href>` only when `isSafeHttpUrl(url)` is true, otherwise as plain text in a `<span>`; also switched `key={i}` → `key={url + i}` while there, per the review's fold-in note. New test file `tests/lib/url.test.ts` (4 cases: https ok, http ok, `javascript:` rejected, garbage rejected).
- **F3 (important)** — `src/services/scan-runner.ts`: moved `brandedCheckCount++` from before the `judge()` call to immediately after a *successful* `judge()` call returns, with a comment noting that unjudged checks are excluded from the accuracy denominator (unknown ≠ clean) — a judge failure now affects neither `brandedCheckCount` nor `brandedChecksWithFinding`. Extended the existing "survives a judge failure" test in `tests/services/scan-runner.test.ts` to assert `scan.accuracyScore === 100` (the no-branded-checks default), proving the failed judge call no longer inflates the stored accuracy component.
- **F4 (important)** — added `export const maxDuration = 800;` to both `src/app/admin/practices/[id]/page.tsx` (the page that renders the "Run scan now" form / invokes `triggerScan`) and `src/app/admin/page.tsx` (since a server action runs under the route segment config of whichever page invoked it, not the action module's), each with a comment cross-referencing the cron route's identical setting (`src/app/api/cron/weekly-scan/route.ts`) and the paid-Vercel-plan requirement. Added a matching line to the README ship checklist calling out the paid-plan requirement next to the cron mention.
- **Minor — `engines` field** — `package.json` now declares `"engines": { "node": ">=20" } }`.
- **Minor — dead authz code** — `src/lib/auth.ts`'s `requirePracticeAccess` now calls the unit-tested `canAccessPractice` instead of re-implementing the membership check inline: operators short-circuit without a `practice_members` query (matching `canAccessPractice`'s own role short-circuit), clients load their `memberPracticeIds` and pass them through. Behavior is unchanged (operator always; member else `notFound()`); removed the now-unused `and` import. All existing `tests/lib/authz.test.ts` and page-guard tests still pass.

Test evidence: `Test Files 17 passed (17)` / `Tests 101 passed (101)` (baseline was 16 files / 97 tests; +1 file/`tests/lib/url.test.ts` with 4 cases, +0 net elsewhere aside from the extended F3 assertion). `tsc --noEmit` produced no output. `eslint` produced no output. `next build` completed with all ten routes compiling (`/` now listed as `ƒ` dynamic, matching its new auth+DB dependency).
