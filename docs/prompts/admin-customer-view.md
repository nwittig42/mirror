# Prompt: admin "view customer account" mode

Paste everything below the line into Claude Code, from the geo-platform repo.

---

I want the admin dashboard to let me (the operator) open any customer's account
and see everything going on with it: exactly what the customer sees, plus the
behind-the-scenes things only I should see.

## Context (read before designing)

- Next.js 16 app, drizzle + Postgres, Auth.js. Operator vs client roles live
  in `users.role`. Customers are "practices" (`src/db/schema.ts`).
- `requirePracticeAccess` in `src/lib/auth.ts` already lets an operator open
  any `/dashboard/[slug]/*` page. So the customer's own view technically works
  for me today, but:
  - nothing in admin links to it (only the two audit report links on
    `/admin/practices/[id]`);
  - nothing on those pages tells me I'm looking at a customer's account as
    admin;
  - some things aren't shown anywhere, or only as raw lines.
- Existing admin: `/admin` (practice list, support queue) and
  `/admin/practices/[id]` (fact sheet, prompts, competitors, findings triage,
  work log, diagnostics, passwords, latest scan line).

## What I want

1. **"View as customer" button** on each customer in `/admin` and on
   `/admin/practices/[id]`. It opens their dashboard exactly as they see it,
   with a clear banner on every page: "Viewing <name> as admin. The customer
   can't see this banner." It has a link back to their admin page and a
   switcher to jump to another customer.
   - Do NOT sign in as the customer or copy their session. I stay logged in as
     me. It's read-only: nothing I do in this mode may send the customer an
     email, change their password or act as them.
2. **One customer overview page in admin** that shows, in one place:
   - Account: name, website, category, location, active or not, when they
     signed up, their user logins (emails, last login if we have it), and
     whether they still have to change their temporary password.
   - Scores over time: every scan (complete, blocked, failed, running), with
     overall / visibility / fact score, the "Based on 4 of 5 AI tools" label,
     and the reason when a scan was blocked.
   - Latest answers: what each AI tool said, with the sources it cited.
   - Wrong facts: open, not seen in latest scan, fixed, dismissed.
   - Fact sheet, questions we ask, competitors.
   - Emails we've sent them (weekly Pulse, alerts, support receipts), if we
     record them. If we don't, say so and propose the smallest way to start.
   - Support requests from this customer and their status.
   - Work log (what they see) and internal diagnostics (what they don't).
3. Keep existing admin actions working. Don't rebuild what already works on
   `/admin/practices/[id]`. Link to it or move it into the overview.

## Rules

- Operator-only. A customer must never reach the admin overview, the banner or
  the switcher. Add tests that a client gets a not-found page.
- The customer's own view must look exactly the same for the customer as
  before.
- Plain-English labels, no jargon. It must work on a laptop screen and stay
  usable on a phone.
- Tests for the access rules and any new queries. `npx tsc --noEmit`,
  `npx eslint src scripts`, `npm test` and `npm run build` must all pass.
- The branch has a lot of uncommitted work. Don't commit unless I ask.

## How to work

Use the brainstorming skill first. This is a new admin area, so treat it as
architectural: ask me what's unclear one question at a time, show me a short
design, write the spec and plan, then build. Tell me in plain English what you
built and how to check it.
