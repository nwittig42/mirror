# Doc 3 — Client Experience & the AI Visibility Score
*How clients interact with the platform, what the score means, and every touchpoint from onboarding to renewal. This is the client-facing layer over Doc 2's work.*

---

## 1. Design principle

The client experience has one job: **make invisible work visible and make progress legible.** A med spa owner will never read a citation log. They will read a score, a verbatim quote about themselves, and a red alert. Every interaction below is built from those three atoms.

## 2. The AI Visibility Score

### Definition (client-facing explanation, use verbatim)
> "We ask the four major AI engines the questions your patients actually ask — 10 tracked prompts, checked every week, about 40 checks a month. Your score, out of 100, reflects how often you're named, how prominently, and whether what's said about you is accurate. It's measured from real answers, not estimated."

### The formula (ours, built on the platform's citation-rate blend)
Per the platform, the score blends citation rate, checks cited, and recent change — no black box. Present it to clients as four visible components:

| Component | Weight | What it measures |
|---|---|---|
| **Citation rate** | 50% | % of tracked prompt-checks where the brand is named (any engine) |
| **Position quality** | 20% | Named first / in top 3 / mentioned / absent (weighted) on "best of" prompts |
| **Coverage breadth** | 15% | On how many of the 4 engines they appear at all (an 80-on-Perplexity, 0-elsewhere practice is fragile) |
| **Accuracy** | 15% | % of branded checks free of Fact Sheet contradictions — **an inaccuracy caps the score** (a practice described falsely can't score above 70, whatever its citation rate; accuracy is the product) |

### Score bands (set expectations with these at kickoff)
- **0–25 — Invisible.** AI rarely names you; competitors own your prompts. (Most new clients start here. Say so: "most practices we audit start in the teens.")
- **26–50 — Emerging.** Named sometimes, inconsistently, on 1–2 engines.
- **51–70 — Competitive.** Regularly shortlisted; the fight is now position and consistency.
- **71–100 — Dominant.** Default answer in your neighborhood + treatments. (Be honest: in a competitive LA pocket, 75+ is the realistic ceiling; 100 doesn't exist in a non-deterministic system.)

### Score conversations (scripts)
- **"Why did my score drop?"** — *"AI answers are probabilistic — the same question can get different answers on different days. That's exactly why we run 40 checks a month instead of one: single-week dips of a few points are noise; the 90-day trend is signal. Here's yours."* (Show Trends, 90-day window.) Internally: never celebrate a 1-week gain either, or you own every 1-week dip.
- **"Why am I not #1?"** — *"For medical questions, AI engines deliberately hedge — they shortlist rather than crown. Our goal is: always on the shortlist, always described accurately, on all four engines. That's what converts anyway — patients read the whole answer."*
- **"Competitor X is above me"** — open the competitor leaderboard, show *which sources* the engines cite for them (usually 2–3 listicles), and point at the worklist item that targets exactly those. Turns envy into a plan.

## 3. The client journey on the platform

### Day 0–7: Onboarding (their first login is a moment — stage it)
1. Before the kickoff call, their brand is fully set up: profile, Fact Sheet drafted, prompts written, baseline scan complete. **They never see an empty dashboard.** First login shows their real score, real competitor leaderboard, real verbatim answers.
2. **Kickoff call (30 min):** walk the Command Center top to bottom once → then spend 15 minutes in the Fact Sheet, having them approve/correct facts live ("is Botox still $13/unit? Does Jenna still inject on Saturdays?"). Their edits are the co-ownership moment. Resolve conflicts (keep yours / take ours) together on screen.
3. End on one verbatim answer — ideally the worst one — and the plan: "Here's your 34. Here's the four things happening in the next two weeks."
4. Send login + the 60-second guided tour link + "ask the AI Tutor anything" note. (The Tutor absorbs their how-does-this-work questions so you don't.)

### Weekly: the Pulse (email, 6 lines max)
Score delta, one verbatim quote, one fix in motion, check count, next up. Written from the Command Center in ~10 min. The client's habit we're building: *Friday = find out what AI said about me this week.* Some clients will start logging in themselves before the email — that's the retention flywheel, let the platform do it.

### Event-driven: Critical Alerts (same-day)
Triggered by the Hallucinations tab (severity: critical). Standalone email: side-by-side claim vs. fact, platform, severity, action underway. Fix-tier and up: "already handling, here's the fix"; Watch tier: numbered DIY steps + upgrade line. Every alert is later closed with a **verification note** ("re-checked Feb 12 — corrected"). Found→fixed→verified is the retention product.

### Monthly: the Report (platform PDF + your one-pager)
Anatomy, in order:
1. **Verdict** (2 sentences, plain English — the platform generates one; edit it to sound like you).
2. **Score + trend chart** (8-week citation trend).
3. **Accuracy ledger:** found / fixed / verified / open. The section no SEO agency has.
4. **Per-engine breakdown** (why: "your Perplexity jump came from the Yelp rebuild — different engines, different levers").
5. **What we did** — the itemized activity log (15–25 atomic lines).
6. **Competitor movement** — leaderboard + share-of-voice donut.
7. **Next month** — 3 worklist items, pre-committing next month's value.
8. Appendix: best verbatim answer of the month, screenshotted.

### Quarterly: the Trend Call (30 min)
90-day Trends window + full 15-prompt deep audit results + prompt-set refresh ("patients started asking about [new treatment]; we're adding 2 prompts"). This call is where renewal happens without being asked for. For Fix+ tiers.

## 4. Touchpoint calendar (client's view)

| When | What they get | Channel |
|---|---|---|
| Weekly (Fri) | Pulse: score, quote, fix-in-motion | |
| Same-day | Critical Alert on any false claim | Email (forwardable by design) |
| Monthly | Report PDF + activity log | Email + platform |
| Quarterly | Trend call + deep audit + prompt refresh | Zoom |
| Anytime | Command Center, Worklist, verbatim answers, AI Tutor | Platform login |
| On fact change | "Did anything change?" prompt (new provider, price change, hours) | Email, 1 line |

That last row matters: a monthly *"any changes to prices, providers, services, hours?"* one-liner keeps the Fact Sheet authoritative, catches staleness before the AI does, and quietly reminds them the ground truth lives with us — the switching cost in one email.

## 5. Making the platform sell for you

- **Prospect mode:** load a hot prospect's brand before the pitch (1 hr). Demo their own Command Center live — "this is already running on you" closes better than any deck.
- **Watch-tier UX as upgrade engine:** Watch clients see the same Worklist as everyone — populated, prioritized, and *unexecuted*. Every monthly report ends with "3 open worklist items — handled on the Fix plan."
- **Score as referral currency:** clients quote their number ("we're a 68 on AI now"). Give them a shareable one-page score card at quarter-end — it travels to their injector group chat, which is your best lead channel.
- **What we never do in the product experience:** show estimated/projected numbers as results (platform reports measured checks only — keep it that way in everything custom you add); promise rank; hide a bad month (a down report delivered with a plan builds more trust than a massaged one).

## 6. Lifecycle: expansion and save motions

- **Upgrade triggers to watch:** client asks "can you also do X?" (content, more prompts) → Fix→Dominate conversation. New location or provider → per-location add-on. Competitor pressure spikes in leaderboard → Dominate pitch with the specific competitor named.
- **Save motion (score flat + client quiet 2+ weeks):** don't wait for the churn call. Send the accuracy ledger recap ("in 6 months: 9 false claims found and killed") — accuracy value is retention insurance precisely when visibility growth is slow.
- **Exit interview if churned:** one question — "what did you expect by now that didn't happen?" Feeds the kickoff-expectations script for the next client.
