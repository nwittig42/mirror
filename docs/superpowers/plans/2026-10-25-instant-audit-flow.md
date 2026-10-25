# Instant Audit Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pasting a website starts the audit at once and lands on an audit page that shows progress on the left and a details form on the right. That leads to a thank-you plus Calendly, then on-page results that are partly blurred behind account creation, and an emailed set-up link instead of a temporary password.

**Architecture:** A lead row now exists before its contact details do. The audit page `/audit/[leadId]` polls a JSON progress route. Setup and scan reuse `prepareProspect` and the scan chain unchanged in shape. Contact details attach to the lead later. A new `account_invites` table backs one-time set-up links, and `/welcome` redeems them.

**Tech Stack:** Next.js 16 (app router, server actions, `after()`), Drizzle + Neon (PGlite in tests), NextAuth v5 credentials, Vitest, Tailwind + `src/app/landing.css` (`mk-*` classes).

**Spec:** `docs/superpowers/specs/2026-10-25-instant-audit-flow-design.md`

## Global Constraints

- Vercel Hobby: `maxDuration = 300` on any page or route that starts setup in `after()`.
- Shared Neon DB between local and prod. Schema changes may only add tables or columns, or drop NOT NULL. Apply them with `npm run db:push`.
- Copy: plain, short, for business owners. The engine list is "ChatGPT, Claude, Gemini, Grok and Perplexity". The time estimate is "5-7 minutes".
- Limits stay: `DAILY_SETUP_CAP = 20`, and one automatic audit per website per 24h (`shouldPrepareLead`).
- Server-action files export only async functions; their types are type-only exports.
- Public paths are added to `PUBLIC_PATHS` in `src/middleware.ts`. `/api/*` is already outside the matcher.
- Nothing real goes into the blurred section's DOM. It is placeholder content.
- Tests: `npm test -- <path>`. The full suite is `npm test` and takes about 4 minutes. Run it in the background with output to a file.

## Review Focus

1. Someone opens `/audit/<random uuid>` that isn't a lead → 404, not a crash.
2. The details form is submitted twice, or after the audit finished → the report email goes out exactly once (guard on `auditEmailedAt`).
3. An email that already has a password tries to create an account on the audit page → refused with "log in instead". The existing password is never overwritten.
4. A set-up link is used twice, or after 14 days → second use refused. The token is stored hashed, never plain.
5. A no-website lead with no type or city → the form refuses it (both are required on that path), so setup never parks silently.

---

### Task 1: Schema and lead service

**Files:**
- Modify: `src/db/schema.ts` (leads, scans, new `accountInvites`)
- Modify: `src/services/leads.ts`
- Test: `tests/services/leads.test.ts`, `tests/db/schema.test.ts` if it lists tables

**Interfaces — Produces:**
- `leads.practiceName`, `leads.websiteUrl`, `leads.contactName` and `leads.email` become nullable.
- New `leads.nameFromSite boolean not null default false`: true when the name is still a guess from the website.
- `scans.totalTasks integer` (nullable).
- `accountInvites` table: `id uuid pk`, `tokenHash text unique not null`, `email text not null`, `practiceId uuid fk practices not null`, `expiresAt timestamp not null`, `usedAt timestamp`, `createdAt`.
- `startLead(db, input: { websiteUrl: string } | { practiceName: string; category: string; location: string }): Promise<{ id: string }>`. For the website case it inserts `websiteUrl`, `practiceName: null` and `nameFromSite: true`. For the other case it inserts the name, category and location, with `websiteUrl: null`.
- `attachContact(db, leadId, details: LeadDetails): Promise<Lead | null>`. Returns null for an unknown lead. Sets contactName, email (lowercased and trimmed), phone, bestTimes, plus category and location when given. When `practiceName` is given and differs, it also sets lead.practiceName and `nameFromSite: false`, and if the lead has a practice, renames the practice and inserts a `nameVariations` row for it.
- `type LeadDetails = { contactName: string; email: string; phone?: string; bestTimes?: string; practiceName?: string; category?: string; location?: string }`.
- `shouldPrepareLead` must treat a null `websiteUrl` as never matching another site.
- `saveLead` keeps working (admin and old tests use it).

- [ ] Write failing tests:
  - `startLead` saves a website-only lead with no contact.
  - `startLead` saves a no-website lead.
  - `attachContact` renames the practice and adds a name variation.
  - `attachContact` on an unknown id → null.
  - `shouldPrepareLead` lets two no-website leads through.
- [ ] Run them → FAIL. Implement. Run → PASS.
- [ ] `npm run db:push` (the shared DB; additive only). Commit.

### Task 2: Setup without a contact or a website

**Files:** Modify `src/services/prospect-setup.ts`, `src/services/scan-runner.ts` (write `totalTasks`). Test `tests/services/prospect-setup.test.ts`, `tests/services/scan-runner.test.ts`.

**Interfaces — Consumes:** Task 1 columns. **Produces:** `nameFromTitle(title: string | null, website: string): string`, exported from `prospect-setup.ts`.

`nameFromTitle` takes the first segment of the title split on ` | `, ` - `, ` – ` or ` — `, trimmed and 2–80 characters long. Otherwise it uses the domain without `www.` or the TLD, title-cased ("harborplumbing.com" → "Harborplumbing").

Behaviour:
- **Name from the website.** A lead with `websiteUrl` and a null `practiceName` inserts the practice under `nameFromTitle(null, website)`. After `fetchPages`, it renames the practice and lead to `nameFromTitle(pages[0]?.title, website)`. This happens only while `nameFromSite` is still true, re-read from the row, so a name typed meanwhile wins. The name variation row uses the final name.
- **No website.** A lead with no `websiteUrl` skips the logo, page fetch, fact drafting and question drafting, and uses `generateFallbackPrompts` with its category and location. It adds the note "No website, so there's no fact check."
- **No email at the end.** `finishProspect` with `lead.email` null marks the lead ready (or needs_attention, as now) and sends nothing.
- **Task count.** `gatherStep` writes `scans.totalTasks = tasks.length` when it is null.

- [ ] Failing tests:
  - Website lead named from the page title.
  - Typed name not overwritten.
  - No-website lead scanned on the standard questions.
  - Lead without email finishes ready with `sendAudit` not called.
  - `nameFromTitle` cases.
  - `totalTasks` set on the scan.
- [ ] FAIL → implement → PASS. Commit.

### Task 3: Set-up links and the report email

**Files:**
- Create `src/services/account-invites.ts`.
- Modify `src/services/prospect-audit-email.ts`.
- Test `tests/services/account-invites.test.ts`, `tests/services/prospect-audit-email.test.ts`.

**Interfaces — Produces:**
- `createInvite(db, practiceId, email): Promise<string>`: the raw token, 32 random bytes in base64url. Stores the sha256 hex and expires in 14 days.
- `redeemInvite(db, token, password): Promise<{ ok: true; email: string } | { ok: false; reason: "invalid" | "used" | "expired" | "has-account" | "weak" }>`. It checks `MIN_PASSWORD_LENGTH`. It creates the client user, or sets the password on an existing user with no `passwordHash`, using `mustChangePassword: false`. It links `practiceMembers` and stamps `usedAt`. A user who already has a password → `has-account`, and the token is not used.
- `createAccountFromAudit(db, practiceId, email, password)`: same result shape, without a token. It refuses an operator address or an existing password with `has-account`.
- In `sendProspectReportFor`, the login becomes `{ email, setupUrl: string | null, loginUrl }`. When the address already has a password, there is no invite and `setupUrl` is null, with a "Log in" link. Otherwise `setupUrl = ${APP_URL}/welcome?token=…`.
- The email block reads "Set up your account" plus a button. It no longer prints a temporary password.
- The send must also be skipped when `lead.auditEmailedAt` is set. Do this check in a new `sendReportOnce(db, leadId)` in `prospect-setup.ts`: it stamps `auditEmailedAt` first, compare-and-set on null, and returns false if another call already did.

- [ ] Failing tests:
  - Invite redeemed creates a user who can sign in (`authorizeCredentials`).
  - Second redeem → used.
  - Expired → expired.
  - Existing password → has-account, and the password is unchanged.
  - Token not stored plain.
  - Email html has the set-up link and no "Temporary password".
  - `sendReportOnce` twice → one send.
- [ ] FAIL → implement → PASS. Commit.

### Task 4: Actions and routes

**Files:**
- Create `src/app/audit/actions.ts`, `src/app/api/audit/[id]/route.ts`, `src/app/welcome/actions.ts`, `src/services/audit-progress.ts`.
- Modify `src/services/prospect-start.ts` if needed, and `src/middleware.ts`.
- Tests `tests/app/audit-actions.test.ts`, `tests/services/audit-progress.test.ts`.

**Interfaces — Produces:**
- `auditProgress(db, leadId): Promise<AuditProgress | null>` with
  `type AuditProgress = { stage: "reading" | "asking" | "writing" | "done" | "failed" | "not-started"; percent: number; answers: number; total: number | null; businessName: string | null; hasEmail: boolean; email: string | null }`.
  Rules:
  - not-started: needs_attention with no practice, i.e. the cap or a repeat.
  - reading: no practice, or no running/complete scan yet. 5–15%, rising with "practice exists" and "prompts exist".
  - asking: scan running and answers < total. 15 + 75 × answers/total.
  - writing: answers ≥ total and still running. 95.
  - done: lead ready, or latest scan complete. 100.
  - failed: latest scan failed or blocked, or the lead needs_attention with a practice.
- `GET /api/audit/[id]`: 404 for a non-UUID or unknown id. Otherwise JSON of `auditProgress` with `cache-control: no-store`.
- `startAudit(prev, formData)`: form fields `websiteUrl`, or `noWebsite=1` + `practiceName`, `category`, `location`. Validates with zod: reuse `withScheme` + `isSafeHttpUrl`, and on the no-website path all three are required. Then `startLead`. If `shouldPrepareLead`, call `startProspectSetup(id)`; else `markNotPrepared`. Then `redirect('/audit/' + id)`. Honeypot `fax` → redirect to `/book`. Returns `{ fieldErrors, values }` on bad input.
- `submitDetails(leadId, prev, formData)`: fields contactName, email, phone, practiceName, category, location. Validation reuses the `auditRequestSchema` field rules. It calls `attachContact`, then best-effort `sendAuditRequest` to the operator with the full data. If the lead is already ready and the scan completed, it calls `sendReportOnce`. Returns `{ status: "success", email }`.
- `createAccount(leadId, prev, formData)`: fields email (when the lead has none) and password. It requires the lead's practice to have a complete scan. On has-account it returns an error with a login hint. Otherwise it calls `signIn("credentials", { email, password, redirectTo: "/app" })`.
- `redeem(prev, formData)` in welcome/actions: token and password → `redeemInvite` → `signIn`, same as above.
- Middleware: add `/audit` and `/welcome` to `PUBLIC_PATHS`.
- `/audit/[id]` page sets `maxDuration = 300`, because `startAudit` runs from the home page and the /book page. Both of those already set it or must set it. Add `export const maxDuration = 300` to `src/app/page.tsx` as well.

- [ ] Failing tests:
  - startAudit with a website saves a lead, starts setup and redirects.
  - Bad website → fieldError.
  - No-website path requires type and city.
  - submitDetails attaches the contact.
  - submitDetails after done sends the report once.
  - createAccount refuses an existing password.
  - Progress-stage cases.
  - Route 404s.
- [ ] FAIL → implement → PASS. Commit.

### Task 5: Pages

**Files:**
- Create `src/app/audit/[id]/page.tsx`, `src/app/audit/[id]/audit-live.tsx` (client), `src/app/audit/[id]/details-form.tsx`, `src/app/audit/[id]/results-teaser.tsx`, `src/app/welcome/page.tsx` + form, and `src/components/landing/website-box.tsx` (client: website input, "No website?" toggle with name/type/city, uses `startAudit`).
- Modify `src/components/landing/home.tsx` (the lookup form becomes `<WebsiteBox />`), `src/app/book/page.tsx` (right column becomes `<WebsiteBox />`, steps copy updated), `src/app/landing.css`.
- Remove `src/app/book/booking-form.tsx` and its test once unused. Keep `calendly-embed.tsx`, which moves to the audit page by import.

Page behaviour (two columns using the `mk-book-grid` layout, stacked on phones):
- **Left, `AuditLive`.** Polls `/api/audit/[id]` every 4s. Shows the "Your audit is running · This takes 5-7 minutes" heading, the stage line, a progress bar at `percent`, and "Answers in: n of total" while asking. It stops polling at done or failed.
  - On done it calls `router.refresh()` so the server page renders `ResultsTeaser`.
  - On failed: "Something went wrong on our side. We'll finish your audit by hand and email it to you."
  - On not-started: "We've already started an audit for this site today" or the capacity message. Leave your details and we'll send it.
- **Right.**
  - No email yet → `DetailsForm`: name, email, phone (optional), business name prefilled, type and city prefilled. Submit "Send me my audit".
  - Email given → thank-you card: "Thank you. We'll email your audit to <email> when it's done." Then the heading "Book 30 minutes to walk through your results", the sentence "We'll go through what AI said, what it got wrong and what to fix first.", then `<CalendlyEmbed>` prefilled. If there's no `CALENDLY_URL`: "We'll reach out within one business day to set up a time."
- **When done** (server-rendered `ResultsTeaser`, full width above the two columns):
  - The score dial and the one answer, from the same queries `dashboard/[slug]/page.tsx` uses for `PreviewSummary`: `displayScores(latestScan).visibility`, the checks and the top competitor.
  - Below that, a block of placeholder cards with `filter: blur(6px)`, `aria-hidden`, `pointer-events: none`, overlaid by a card reading "Create your account to see the full audit" and holding the createAccount form (email field only if the lead has none, password, "Create account").
  - Under it, "Already have an account? Log in".
- **Welcome page** `/welcome?token=`: "Set up your Mirror account". Shows the email from the invite (look it up by hash; show nothing if invalid), the password field and "Create account". It shows the error states from `redeemInvite`.
- **Unknown audit id** → `notFound()`.

- [ ] Failing component tests in `tests/app/audit-page.test.tsx`:
  - The teaser renders no real answer text inside the blurred block.
  - The details form shows the prefilled business name.
  - The thank-you shows the email and the Calendly heading.
- [ ] FAIL → build → PASS. Run `npx tsc --noEmit` and `npm run lint`, both clean. Commit.

### Task 6: Run it locally, start to finish

- [ ] Make sure the local dev server is on (`localhost:3000`); start `npm run dev` in the background if not.
- [ ] Walk the flow in the browser, using a real small-business site:
  1. Paste → audit page.
  2. Progress moves.
  3. Fill the form → thank-you + Calendly.
  4. Wait for done → teaser and blur.
  5. Create the account → dashboard.

  Also check: the report email goes out with the set-up link (check Resend logs or the `auditEmailedAt` stamp), and the no-website path reaches the audit page.
- [ ] Run the full suite in the background → all pass. Fix anything real.
