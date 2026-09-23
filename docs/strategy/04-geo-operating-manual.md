# Doc 2: The GEO Operating Manual
*What we actually do, workstream by workstream. Internal document. This is the real work behind the client experience in Doc 3.*

---

## 0. The mental model (why the work is what it is)

Every AI engine answers "best med spa in X" the same way: rewrite the question into several searches → retrieve candidates from its index/partners → rerank → compose a shortlist with citations. So the work is exactly two jobs:

1. **Be retrievable everywhere the four engines look.** ChatGPT looks at Bing + its own crawler. Gemini/AI Mode looks at Google + Maps/GBP. Perplexity looks at its own index + a licensed Yelp feed. Claude looks at (almost certainly) Brave.
2. **Be corroborated by sources the engines trust for this query type.** For local aesthetic queries that means: Yelp, Google reviews, "best of" listicles, RealSelf/board directories, and the practice's own treatment pages, which supplied ~60% of citations in the one medical-vertical study that exists.

Everything below serves one of those two jobs. Anything that serves neither (llms.txt, Wikipedia for a single practice, schema-as-magic) we don't sell and don't do beyond hygiene.

---

## 1. Workstream A: Retrievability foundation (month 1, mostly one-time)

**A1. Crawler access (30 min).** VentureCite Crawler tab against their homepage + top 3 treatment pages. Med spa sites (often Wix/Squarespace/agency templates with aggressive bot blocking) frequently block GPTBot/OAI-SearchBot/PerplexityBot/ClaudeBot. Deliverable: the exact robots.txt lines, sent to their web person. *If facts live only inside a booking widget or JS carousel, flag for Workstream C, engines can't read them.*

**A2. Index coverage (30 min).** Verify indexation in Google AND Bing (Bing Webmaster Tools: nobody's med spa is verified there; ChatGPT pathway) and findability in Brave Search (Claude pathway). Submit sitemap to Bing.

**A3. The listings block (3–4 hrs, highest ROI in the entire engagement):**
- **Yelp first**: not an afterthought: direct Perplexity data feed + 3.4× local AI citation dominance. Complete every field: services with treatment names, provider bios, photos, hours, amenities.
- **GBP**: correct primary category (Medical Spa / Dermatologist, not "Skin care clinic"), every service as a GBP Service, Q&A seeded with 5 real questions, booking link, photos.
- **Bing Places** (claim it; it's always unclaimed).
- **RealSelf**: claim provider profiles, complete procedure lists, answer 3 Q&A questions (RealSelf answers rank and get retrieved).
- **Credential chain**: state medical board profile, ABD/ABPS listing, Healthgrades, Vitals, every one matching the Fact Sheet exactly (name spelling, credential letters, practice affiliation). This is both a retrieval surface and the hallucination vaccine.

**A4. Name-variation sweep.** List every way the practice/providers get written (with/without "Dr.", maiden names, old practice names, DBA vs. legal). Feed to VentureCite brand variations AND fix the worst inconsistencies at the source.

## 2. Workstream B: Ground truth & hallucination remediation (ongoing)

**B1. Fact Sheet** (built in onboarding, maintained forever): providers/credentials, services with brand names, the NOT-offered list, pricing, hours, compliance red lines. Every client-approved fact is authoritative.

**B2. When a hallucination is found, the actual fix depends on the failure type:**

| AI error type | Root cause | The fix |
|---|---|---|
| Wrong price / stale offer | Old page, third-party listing, or expired promo still indexed | Update/redirect the stale page; correct the listing; publish current pricing on a crawlable page (engines can't cite what isn't published, a practice that hides pricing invites price hallucination) |
| Wrong credentials ("Dr." for an RN, wrong board) | Inconsistent directories, sloppy press mentions | Fix the credential chain (A3); add explicit credential text to provider pages ("[Name], NP, nurse practitioner injector, supervised by [MD]"); request corrections on third-party bios |
| Fabricated service | Engine pattern-matching from category ("med spas do CoolSculpting") | Publish an explicit services page including what they DON'T do where natural ("we focus exclusively on injectables and skin. We do not perform surgical procedures"); fix category listings |
| "Permanently closed" / wrong hours | GBP/Yelp signal or duplicate listing | Kill duplicate listings; re-verify GBP; update everywhere |
| Confused with similarly-named practice | Entity ambiguity | Strengthen distinguishing signals: consistent NAP, schema (this is what schema is actually for), distinct provider names on every page |

Log every finding → fix → re-check date in the platform. **Re-run the triggering prompt 2 weeks post-fix and record the result**, "found → fixed → verified gone" is the single most renewal-driving line in the monthly report.

## 3. Workstream C: Content that gets cited (1 piece/mo on Fix tier)

The practice's own site is the top citation source for branded and informational prompts in the medical vertical. Formula per page (from the Princeton GEO findings + citation-study patterns):

1. **One page per hero treatment**, answer-first: the direct answer to the money question in the first 80 words ("Botox in Santa Monica costs $12–16/unit; at [Practice], Dr. Kim charges $14 and personally performs every injection").
2. **Load-bearing specifics**: prices/ranges, unit counts, appointment length, downtime days, who performs it, credentials inline. Statistics lifted citation odds ~41% in the GEO benchmarks; vague pages get skipped.
3. **FAQ block** (5–8 real patient questions, from consult-room language + the Keywords tab) with visible answers + FAQPage schema via the platform's one-click markup. Schema is hygiene, not magic. The visible answer is the asset.
4. **Run it through Signals** → fix what scores poorly → Chunk Engineer if structure is weak.
5. Every claim grounded in the Fact Sheet. Medical review line ("Medically reviewed by [provider], [date]"), E-E-A-T for the Google layer, trust for humans.

Cadence: month 1 = hero treatment page rewrite; month 2 = FAQ batch; month 3 = second treatment page or "how to choose a safe med spa in LA" guide (targets prompt #15, positions the client as the safety-credentialed answer); repeat.

**Never:** doorway pages per neighborhood, AI-generated fluff at volume, competitor-bashing comparison pages under the practice's own byline (engines cite self-serving "we're #1" pages while recommending competitors, 69% of the time in the one study that measured it).

## 4. Workstream D: Third-party corroboration (the monthly grind, 2 targets/mo)

**D1. Listicle placement: the highest-leverage recurring work:**
1. Harvest the actual cited URLs from every citation check (the engines tell you their sources; that's the target list, no guessing).
2. Sort into: (a) editorial listicles ("12 best med spas in LA" on a lifestyle site), (b) pay-to-play directories, (c) aggregators.
3. For editorial: find the author, pitch inclusion with a genuinely useful angle, updated info, a unique stat, the provider as quotable expert. Track in GEO Assets › Listicles.
4. For pay-to-play cited by engines: present cost to client as a line-item decision ("this directory is cited in 3 of your 10 prompts; inclusion is $X/yr").
5. When one lands, re-run affected prompts in week 2, landing one listicle typically moves more "best of" prompts than everything else that month; document the before/after.

**D2. Review depth (client-executed, we direct):** monthly instruction card for front desk, "this month ask happy patients to mention the treatment and injector by name." Review *text* is retrievable content; "Maria's Dysport results" in a Yelp review is a citation-farm asset no agency can fake. We monitor velocity/keywords via the platform.

**D3. Local PR (Dominate tier / quarterly):** pitch the lead provider as expert source to LA lifestyle/beauty press (brand mentions correlate 0.664 with AI visibility vs 0.218 for backlinks, mentions > links). One earned mention/quarter is a win.

## 5. Workstream E: Community (Dominate only, careful)

- Monitor r/LosAngeles, r/30PlusSkinCare, r/PlasticSurgery, r/botox + Mentions tab for practice/provider mentions. Respond only where the practice has a legitimate voice (owner answering a direct question about their own practice, transparently).
- **Never astroturf.** One exposed fake post in a skincare subreddit is a permanent, searchable, AI-retrievable reputation wound, the exact opposite of the service. If real patients organically post, great; we can ask happy patients if they're active there, nothing more.
- Realistic goal: presence and accuracy in threads that already exist, not manufacturing threads.

## 6. The operating calendar

| | Week 1 | Week 2 | Week 3 | Week 4 |
|---|---|---|---|---|
| **Every week** | Scan review + Pulse email (per client, ~25 min) | same | same | same |
| **Month 1** | Onboarding: Fact Sheet, crawler, listings block A1–A4 | Baseline report + fix plan | First content piece | First listicle outreach |
| **Month 2+** | Hallucination remediation queue | Content piece of the month | 2 listicle targets | Monthly report + next-month worklist |
| **Quarterly** | Trend review call; re-run full 15-prompt battery 3× (the deep audit); refresh prompt set from Keywords tab | | | |

## 7. Honest internal notes (what moves the needle vs. what's theater)

- **Real needle-movers:** listings block (once), listicle placements (compounding), review depth (compounding), hallucination fixes (retention), treatment-page rewrites (moderate).
- **Necessary hygiene sold as work but cheap to do:** schema, crawler checks, Bing verification. Do them, report them, don't oversell them internally to yourself.
- **Theater to avoid entirely:** llms.txt, Wikipedia for a single practice, mass AI content, per-neighborhood doorway pages, "we'll make you #1 on ChatGPT" promises (non-deterministic system; sell trend, not rank).
- **Expectation physics:** score movement is lumpy. Weeks 1–6 often flat (fixes propagate on crawl/refresh cycles), then step-changes when a listicle lands or listings get re-crawled. Set this expectation at kickoff (Doc 3 handles the script) or month-2 churn risk is real.
- **The measurement rule:** every claim we make to a client must trace to a logged check in the platform. If we didn't measure it, we don't say it.
