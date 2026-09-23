# Booking CTAs: get practices on the phone

*Design doc. 2026-07-31.*

## Problem

Every CTA on the landing page points at `#audit`, and the one button that leaves
the page is a placeholder `mailto:hello@example.com`. There is no way for a
practice owner to get on a call with us, and no lead is captured anywhere.

## Research: what this CTA is called elsewhere

| Wording | Who uses it | Verdict for Mirror |
|---|---|---|
| "Book a demo" | B2B SaaS | Wrong. We sell a service, not software; "demo" promises a product walkthrough. One case study lifted conversion 0.29% → 0.61% by replacing it with "Talk to a Human". |
| "Book a discovery call" | Med spa marketing agencies (The Med Spa Agency) | Agency-coded, and Doc 1 names the agency-burned owner as a primary buying trigger. |
| "Book a strategy call/session" | GEO agencies (Stratabeat, Evoltra) | Vague, does not say what they walk away with. |
| "Free consultation" | Local services, lawyers | It is the word their own patients use to book with them. Good mirroring, but generic. |
| "Request an audit" | Mirror today | Most specific of the set. |

Two findings drove the design more than the noun did:

1. **Competing CTAs cost more than weak wording.** Multiple parallel asks
   ("book a demo" + "download the PDF" + "talk to sales") lose to one primary
   and one secondary.
2. **Embedded scheduling converts roughly 2× form-then-wait** (~66% vs ~30% on
   dedicated booking pages). We cannot embed a calendar yet. There is no
   scheduling account, so the form must do as much of that job as it can:
   immediate confirmation, explicit next step, no "we'll be in touch".

## Decision

The call is not a second offer competing with the audit. **The call is how the
audit gets delivered.** Doc 2 already describes the kickoff call ending by
showing the owner one verbatim AI answer about their practice; this makes that
the acquisition motion rather than an onboarding step. The visitor is asked for
15 minutes and the reason to show up is their own data, not a pitch.

One primary CTA, repeated, pointing at `/book`.

## Scope

### 1. Landing page CTA system

| Spot | Today | Becomes |
|---|---|---|
| Header | "Request an audit" → `#audit` | "Book your audit" → `/book` |
| Hero | "See your practice's answers" → `#audit` | same label → `/book`, plus microcopy |
| Mid-page | "Request an audit" → `#audit` | "See your practice's answers" → `/book` |
| Closing `#audit` | "Request your free audit" → `mailto:` | "See your practice's answers" → `/book` |
| Footer | "Request an audit" → `#audit` | "Book your audit call" → `/book` |

Secondary CTAs ("How it works", "Read the FAQ") are unchanged. That preserves
the one-primary-one-secondary shape. The closing section keeps its `#audit` id
so existing anchors do not break.

### 2. `/book` page

Public route styled with the existing `mk-*` system so it reads as one piece
with the landing page. Above the form, three steps set expectations: send your
details → we run all four engines on your practice before the call → 15 minutes
walking through the verbatim answers.

Fields: practice name, website URL, your name, email, phone (optional), best
times to reach you (optional). The website URL earns its place by letting the
scan run before the call, so the call can open on their own hallucination.

### 3. Server action and email

`src/app/book/actions.ts`, following the `"use server"` pattern the login page
uses rather than an API route. Zod validation, field-level errors surfaced
through `useActionState`, Resend delivery to `LEADS_EMAIL` (new, optional env
var, falling back to `OPERATOR_EMAIL`).

Every interpolated value passes through an HTML escape before reaching the email
body, matching `src/services/pulse-email.ts`. Submitted values are attacker-
controlled, so this is the same class of guard that file applies to raw engine
output.

Spam handling is a honeypot field plus length caps, no captcha at this volume.

On success the form swaps in place to a confirmation panel; no extra route. On
send failure the error state exposes a real `mailto:` fallback so a lead is
never silently dropped.

### 4. Middleware

`/book` is added to `PUBLIC_PATHS` in `src/middleware.ts`. Without this, signed-
out visitors, i.e. every prospect, are redirected to `/login`.

## Testing

- Validation rejects a missing practice name, a malformed email, and a
  non-http(s) website URL.
- The honeypot path returns success without sending.
- HTML-significant characters in submitted values are escaped in the email body.
- Lint, full test suite, and a real browser pass on the form.

## Out of scope

Captcha, a leads database table (email only until volume justifies it), a
scheduling embed (revisit once a Cal.com/Calendly account exists), and any
change to pricing or FAQ copy.
