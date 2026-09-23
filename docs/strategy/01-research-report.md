# GEO for Cosmetic/Aesthetic Medical Practices in Los Angeles
## Research Report for a Paid Monthly AI-Visibility Service

*Prepared July 28, 2026. Sources cited inline. Items marked **[Confirmed]** are backed by published studies or vendor documentation; **[Speculative]** means industry consensus or inference without hard data.*

---

## 1. How GEO Actually Works

### The retrieval pipelines

None of the four engines "knows" about a med spa from training data alone for a query like "best med spa in Santa Monica for Botox." They all run the same loop at answer time: interpret the query → rewrite/fan it out into several searches → retrieve candidates from an index or licensed database → rerank for relevance, location, prominence, freshness → have the LLM compose a shortlist with citations. The reranking weights are proprietary everywhere; the pipelines are not:

- **ChatGPT (with search):** query rewriting + third-party search providers, with **Bing explicitly documented** as a significant provider, plus OpenAI's own OAI-SearchBot crawler determining ChatGPT Search eligibility. Approximate location comes from IP; third-party providers may supply nearby-business data. So: Bing Webmaster Tools indexation + Bing Places + not blocking OAI-SearchBot are real levers. **[Confirmed]** ([OpenAI help docs](https://help.openai.com/articles/9237897-chatgpt-search))
- **Gemini / AI Mode / AI Overviews:** sits on the Google index + Maps/GBP entity graph, using "query fan-out" (several concurrent searches per question). A page must be normally indexed and snippet-eligible; Google says no AI-specific technical requirements exist. Important nuance: **AI Overviews almost never trigger on local keywords** (seoClarity measured 0.01% in Sept 2025), the local surfaces that matter are AI Mode place cards and the Gemini app, which lean on classic local ranking (relevance, distance, prominence). Classic local SEO transfers most directly here. **[Confirmed]** ([Google AI features docs](https://developers.google.com/search/docs/appearance/ai-features), [seoClarity](https://www.seoclarity.net/research/ai-overviews-impact))
- **Perplexity:** own continuously-refreshed index and crawler (PerplexityBot), **plus a confirmed Yelp data license (Yelp Fusion)**. It can pull Yelp ratings, review text, photos, and business details directly into local answers. This is the strongest documented local-data pipeline of the four. **[Confirmed]** ([The Verge, Mar 2024](https://www.theverge.com/2024/3/12/24098728/perplexity-chatbot-yelp-suggestions-data-ai))
- **Claude:** live web search with citations; the backend is **very likely Brave Search**, Anthropic lists Brave as a subprocessor, and a Profound test found 86.7% of Claude citations matched Brave's top organic results. Not officially disclosed, but strong. Practical lever: check the client is discoverable in Brave Search. **[Strong inference, not official]** ([TechCrunch](https://techcrunch.com/2025/03/21/anthropic-appears-to-be-using-brave-to-power-web-searches-for-its-claude-chatbot/))

Two practical takeaways. First, **AI answers are downstream of search retrieval**: traditional local SEO decides whether a practice enters the candidate pool; third-party corroboration decides whether the engine is comfortable naming it. Second, **the engines barely overlap**: Profound found ~89% of citations differed between ChatGPT and Perplexity on identical prompts ([tryprofound.com](https://www.tryprofound.com/blog/citation-overlap-strategy)). There is no single "GEO ranking", which is exactly why per-engine monitoring is a sellable recurring service.

### Which signals matter: ranked by evidence

Profound's study of ~30M citations (Aug 2024–Jun 2025) is the best public dataset ([tryprofound.com](https://www.tryprofound.com/blog/ai-platform-citation-patterns)):

| Engine | Top cited sources |
|---|---|
| ChatGPT | Wikipedia 47.9%, then Reddit, Forbes, G2, news sites |
| Google AI Overviews | Reddit 21%, then YouTube, Quora, LinkedIn (Wikipedia only ~5.7%) |
| Perplexity | Reddit 46.7%, **Yelp ~5.8%, TripAdvisor ~4.1%** |

The most local-specific dataset is the Foundation/AirOps analysis of 28M+ local AI responses (Q4 2025): **Yelp received 3.4× more citations than any rival local platform, 72.5% of local-discovery citations in Google AI Mode and 62.1% in Perplexity**, and 91–97% of those Yelp citations came from *category* prompts ("best X near me"), not brand prompts ([foundationinc.co](https://foundationinc.co/lab/yelp-ai-local-discovery/)). Counterpoint: Yext's study found 86% of citations came from brand-manageable sources (first-party sites 44%, listings 42%, forums only 2%), the studies use different denominators, so treat both as directional ([yext.com](https://www.yext.com/about/news-media/ai-citations-release)).

Signal ranking for local queries, strongest evidence first:

1. **Crawlability / index eligibility (gate, not a lever)**: must be indexed in Google (Gemini), Bing (ChatGPT), and discoverable by Brave (Claude) and PerplexityBot/OAI-SearchBot (check robots.txt). A practice absent from a retrieval path cannot be cited from it. Server-rendered HTML; key facts not locked behind scripts/booking widgets. **[Confirmed foundational]**
2. **Yelp + review platforms (Google, RealSelf)**: Perplexity has a literal Yelp data feed, and Yelp dominates local-discovery citations in AI Mode too. Review *content* matters: reviews that name treatments and providers become retrievable text. A vendor study of 1,000+ medical-clinic prompts found specialty-board directories, certification boards, and **RealSelf** particularly influential for provider recommendations, with the practice's own site supplying ~60% of citations. **[Confirmed for Perplexity/Google; medical-vertical study is vendor-produced/directional]**
3. **Presence in third-party "best of" listicles**: comparative listicles are the most-cited content format across studies (32.5% of citations in a Profound-derived dataset; 21.9% in Wix Studio's 1M-citation study). If an engine retrieves five "best med spa in LA" articles and your client is in three, the client gets recommended. Caveat: *third-party* lists only, a B2B study found engines cite self-promotional "we're #1" pages while recommending the brand's competitors 69% of the time. **[Confirmed, strongest earned lever]** ([searchengineland.com](https://searchengineland.com/ai-citations-favor-listicles-articles-product-pages-study-472364))
4. **Reddit**: #1 aggregate source across engines (Profound × Reddit, 4B+ citations). But for *local* prompts the evidence is query-dependent: Yext found forums at only 2% for local intent, while a 100-prompt Perplexity local study found Reddit in 10 of 100 answers. Strongest for subjective prompts ("who does natural-looking filler?"), weakest for factual ones. **[Confirmed at aggregate; query-dependent locally]**
5. **Google Business Profile completeness**: a direct input to Google local matching; Google explicitly says review count/positivity and complete info improve local ranking, which feeds AI Mode/Gemini. Correct primary category (e.g., "Dermatologist" not "Skin care clinic" where applicable) matters. **[Confirmed for Google surfaces]**
6. **Digital PR / brand mentions**: Ahrefs (75,000 brands): web mentions correlate 0.664 with AI visibility vs. 0.218 for backlinks. Local press does double duty as mention and listicle. **[Confirmed correlation, not causation]** ([ahrefs.com](https://ahrefs.com/blog/ai-overview-brand-correlation/))
7. **On-site answer-formatted content (FAQs, direct answers)**: the Princeton GEO paper (Aggarwal et al., KDD 2024) found adding statistics (+~41%) and authoritative quotations (+~28%) lifted visibility in generative-answer benchmarks. Applies to informational and branded queries more than "best of" queries. Note: the practice's own site supplied ~60% of citations in the medical-clinic prompt study, so substantive treatment pages matter more in this vertical than generic-local studies suggest. **[Confirmed in benchmarks; the paper tested content edits, not local businesses]**
8. **Schema markup (LocalBusiness / MedicalBusiness / Physician)**: Ahrefs' controlled test of 1,885 pages found no meaningful citation increase after adding schema, and Google repeatedly says structured data is not a ranking boost and no special schema is needed for AI features. Treat as entity-disambiguation hygiene, not a direct GEO lever. Don't sell it as the headline (several niche competitors do; that's a differentiation point for you). **[Confirmed as indirect only]** ([ahrefs.com](https://ahrefs.com/blog/schema-ai-citations/))
9. **Wikipedia**: dominates ChatGPT citations overall but is unusable for a single med spa (notability rules). Ignore. **[Confirmed irrelevant for this niche]**
10. **llms.txt**: no engine has documented support. Skip. **[Speculative at best]**

### How medical/aesthetic differs from generic local GEO

- **YMYL treatment:** health queries get held to higher authority standards in Google's systems, which feeds AI Overviews/Gemini. Provider credentials (board certification, MD vs. NP vs. RN injector) matter both as retrieval content and as what the AI *says* about the practice. **[Confirmed for Google's ecosystem; extension to other engines is inference]**
- **Different review ecosystem:** RealSelf, Healthgrades, Vitals, and Yelp's medspa category replace TripAdvisor. Profound's healthcare cut showed AI Overviews leaning on institutional health sources (Mayo, Cleveland Clinic) for medical *information*, meaning a practice can win the "who" (provider recommendation) while big health publishers own the "what" (procedure explanation). Your client content should target the "who + where + how much" queries, not compete with Mayo on "what is Botox."
- **Credential verifiability:** engines cross-reference ABD/ABPS certification pages, state medical board listings, society directories, and hospital affiliations. The defensible medical-authority stack, in order: verified provider identity (name, degree, license, actual role) → independent corroboration (state board, specialty board, hospital directory) → procedure-specific expertise tied to the named provider → medically accurate content with named clinician review → patient-experience reviews → local entity strength → independent recommendations. Inconsistent or missing credential data is both a visibility and an accuracy risk, unique to this niche.
- **Safety-hedged answer behavior:** for medical queries, engines often refuse to crown one "best" provider, recommend consultation, or distinguish physician from non-physician injectors. That hedging is driven by model safety policies, not just retrieval, so realistic goals are "consistently named in the shortlist" and "described accurately," not "ranked #1." Set client expectations accordingly.
- **Higher hallucination stakes:** wrong pricing or a fabricated service ("they offer surgical facelifts" at a nurse-run med spa) is a compliance problem, not just an inconvenience (Section 3).

---

## 2. The Fact Sheet / Ground-Truth Concept

### What the tools actually do

Key finding: **none of the major GEO tools publicly documents a true ground-truth reconciliation system.** Profound, Otterly, Peec, Scrunch, RankScale, and Goodie all follow the same loop: define prompt set → run prompts on schedule across engines → record mention/citation/sentiment → dashboard + recommendations. When vendors say "hallucination detection" (e.g., AthenaHQ), it means "we noticed the AI omitted or misdescribed you," not "we maintain a canonical facts file and diff every answer against it." ([nicklafferty.com tool roundup](https://nicklafferty.com/blog/best-generative-engine-optimization-tools-2025/), [acromatico.com pricing comparison](https://acromatico.com/ai-visibility-tool-pricing-compared))

**VentureCite:** I could not find any public documentation, pricing, or product detail for this tool. It either rebranded, is pre-launch, or is too small to have public footprint. **[Unverified, if you heard about it from a specific source, worth checking directly.]**

Tool pricing for context: Otterly $29–489/mo, Peec ~€75–199/mo, Scrunch ~$100–300/mo, AthenaHQ ~$265–295/mo, Goodie ~$495/mo, Profound $499+/mo entry with custom enterprise. **This is your pricing air-cover: the software alone costs $300–500/mo at the mid-tier, with zero done-for-you service attached.**

### The gap = your product

Because no tool does true fact-sheet reconciliation, the manual version is genuinely differentiated, and it's exactly what a liability-sensitive medical practice values. A minimal fact sheet you can build in under an hour per client:

**Client Ground-Truth Sheet (one spreadsheet, ~45 min)**

| Section | Fields | Source |
|---|---|---|
| Identity | Legal name, DBA, prior names, address(es), phone, site URL | Client intake |
| Providers | Each injector/MD: full name, license type (MD/DO/NP/RN/PA), board certs, years practicing | State medical board lookup + client |
| Services | Every treatment offered, with the device/brand names (Botox vs. Dysport vs. Jeuveau; Morpheus8; CoolSculpting) | Website + client confirm |
| NOT offered | Procedures they don't do (surgical, threads, etc.), hallucination bait | Client |
| Pricing | Per-unit / per-syringe / per-session prices or ranges, membership pricing, consult fee | Client |
| Logistics | Hours, parking, languages, financing (Cherry/CareCredit), booking method | Website + client |
| Reputation | Google rating + count, Yelp rating + count, RealSelf profile Y/N, notable press | Public |
| Compliance flags | Claims the client must never have attributed to them ("guaranteed results," off-label claims, "board-certified" if not) | Client's compliance officer or owner |

Every monitoring cycle, you diff AI answers against this sheet and log discrepancies with severity: **Critical** (wrong credential, fabricated service, safety claim) / **Major** (wrong price, wrong hours/location) / **Minor** (stale detail, omission). That log *is* the monthly deliverable.

---

## 3. Hallucination & Accuracy Risk in This Niche

### What's documented

- **Walters v. OpenAI (Georgia, decided May 19, 2025):** ChatGPT fabricated an embezzlement accusation against radio host Mark Walters. Court granted OpenAI summary judgment, output wasn't defamatory as a matter of law, no negligence/actual malice shown, no damages proven; OpenAI's "may be inaccurate" disclaimers helped its defense. ([Reuters](https://www.reuters.com/legal/litigation/openai-defeats-radio-hosts-lawsuit-over-allegations-invented-by-chatgpt-2025-05-19/), [Loeb & Loeb analysis](https://www.loeb.com/en/insights/publications/2025/05/walters-v-openai-llc)) **Sales implication: the practice has effectively no legal recourse against the AI company when it's misdescribed. The only remedy is fixing the source data, which is the service you sell.**
- **No documented med-spa-specific case surfaced.** I found no published lawsuit or news story of an AI engine misstating a specific medical practice's credentials or pricing. **[Confirmed absence in my searches. Flag this honestly; don't imply documented incidents exist.]**
- The general failure modes (wrong hours, "permanently closed" errors, invented details about local businesses in AI Overviews) are widely reported anecdotally but not systematically measured for medical practices. **[Speculative as to frequency in this niche]**

### The real compliance angle (stronger than the defamation angle)

Medical advertising accuracy rules create *asymmetric* risk that generic businesses don't have:

- California's Medical Board and B&P Code restrict who may be called "board-certified" and how medical services are advertised. Many "med spas" are nurse-operated under a medical director; an AI saying "Dr. X performs your injections" when an RN does is exactly the kind of misrepresentation regulators care about, even though the practice didn't publish it.
- Wrong pricing stated confidently by ChatGPT creates patient-expectation disputes at the front desk.
- Fabricated service claims (AI says they offer a surgical procedure) implicate scope-of-practice issues.

**The honest, strong pitch:** "AI engines are now describing your practice to patients, unsupervised, with no legal accountability for errors (see Walters v. OpenAI). We audit what ChatGPT, Perplexity, Gemini, and Google's AI actually say about you every month, catch anything false about your credentials, pricing, or services, and fix the sources the AI learns from." That is 100% factual, no need to invent horror stories.

---

## 4. Manual Citation Check: Repeatable Process

### Protocol (per client, ~2–3 hrs first run, ~1 hr monthly)

1. **Fresh sessions, memory off.** ChatGPT: temporary chat (memory contaminates results). Claude: new chat. Perplexity: logged-out or fresh thread. Gemini: new chat. **Do not** let your own history/location personalize results. Note that engines geo-personalize, so if you're not in LA, state the location in every prompt.
2. **Run a fixed prompt battery** (below), identical wording every month, in the same order. Wording changes = incomparable results.
3. **For each response, log in a spreadsheet:** date, engine, prompt, (a) was the client mentioned? (b) position (1st/2nd/listed/absent), (c) which competitors appeared, (d) which sources were cited (Perplexity and ChatGPT show them; expand AI Overview citations), (e) every factual claim made about the client → diff against the fact sheet, (f) screenshot (this is your before/after sales evidence).
4. **Run each "best of" prompt 2–3 times per engine.** Answers are non-deterministic; a single run tells you "possible," three runs tell you "typical." Score visibility as mentions/runs. **[This is the step every DIY competitor skips. It's what makes your report defensible.]**
5. **Run the branded prompts** ("tell me about [Practice Name]"). This is where hallucinations show up, since the engine must generate specifics.
6. **Repeat monthly**; the deliverable is the delta: visibility score per engine, new/fixed inaccuracies, competitor movement.

Free tools like Geoptie's GEO audit or Otterly's free tier can supplement, but the manual protocol above is the product, and it's what lets you show verbatim screenshots in a pitch.

### Prompt battery (15 prompts: swap neighborhood/treatment per client)

**Discovery / "best of" (non-branded):**
1. "Best med spa in [Santa Monica] for Botox"
2. "Who is the best injector for lip filler in [West Hollywood]?"
3. "Best dermatologist in Los Angeles for cosmetic treatments like Botox and lasers"
4. "I want natural-looking Botox results. Who should I go to in LA?"
5. "Best place to get Morpheus8 [or client's hero treatment] in Los Angeles"
6. "Affordable but reputable med spa near [Beverly Hills]"
7. "Where should I get filler for the first time in LA? I'm nervous about looking overdone"
8. "Best medical spa in LA with an actual doctor on site"

**Comparison / validation:**
9. "Is [Practice Name] a good med spa? What do reviews say?"
10. "[Practice Name] vs [top local competitor]. Which is better for injectables?"

**Branded fact-checks (hallucination detection):**
11. "Tell me about [Practice Name] in [neighborhood]. Who are the providers and what are their credentials?"
12. "How much does Botox cost at [Practice Name]?"
13. "What treatments does [Practice Name] offer? Do they do [a service they DON'T offer]?"

**Informational-with-local-intent (content opportunity finder):**
14. "How much does Botox cost per unit in Los Angeles in 2026?"
15. "How do I choose a safe med spa in California? What credentials should the injector have?"

---

## 5. What "Fixing" Visibility Actually Looks Like

Ranked for a solo operator, one client at a time, effort vs. impact:

| Rank | Action | Effort | Impact | Evidence |
|---|---|---|---|---|
| 0 | **Crawlability check**: robots.txt not blocking OAI-SearchBot/PerplexityBot; indexed in Google, Bing, and findable in Brave Search; facts in server-rendered HTML, not only in booking widgets | Low (1 hr) | Gate. Nothing else works without it | Confirmed |
| 1 | **GBP + Yelp + Bing Places completeness pass**: every service listed as GBP services/categories, correct primary category, Q&A seeded, photos, hours; **Yelp especially** (3.4× local AI citations; direct Perplexity feed); claim Bing Places (ChatGPT pathway) | Low (2–4 hrs once) | High on Gemini/AI Mode + Perplexity; medium ChatGPT | Confirmed |
| 2 | **Get into listicles**: find every "best med spa/injector in [LA/neighborhood]" article AI engines currently cite (they show their sources; harvest citations from your audit runs); pitch inclusion, offer updated info, or pay where placement is paid | Medium (outreach) | **Highest single lever** for "best of" prompts | Confirmed |
| 3 | **Review depth on Google + Yelp + RealSelf**: coach client to get reviews that *name treatments and providers* ("Dr. X did my Dysport") = retrievable text; RealSelf profile claimed + Q&A answered | Low ongoing (client does the asking) | High, compounding; Yelp directly cited by Perplexity | Confirmed |
| 4 | **On-site answer content**: one page per hero treatment with LA-specific pricing ranges, provider credentials in text, direct-answer formatting, FAQ blocks; add stats/citations per Princeton GEO findings | Medium (you write it) | Medium-high for informational + branded prompts; also your hallucination defense (published ground truth) | Confirmed for content-feature effects |
| 5 | **Consistent NAP + credential citations**: state board profile, Healthgrades/Vitals/RealSelf/Yelp all matching the fact sheet | Low | Medium; mostly accuracy insurance | Partially confirmed |
| 6 | **Reddit presence**: genuine participation where the practice's patients already get discussed; get real patients to mention them; never astroturf (bans + Reddit is exactly where fake posts get called out) | High, slow, risky | High *when organic*; hard to manufacture | Confirmed at aggregate; risky tactic |
| 7 | **Local digital PR**: pitch the lead injector as expert source to LA lifestyle press; brand mentions correlate with citations more than backlinks | High | Medium-high, slow | Confirmed correlation |
| 8 | **Schema markup** (MedicalBusiness, Physician, FAQPage) | Low if site allows | Low direct; hygiene | Confirmed indirect-only |
| 9 | Wikipedia, llms.txt | N/A | Skip | Confirmed skip |

**A month-one engagement is realistically #1 + #3 + #4 + the audit; #2 is the ongoing needle-mover you work every month.**

---

## 6. Competitive Landscape

**The niche is not empty, but it's early and shallow.** What exists as of mid-2026:

- Med-spa-specialized shops already selling "AI SEO/GEO": **Med Spa Magic Marketing** (AI SEO/AEO/GEO messaging), **Pronk** (explicit "AI Search Optimization for Med Spas", schema, entity/knowledge-graph work), **Avante Visibility** (free "AI Visibility Score" lead magnet for med spas), **Market Disruptors Agency**, **Salt Marketing**, **KellyWM** (content/guides), plus YouTube consultants. (URLs in sources list.)
- The **big med-spa agencies (PatientGain, Growth99, MyAdvice, Cardinal, Influx, Studio III) do not yet show dedicated GEO service pages** in my searches, the incumbents haven't productized this. **[Confirmed absence in search results; verify before quoting in a pitch]**
- Almost everything on offer is **rebranded SEO with AI keywords sprinkled in**, schema, content, listings. **Nobody I found sells the accuracy/hallucination-monitoring angle as the core product.** That's your differentiation, and it happens to be the angle that maps to medical liability sensitivity rather than to marketing budgets.

Honest read: "GEO for med spas" as a phrase is contested; "AI accuracy monitoring for medical practices" is open. Lead with the second, deliver the first.

---

## 7. Pricing & Sales Angle

### What they already pay (sanity check)

| Service | Typical monthly |
|---|---|
| Local SEO retainer | $800–$3,000 (mid-market clinics $1,500–2,500) |
| Google Ads management | $1,000–5,000 + ad spend |
| Social media management | $300–3,000 |
| Full-service agency (PatientGain: $1,699–2,499 published) | $2,000–5,000 single location |
| GEO *software alone* (Otterly/Scrunch/Athena/Goodie tiers) | $100–500 |

Marketing budget benchmarks: 5–12% of revenue; a $1M/yr med spa plausibly budgets $8–12K/mo total. A Botox-only patient is worth ~$6–8K over 5 years; cross-sold patients $15–25K lifetime. ([patientgain.com](https://www.patientgain.com/med-spa-marketing-packages), [kellywm.com](https://kellywm.com/blog/med-spa-marketing-cost), [optimal.dev](https://www.optimal.dev/blog/marketing-budget-breakdown-2025))

**$300–500/mo verdict: comfortably under the decision threshold.** It's less than their social budget and about what the software alone costs. One retained patient pays for a year of your service. That's the ROI sentence to use. If anything, $500/mo underprices the done-for-you version once you have case studies; consider $500 with a $750–1,000 tier that includes the monthly fix work, not just monitoring.

### Three cold outreach angles

**Angle 1: The screenshot (accuracy/fear, strongest opener):**
> Subject: What ChatGPT says about [Practice Name]
> "I asked ChatGPT and Perplexity what they tell patients about [Practice Name]. One of them [got your Botox pricing wrong / listed services you don't offer / recommended [Competitor] instead when asked for the best injector in [neighborhood], attached screenshot]. Courts have already ruled AI companies aren't liable when their answers about a business are wrong, so nobody's checking this unless you are. I run monthly AI-accuracy audits for aesthetic practices: what the four major AIs say about you, what's false, and how we fix it at the source. $[X]/mo, cancel anytime. Want the full audit I ran on you? It's yours either way."

**Angle 2: The competitor gap (greed):**
> "When someone asks ChatGPT for the best med spa in [neighborhood] for [treatment], it names [Competitor A] and [Competitor B]. You don't appear. I ran it 9 times across 4 AI platforms; you showed up once. Patients under 40 increasingly start there instead of Google. The fix is mostly about which sources the AI reads, reviews, local rankings, and how your site answers questions. I do this for aesthetic practices for $[X]/mo. Happy to send the 9 screenshots."

**Angle 3: The category-timing angle (authority, for the marketing-savvy owner):**
> "You already pay for SEO and ads. Neither controls what AI assistants say when patients ask them, and that's now a double-digit share of how people research providers. The agencies serving med spas haven't built this yet; the software that tracks it costs $500/mo and comes with no hands-on-keyboard. I'm offering the done-for-you version at $[X]/mo: monthly monitoring across ChatGPT, Perplexity, Gemini, and Claude, an accuracy report your compliance side will care about, and the source-level fixes that move recommendations. First month includes a full baseline audit."

*(The "double-digit share" claim in Angle 3 is directionally supported but soft; either soften to "a fast-growing share" or find one current stat you're willing to defend before using it.)*

---

## One-Page Action Plan: This Week, $0 Budget

**Day 1: Pick 3 targets.** Mid-size practices (2–8 providers) in distinct neighborhoods (e.g., one Santa Monica med spa, one WeHo injector-led practice, one Beverly Hills cosmetic derm). Pick ones with decent reviews but no huge agency footprint. They're invisible to AI but credible enough to be *fixable*. Avoid celebrity practices (already cited everywhere; no pain).

**Day 1–2: Build mini fact sheets** (30–45 min each): providers + credentials (verify on the CA medical/nursing board lookups), services, pricing from their site, hours, review counts. This is Section 2's table, abbreviated.

**Day 2–3: Run the audit.** The Section 4 protocol: 15 prompts × 4 engines, "best of" prompts 3×, fresh/temporary chats, screenshot everything, log mentions/competitors/citations/factual claims in one spreadsheet per practice. Budget ~2–3 hrs per practice. Harvest the cited-source URLs. Note which listicles and review pages the engines are actually reading for their neighborhood.

**Day 3–4: Write 3 one-page audit reports.** Format each as: (1) visibility scoreboard, mentions per engine out of runs, vs. 2 named competitors; (2) accuracy findings, every false/stale claim, severity-flagged, with screenshot; (3) the three sources AI is citing that they're absent from; (4) three fixes you'd make in month one. Keep it to one page + screenshot appendix. The screenshot of an AI saying something wrong about *them* is the whole sales asset.

**Day 4–5: Pitch.** Email the owner/manager (find via GBP, Instagram DM as fallback, med spa owners live on IG) using Angle 1, attaching one finding, not the whole report. Offer: "15-minute call and I'll walk you through the rest." Price at $400–500/mo, month-to-month, first deliverable = full baseline + fix list. Ask each no for a referral.

**Deliverable cadence once signed (fits ~4 hrs/client/mo):** monthly re-run of the prompt battery → delta report (visibility + accuracy) → 2–3 fixes executed per month from the Section 5 table, starting with GBP/listings/reviews, then one answer-formatted treatment page, then listicle outreach using the exact sources harvested from audits.

---

### Key source list
- Engine pipelines: help.openai.com/articles/9237897-chatgpt-search; developers.google.com/search/docs/appearance/ai-features; theverge.com (Perplexity×Yelp, Mar 2024); techcrunch.com (Claude×Brave, Mar 2025)
- Citation studies: tryprofound.com/blog/ai-platform-citation-patterns; tryprofound.com/blog/citation-overlap-strategy; foundationinc.co/lab/yelp-ai-local-discovery; yext.com/about/news-media/ai-citations-release; ahrefs.com/blog/ai-overview-brand-correlation; ahrefs.com/blog/schema-ai-citations; searchengineland.com/ai-citations-favor-listicles-articles-product-pages-study-472364; seoclarity.net/research/ai-overviews-impact
- Princeton GEO paper coverage: aisearch.global/insights/princeton-geo-paper-explained
- Walters v. OpenAI: reuters.com (May 19, 2025); loeb.com analysis
- Tool pricing: acromatico.com/ai-visibility-tool-pricing-compared; help.otterly.ai/pricing-of-otterlyai; nicklafferty.com/blog/best-generative-engine-optimization-tools-2025
- Med spa marketing costs: patientgain.com/med-spa-marketing-packages; kellywm.com/blog/med-spa-marketing-cost; medspamarketpro.com/best-medspa-marketing-agencies
- Niche competitors: pronkmedspamarketing.com/med-spa-ai-search; avantevisibility.com; medspamagicmarketing.com; marketdisruptorsagency.com; saltmarketing.co
