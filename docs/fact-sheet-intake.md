# Fact sheet intake

The fact sheet is the source of truth every AI answer is checked against. A fact
on the sheet can make an answer "wrong", so it has to be confirmed by the client,
not guessed by us. The script below works for any business: a plumber, a bakery,
a law firm, a gym, a med spa. The examples are the demo business, Harbor Plumbing
and Drain, a fictional plumber in Portland, OR.

## Before the call (10 minutes)

1. Make sure the business has its website, category and location set in `/admin`.
   The category and location feed the question drafter and the namesake guard, so
   a business with a common name needs its city on record before its first scan.
2. Press **Draft from website** on the business page (or run
   `npx tsx --env-file=.env.local scripts/draft-facts.ts <slug>`).
3. Skim the drafts. Reject anything that is marketing copy rather than a fact.
4. Note the gaps: categories below with nothing drafted are the questions to ask.

Drafts are ignored by scans until approved.

## On the call (15 to 20 minutes)

Screen-share the draft list. Go category by category. For each draft: "Is this
still true?" Fix the value inline, then Approve or Reject. Then ask for anything
missing.

**Say up front:** "AI tools are describing your business to customers right now.
This list is what we'll hold them to, so we want it exactly right. Anything on
here that's wrong, or anything missing that customers ask about, tell me."

### What to collect, by category

| Category | Ask | Examples |
|---|---|---|
| Identity | What's the one-line description you'd want AI to give? Founded when, by whom? Any old names? | "Harbor Plumbing and Drain is a residential plumbing company in Portland, OR." Founded 2012. |
| People and credentials | Who delivers the service or runs the business? Exact titles, licenses and credentials, as written. | "Dale Okafor, owner, Oregon-licensed journeyman plumber" |
| Services and products | Every service or product you offer today, under its real name. | Drain cleaning, water heater replacement, repiping |
| Not offered | What do people assume you do that you don't? | "No 24/7 emergency service", "No septic work" |
| Pricing | Every price you're comfortable being quoted, with the unit. Fees, estimates, how you quote. Anything free? | "$89 service call", "Free estimates" |
| Logistics | Address, service area, hours, phone, how to book, languages. | "Open Mon to Fri 7am to 6pm" |
| Licenses and compliance | Licenses, certifications, bonding and insurance, anything regulated. | "Oregon CCB #221467, bonded and insured" |

**Price first.** Price is the fact AI gets wrong most, and it counts 1.5x in the
fact score. Get every price the client is willing to publish, and ask whether any
old prices are still floating around (old menus, old flyers, review sites).

**Not offered matters.** A claim that you offer something you don't is scored as
critical. The "not offered" list is how the checker catches it.

**Licenses are the other critical.** A license or certification AI awards you that
you do not hold ("licensed in Oregon and Washington" when it is Oregon only) is a
compliance problem for the client, so write down exactly which bodies license them
and where.

**Make each fact checkable.** "Great prices" is not a fact. "$89 service call" is.

## After the call

1. Approve everything confirmed. Reject the rest.
2. Log the call in the work log: "Confirmed 24-item fact sheet with <name>".
3. Run a scan. The fact score and the "what AI gets wrong" section of the audit
   are only as good as this sheet.

## How the fact score works

Starts at 100. Each open wrong fact costs points: critical 25, major 12, minor 4.
Price errors cost 1.5x. It floors at 0, and shows "N/A" until at least one answer
has been checked against a confirmed sheet.
