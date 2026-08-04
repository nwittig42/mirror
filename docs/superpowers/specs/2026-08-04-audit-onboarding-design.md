# Audit onboarding: form → call → readout

**Date:** 2026-08-04
**Status:** Approved design, ready for implementation planning

## Problem

`/book` collects a lead, emails the sales inbox, and shows a "we'll reach out
within one business day" card. That is the end of the flow. Three things are
missing between a submitted form and a closed deal:

1. Nothing helps the visitor book the call. They wait for an email.
2. Nothing turns a lead into something scannable. `runScan` needs a `practices`
   row plus prompts, facts, and competitors, all typed by hand in `/admin`.
3. Nothing gives the operator a surface to run the sales call from. The client
   dashboard is built for retained clients: on a first scan its trend chart and
   activity feed are empty, and its finding-triage controls are operator
   plumbing a prospect should not see.

A lead also currently exists *only* as an email. If Resend drops the send, the
lead is gone with no record anywhere.

## The sales motion this serves

The call is the sale. The operator opens by reading the prospect their own
answers — engine by engine, verbatim — and asks whether they are happy with
that. The hook is **absence**: whether the practice surfaces at all, and who
gets recommended in its place. Score and factual errors are supporting
material that follows, not the opener.

The value/pricing story is a static deck the operator maintains outside this
repo. Out of scope here.

## Flow

```
visitor fills /book
  → audit_requests row written + notification email sent
  → success card swaps to Cal.com embed, prefilled → they book

operator opens /admin, sees the lead
  → "Prepare audit": creates practice, extracts facts + prompts from their
    website, lands operator on /admin/practices/[id] to correct them
  → "Run scan" (the existing triggerScan button)

operator runs the call from /audit/[token]
  → verbatim per engine → score → competitors → factual errors
  → same link sent afterward as the leave-behind
```

## 1. Data model

New table in `src/db/schema.ts`:

```ts
export const auditRequestStatusEnum = pgEnum("audit_request_status",
  ["new", "prepared", "won", "lost"]);

export const auditRequests = pgTable("audit_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceName: text("practice_name").notNull(),
  websiteUrl: text("website_url").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  bestTimes: text("best_times"),
  status: auditRequestStatusEnum("status").notNull().default("new"),
  practiceId: uuid("practice_id").references(() => practices.id),
  readoutToken: text("readout_token").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Lead contact details do not belong on `practices` — a lead that never converts
should not create a practice at all. `practiceId` and `readoutToken` stay null
until "Prepare audit" runs.

**Status is deliberately only four values.** Scan progress is *not* mirrored
here; it lives on the `scans` table and is derived by joining. Duplicating it
would invite drift between two sources of truth.

Schema changes ship via `npm run db:push`, matching current practice.

### The unauthenticated write

This is the app's first write path reachable by a stranger, which
`audit-request.ts` previously and deliberately avoided. Accepted, because
losing leads to a dropped email is the worse failure. Mitigations:

- It stays a server action, not a JSON API route — nothing to discover and hammer.
- The existing honeypot field still short-circuits naive bots.
- The existing zod schema caps every field length, bounding row size.
- Add per-IP rate limiting to `requestAudit` (in-memory window is sufficient
  at current volume; a bot burst then costs junk rows, not availability).

The realistic downside is rows to delete, not a security hole.

## 2. Public flow: `/book`

`requestAudit` (`src/app/book/actions.ts`) gains a DB write before the email
send. Write-then-send: **the row is the record of truth, the email is a
notification.** A failed email must not fail the request — if the insert
succeeded, the visitor sees success and the lead is safe in `/admin`. Only an
insert failure returns the existing error state with the `mailto:` fallback.

On success the form card swaps to an embedded **Cal.com** scheduler, prefilled
with the contact's name and email, headed by something to the effect of "Your
scan is running. Pick your fifteen minutes."

- Booking URL comes from a new optional `CAL_BOOKING_URL` env var.
- If it is unset, the card falls back to today's "we'll reach out within one
  business day" copy. A missing env var degrades; it never breaks the page.
- **No Cal webhook.** Scans are operator-triggered, so nothing needs to listen
  for the booking. The operator sees it on their own calendar.

## 3. Operator flow: `/admin`

### Audit requests list

New section on `/admin`: practice name, website, contact, submitted-at,
status, and the action button. Newest first. Operator-only, like the rest of
`/admin`.

### `prepareAudit(auditRequestId)`

A new server action in `src/app/admin/actions.ts`, `requireOperator()` first
like every sibling. In order:

1. Slugify the practice name; uniquify against existing slugs by appending
   `-2`, `-3`, … Pure function, independently testable.
2. Insert the `practices` row with `active: false` and the lead's website.
3. Fetch the site and extract facts + prompts (below).
4. Insert the extracted facts and prompts.
5. Set `practiceId`, generate `readoutToken`, set status `prepared`.
6. Redirect to `/admin/practices/[id]`.

The operator lands on the existing practice page, which already has fact and
prompt editors, corrects anything the extraction got wrong, and clicks the
**existing** `triggerScan` button. No new scan machinery.

`readoutToken` is generated here, not on scan completion, so `scan-runner.ts`
is not touched. The readout page renders a "still running" state until a
complete scan exists.

Token: `crypto.randomBytes(24).toString("base64url")` — 32 unguessable chars.

### Site extraction

Follows the `hallucination-judge` split exactly: a pure parser in `src/core/`,
an I/O service in `src/services/`.

**`src/services/site-extract.ts`** — fetches the practice homepage plus common
sub-pages (`/about`, `/services`, `/treatments`), tolerating 404s; strips tags
to text; caps total characters before sending. One Anthropic call returns both
halves in a single JSON payload. Takes an injectable fetch and an injectable
LLM call, so tests never touch the network.

**`src/core/extract-parse.ts`** — pure. Parses and validates the model's JSON:

- Facts are dropped unless `category` is a real `factCategoryEnum` value.
- Prompts are dropped unless `kind` is a real `promptKindEnum` value.
- Prompts are capped at 10, matching `MAX_ACTIVE_PROMPTS` in `admin/actions.ts`.
- Malformed JSON yields `{ facts: [], prompts: [] }` rather than throwing —
  a bad extraction should leave the operator with an empty form to fill in,
  not a crashed action.

Prompts are the point of the extraction, more than facts. "Does the practice
surface?" is only meaningful if we asked what its patients actually ask, which
requires its treatments and city off the website. `not_offered` facts remain
worth extracting: they are where the strongest hallucinations come from.

New env var `EXTRACT_MODEL` with a default in `src/lib/env.ts`, per the repo's
rule that no model ID is hardcoded outside that file.

## 4. The readout: `/audit/[token]`

Public path (added to `PUBLIC_PATHS` in `src/middleware.ts`), `robots:
noindex`, reachable only with the token. No login, so it works as a
leave-behind link after the call.

Styled in the marketing (`mk`) visual language, not the dashboard's. It is a
sales asset. No triage controls, no navigation into the app.

Section order follows the call script:

1. **Verbatim, engine by engine.** For each prompt, the real question and each
   engine's actual answer text, with the practice's name highlighted where it
   appears and visibly absent where it does not. This is what the operator
   reads aloud.
2. **The score** and its four components.
3. **Competitors** named where the practice was not.
4. **Factual errors** — findings from the judge, where any exist.

Degraded states render as plain messages, never a 404 or a half-broken page:
no scan yet, scan running, scan failed. An unknown token 404s.

Data assembly is a pure function from scan rows to a view model, in
`src/lib/` alongside the existing `queries.ts` and `report.ts`, and tested
independently of rendering.

## 5. Testing

Mirrors the existing split — pure logic unit-tested, I/O injected:

| Unit | Test |
|---|---|
| `src/core/extract-parse.ts` | Valid payload, malformed JSON, bad category, bad prompt kind, >10 prompts |
| Slug uniquification | Collisions, unicode, empty-after-slugify |
| Readout view model | Full scan, no scan, running, failed |
| `site-extract.ts` | Injected fetch + LLM; 404 sub-pages; character cap |
| `prepareAudit` | Operator guard, row creation, status transition (extend `tests/app/admin-actions.test.ts`) |
| `requestAudit` | Insert succeeds + email fails ⇒ still success (extend `tests/app/book-actions.test.ts`) |
| `audit_requests` schema | Extend `tests/db/schema.test.ts` |

## Out of scope

- Cal.com webhooks and any booking state stored in our database.
- Lead pipeline beyond the four statuses.
- Follow-up email automation.
- The value/pricing deck, generated or otherwise.
- Won-lead → paying-client automation. `inviteClient` already covers it.

## Open risks

- **Extraction quality is unproven.** The operator review step is the mitigation;
  if extraction proves consistently poor, the fallback is hand-entry, which is
  where things stand today, so the downside is bounded.
- **Sites that block server-side fetches** (Cloudflare, JS-only rendering) yield
  an empty extraction. Operator fills the form manually. Acceptable.
- **Cal.com embed is a third-party script** on an otherwise dependency-free
  public page. Confined to the post-submit success state, so it never loads for
  a visitor who has not already converted.
