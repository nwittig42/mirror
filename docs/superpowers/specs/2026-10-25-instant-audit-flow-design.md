# Instant audit flow — design

## Intent

Today a visitor fills out a long form before anything happens. Nick wants the
audit to start the moment someone pastes their website, so the wait (5-7
minutes) is spent filling in their details and booking a call, while they
watch the audit come together. Finishing the audit on the page shows a taste
of the results and asks them to create an account to see the rest.

## The flow (Nick's words, made concrete)

1. **Paste the website.** The home page box (and /book) asks for the website
   only. Submitting starts the audit right away and lands on the audit page.
   Under the box, a small "No website?" link asks for business name, type of
   business and city instead, then goes to the same page.
2. **Audit page, while it runs.**
   - Left: a progress panel. Says "This takes 5-7 minutes", shows the stage
     (reading your website → writing the questions your customers ask →
     asking ChatGPT, Claude, Gemini, Grok and Perplexity, with a count of
     answers in → writing your report) and a progress bar. It refreshes by
     itself every few seconds.
   - Right: the details form: your name, email, phone (optional), business
     name (prefilled from the website, editable), type of business and city
     (optional, prefilled when known).
3. **After the form.** The right side becomes: "Thank you. We'll email your
   audit to <their email> when it's done." Then a CTA heading ("Book 30
   minutes to walk through your results") above the Calendly scheduler. The
   progress panel keeps going.
4. **When the audit finishes.**
   - **If they've given their email,** they get the report email. Instead of
     a temporary password, it has a "Set up your account" link that opens a
     page where they choose a password (their email is the username), then
     land on their dashboard.
   - **If they're still on the page,** the progress panel is replaced by the
     results: the AI recommendation score and one real answer, then the rest
     blurred out, with "Create your account to see the full audit." Creating
     the account right there takes a password (and their email if they never
     gave it), then goes to the dashboard.
   - **If they left before giving their email,** the audit still finishes
     and shows in admin as a lead. Nobody is emailed.

## Decisions Nick made

- First step is the website only (no email up front). Accepted cost: someone
  who leaves before the form can't be sent the audit.
- Businesses without a website are served: name, type and city are enough
  to scan on the standard question set. Their report has no fact check
  (nothing to check against).
- The audit keeps running if they leave the page.

## Calls made by Claude (Nick can override)

- **The audit page address is the key.** /audit/<lead id>. The id is a random
  UUID, so the page is private to whoever has the link. No login needed.
- **Business name before the form:** read from the website's title (falls
  back to the domain). When the form arrives with a different name, it
  becomes the business name and is added as a name variation, so the scan
  counts mentions of either. A scan step already reloads names every step.
- **Blurred section holds no real data.** It's placeholder content blurred
  with CSS, so nothing real can be read from the page source.
- **Account creation on the page** is allowed only for an email that doesn't
  already have a password; an existing account is told to log in instead.
  Email is the username.
- **Set-up link:** a one-time token, valid 14 days, stored hashed. Opening it
  after it's used or expired says so and points to the login page.
- **The same limits as today:** 20 automatic audits a day, and one per
  website per day. A repeat or over-the-limit paste still gets the audit
  page, which says "We've already started an audit for this site today, leave
  your details and we'll send it" (or "we're at capacity today, leave your
  details and we'll run it by hand"). The lead lands in admin as today.
- **The old long form** at /book is replaced by the website box. Every
  existing "Book your audit" link keeps working because it points at /book.
- **The report email** loses the temporary password and gains the set-up
  link. The admin "issue a password" button is untouched.
- **Emailing when the form comes in after the audit finished:** sent right
  away on submit.

## Non-goals

- No email verification beyond the set-up link itself.
- No live streaming of answers to the page; polling every few seconds is
  enough.
- No change to how scans run (the steps design from 2026-10-21 stays).

## Constraints

- Vercel Hobby: 300s per function. Setup (reading the site, drafting) and the
  first scan step share the start request's budget, as today.
- One shared Neon database between local and production. Schema changes are
  additive or loosen constraints only (e.g. contact name and email become
  optional), pushed with `npm run db:push`.
- Plain, short, jargon-free copy for business owners.
