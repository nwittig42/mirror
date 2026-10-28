# How GEO/AEO Agencies and Platforms Turn an AI-Visibility Audit into a Strategy and To-Do List (2025-2026)

Research date: 2026-10-14. About 17 tool calls. Most sources are vendor or agency marketing; this is flagged throughout. Independent evidence is thin.

## 1. What do GEO platforms produce as "recommendations" / "actions", how specific are they, and what inputs drive them?

### Takeaway
The leading platforms all added a "recommendations/actions" layer in 2025-2026 on top of monitoring. It is driven mostly by **citation/source gaps** (where AI cites sources that mention competitors but not you), plus prompt gaps, sentiment and competitor share of voice. Most produce **prioritized categories or content briefs, not finished work**. Prioritization is usually coarse (1-3 score or high/medium/low). Few platforms document task completion tracking. Specificity varies; the most specific outputs name actual cited domains, URLs, phrases and threads, while free graders give generic advice.

### Cited Findings
**Peec AI: "Actions"**
- Splits actions into **On-Page** (gaps in owned content such as product pages, articles, guides) and **Off-Page** (editorial coverage, Reddit and forum discussions, reference sources) — [Peec product page](https://peec.ai/product-actions)
- Inputs: hundreds of cited sources grouped into content-type clusters (e.g. "editorial listicles", "Reddit discussions", "product pages"). Gap logic differs by **Owned / Editorial / UGC**. Also uses competitor frequency per source type, model-specific patterns, common phrases and top domains — [Peec product page](https://peec.ai/product-actions)
- Prioritization: a **"Relative Opportunity Score (1-3)"** that weighs how often AI models cite a source type against how much competitors dominate it relative to the brand. Peec says the reasoning behind each score is visible — [Peec product page](https://peec.ai/product-actions)
- Actions refresh when visibility data refreshes and are included in all plans. Users write and publish content themselves. The product page does not describe per-action completion tracking — [Peec product page](https://peec.ai/product-actions)
- Changelog: "Source Gap Analysis" (Jan 26, 2026) shows where competitors appear but the brand doesn't. Action cards now list recurring themes from their underlying sources. A "Site Crawlability" action checks whether major AI crawlers are blocked in robots.txt — [Peec changelog](https://peec.ai/changelog); [Peec blog: Introducing Actions](https://peec.ai/blog/introducing-actions)
- Third-party criticism: Peec finds gaps but doesn't help close them, since teams still write the content (sponsored or competitor-affiliated sources) — [digitrendz](https://digitrendz.blog/?p=238435); [Wellows](https://wellows.com/alternatives/best-peec-ai-alternatives/)

**Profound: "Actions" (launched July 24, 2025)**
- Inputs: three data streams. These are AI answers and citations, real user prompts, and AI-bot and AI-referral traffic to the site — [Profound blog](https://www.tryprofound.com/blog/introducing-actions); [Profound changelog](https://product.tryprofound.com/changelog/introducing-profound-actions)
- Output: **content briefs**, not finished content. Each brief has AI-aligned topic recommendations, a suggested heading structure, secondary keywords, "specific stats and facts that AI is already citing", and tone guidance. It sits inside a content editor with visibility benchmarks — [Profound blog](https://www.tryprofound.com/blog/introducing-actions)
- The launch post does not explain how items are ranked; it says only that they are "high-impact content opportunities". It claims customers saw "powerful impacts" but gives no numbers (self-reported, unquantified) — [Profound blog](https://www.tryprofound.com/blog/introducing-actions)

**LLM Pulse: "Recommendations"** (the most fully documented to-do-list design found)
- An AI-generated action plan that turns a project's prompt data into prioritized to-do items. Inputs are mentions, citations, sentiment and competitor positioning. **Each recommendation links to the specific queries, citations or threads behind it** so users can check the evidence — [LLM Pulse help center](https://llmpulse.ai/help-center/recommendations)
- **Brand calibration:** the AI classifies the project's size and industry, so "a global enterprise gets PR and original-data plays rather than small-business outreach" — [LLM Pulse](https://llmpulse.ai/help-center/recommendations)
- User settings: free-text guidance (example: "We cannot publish competitor comparisons"), whether paid placements are allowed, whether competitor-comparison content is allowed, and which recommendation types are on — [LLM Pulse](https://llmpulse.ai/help-center/recommendations)
- Categories: Owned Content; Social & UGC (Reddit, YouTube, TikTok, Facebook, Instagram, depending on connected channels); PR & Citation Building; Sentiment & Reputation (Scale plan or above) — [LLM Pulse](https://llmpulse.ai/help-center/recommendations)
- Each item has a **priority (high/medium/low), an estimated impact and specific action items**. Thin data produces a short list or none. There is a cap of 100 items per project per week. Users **mark items completed or archived** and regenerate periodically — [LLM Pulse](https://llmpulse.ai/help-center/recommendations)

**AthenaHQ: "Action Center"** (third-party descriptions only)
- Sorts recommendations into on-page work (new content, existing pages to optimize, structural fixes) and off-page work (forums and subreddits where the brand could build presence). It reportedly maps improvements to "the sources and passages influencing results". Reviewers say recommendation quality varies, and the outreach generator and brand-guidelines features feel underdeveloped — [Dageno AthenaHQ review](https://www.dageno.ai/blog/athenahq-review); [AirOps Scrunch vs Athena](https://www.airops.com/blog/scrunch-vs-athena-comparison-2026). Both are competitor comparisons.
- Positioned as "prioritized, revenue-aware recommendations". Scrunch is positioned more around agent-facing accuracy and misinformation control — [AirOps](https://www.airops.com/blog/scrunch-vs-athena-comparison-2026)
- One ranking describes Scrunch as "monitoring only—lacks built-in content creation or optimization tools" (Evertune's own list, so a competitor) — [Evertune](https://evertune.ai/resources/insights-on-ai/top-15-generative-engine-optimization-geo-platforms-for-2026)

**Otterly.ai: GEO Audit**
- An on-page audit of 25+ factors with "actionable optimization recommendations", priced from about $29/mo. Described as simpler than AthenaHQ's analysis and suited to early-stage teams (third-party) — [AirOps](https://www.airops.com/blog/scrunch-vs-athena-comparison-2026); [metehan.ai tool list](https://metehan.ai/pdf/best-aeo-geo-tools.pdf)

**Ahrefs Brand Radar** (gap discovery rather than a to-do list)
- Mention-gap workflow: in Mentions, choose "Others" to see answers where competitors are mentioned and you aren't. The same steps work for citation gaps — [Ahrefs: How to track AI visibility](https://ahrefs.com/aeo/track-ai-visibility)
- "Cited Pages" gives a URL-level view of which pages AI platforms cite most, to learn which formats and structures win — [Ahrefs Academy: Cited Domains & Pages](https://ahrefs.com/academy/how-to-use-brand-radar/cited-domains)
- Metric definitions: a mention counts when a brand appears at least once in an AI response; citations count responses linking to the brand's URL; impressions are weighted by search demand — [Ahrefs help: AI visibility metrics](https://help.ahrefs.com/en/articles/15501968-ai-visibility-metrics)
- Brand Radar 2.0 added a Topics report that groups queries by parent topic, for topic-level gap prioritization — [Ahrefs blog](https://ahrefs.com/blog/brand-radar/)

**Semrush Enterprise AIO**
- Launched March 2025. It tracks brand mentions across AI platforms, benchmarks them against competitors, and monitors how LLMs cite sources to spot "competitive opportunities" — [Semrush press release via Nasdaq](https://www.nasdaq.com/press-release/semrush-enterprise-unveils-ai-optimization-transforms-how-brands-appear-in-ai-search)
- A March 2026 update shows which prompts and AI models drive visibility, so teams can align content with high-performing queries. The AI Shopping report was extended to ChatGPT and Google AI Mode — [Semrush news](https://www.semrush.com/news/449191-enterprise-aio-extends-ai-shopping-report-across-chatgpt-and-google-ai-mode/)

**HubSpot AEO Grader**
- A free grader covering ChatGPT (GPT-4o), Perplexity and Gemini. It returns a brand perception analysis across five dimensions plus recommendations, which HubSpot notes are AI-generated and not reviewed by a human — [HubSpot AEO Grader](https://www.hubspot.com/aeo-grader?faq=5)
- Third parties describe the recommendations as broad (strengthen external mentions, improve content consistency, update structured data) — [Salesdorado review](https://salesdorado.com/en/ai/review-hubspot-aeo-grader/); [InsideA](https://insidea.com/blog/hubspot/hubspots-aeo-grader/)
- Writesonic markets its "Action Center" as going further than recommendations by executing the work (content and citations), and claims HubSpot AEO "stops at recommendations". This is a competitor's claim — [Writesonic vs HubSpot](https://writesonic.com/compare/writesonic-vs-hubspot-aeo)

### Inferences
- Platforms converge on the same data model: **prompt set × AI engine → answer → mentions, citations (URL/domain), sentiment → competitor comparison → gap → action**. The core idea behind a "recommendation" is that AI cites source X for prompt Y, competitors appear in X, and you don't.
- The **on-page vs off-page (owned / editorial / UGC)** split is the de facto taxonomy across Peec, AthenaHQ and LLM Pulse.
- The strongest credibility pattern is **evidence-linked items**: each to-do links to the prompts, answers and cited URLs that justify it (LLM Pulse, Peec's "visible reasoning"). Generic graders such as HubSpot's free tool don't do this, and they draw the "generic" criticism.
- Calibrating by business size and type (as LLM Pulse does) is a documented way to avoid giving a local plumber enterprise PR advice.
- The gap between finding problems and fixing them is the main competitive split: monitoring-plus-briefs (Profound, Peec) vs execution engines (Writesonic, AirOps).

### Gaps
- No primary documentation was retrieved for Goodie, Bluefish, Evertune, Yext Scout or BrightEdge's recommendation outputs. Scrunch was covered only via competitor comparisons.
- No platform published real example action text showing the exact wording of a recommendation.
- No independent evaluation of whether platform recommendations actually move metrics.

## 2. How do named GEO agencies structure engagements (phases, first 90 days, deliverables, prioritization, reporting)?

### Takeaway
Published agency playbooks follow a near-identical **30/60/90 structure**: (1) baseline audit (prompt set, technical crawl access, source map); (2) fix the highest-value owned pages, plus schema and answer blocks; (3) off-site authority (Reddit, PR, original data), measurement and scale. Prioritization is usually a multi-factor ranking (business value, competitor advantage, effort) rather than a formal published impact × effort matrix. Named large agencies (iPullRank, Siege) describe audits in marketing terms but don't publish sample deliverables.

### Cited Findings
- **iPullRank** (April 2026): the AI search audit is "not a checklist but a full diagnostic". It starts with technical health (crawlability for AI systems), then measures how content maps to "the way your audience actually asks questions" — [iPullRank AI Search Audit](https://ipullrank.com/ai-search-audit)
- iPullRank audit components (agency's own LinkedIn): technical health, **passage-level relevance**, entity coverage, knowledge-graph signals, competitor visibility, and **synthetic AI search queries** (query fan-out), scored with proprietary "Relevance Engineering" metrics — [iPullRank LinkedIn](https://linkedin.com/company/ipullrank); [iPullRank Relevance Engineering](https://ipullrank.com/relevance-engineering). A third-party teardown says audits are tiered by client exposure — [Something Inc.](https://somethinginc.com/blog/relevance-engineering-agency-teardown/). iPullRank also sells an "AI Search Strategy Program" — [iPullRank](https://ipullrank.com/ai-search-strategy-program)
- **Superlines 90-day plan** (vendor; the most detailed public methodology found):
  - Days 1-30: build a prompt set across buyer stages (awareness → decision, branded and non-branded), tracked daily. Measure each AI platform separately rather than as one blended score. Map the "source ecosystem" (domains that shape answers, including those supporting competitors). Run a technical check (robots, blocked crawlers, rendering, content behind login, canonicals). Output a prioritized problem list.
  - Days 31-60: fix existing high-value pages first (product, pricing, comparison, docs, category). Use query fan-outs as diagnostics without creating a page per phrase. Create new content only for genuinely unmet needs. Correct outdated third-party info and profiles, avoiding "manipulative citation tactics".
  - Days 61-90: compare against baseline and require about 3-4 weeks of trend data before judging. Expand to the next cluster. Tie results to referral traffic, demos and pipeline.
  - **Prioritization factors:** business value, buyer journey stage, current visibility, competitor advantage, size of the information gap, number of platforms affected, difficulty of the fix.
  - Source: [Superlines](https://superlines.io/articles/90-day-geo-plan-ai-search-visibility)
- **Discovered Labs timeline** (agency; self-interested):
  - Days 1-30: a visibility audit across ChatGPT, Claude, Perplexity and AI Overviews in week 1. Organization and Product schema on the homepage, FAQ schema on landing pages, 40-60-word answer blocks at the top of pages, entity markers in the first 100 words, and 20+ optimized pieces.
  - Days 31-60: 10-15 authentic Reddit/Quora discussions, one original data asset, UTM tagging for AI referrals.
  - Days 61-90: per-platform citation analysis, comparison content, refreshes of old pages with current dates and stats, a competitive share-of-voice report, and a "board-ready summary".
  - Source: [Discovered Labs](https://discoveredlabs.com/blog/geo-timeline-when-to-expect-results-30-60-90-day-benchmarks/)
- Other agency 90-day plans share the shape. Mapping 10-20 high-intent prompts and fixing crawl, schema and speed blockers comes first. Reworking 3-5 revenue pages (headings, summaries, FAQ blocks, structured data) follows, then citations and thought leadership, Reddit/LinkedIn, and finally reporting. One plan includes an **escalation checkpoint if baseline metrics don't move by Day 45** — [upgrowth](https://upgrowth.in/geo-first-90-days-what-to-expect); [DerivateX 90-day sprint](https://derivatex.agency/blog/90-day-geo-sprint/); [Hashmeta](https://hashmeta.com/ph/posts/building-ai-first-search-strategy-working-with-geo-agency)
- **Pricing datapoint:** Perrill sells a standalone GEO roadmap with a 30-60-90 plan for $8,500 (single vendor) — [Perrill](https://www.perrill.com/?p=170229)
- **Local businesses:** the SOCi 2026 Local Visibility Index (cited secondhand) found ChatGPT recommended about 1.2% of roughly 350,000 analyzed locations, against 35.9% appearing in Google's local 3-pack. Profile accuracy was about 68% on ChatGPT and Perplexity vs 100% on Gemini, which uses Google Maps data — [via insites/SEJ results set](https://insites.com/selling-ai-visibility-to-local-business-clients) (secondhand, verify against SOCi)
- Local to-dos recommended across agency guides: complete and optimize the Google Business Profile; build reviews on Google and Yelp; keep NAP consistent everywhere ("conflicting information can cause AI tools to skip your business"); add FAQPage schema with location-specific Q&As — [Zarla](https://www.zarla.com/guides/how-to-get-your-business-recommended-by-chatgpt); [Omni Online Strategies](https://omnionlinestrategies.com/blog/ai-visibility-for-local-businesses); [The Ad Firm](https://www.theadfirm.net/?p=42344)
- Zarla (vendor) observes that coverage thins below city level. For suburb-level prompts ChatGPT often names nobody, while city-level prompts reliably produce a list — [Zarla](https://www.zarla.com/guides/does-chatgpt-recommend-local-businesses)
- A local GEO baseline audit guide exists, but its content was not retrieved — [seo-day.de](https://www.seo-day.de/news/article/how-to-run-a-local-geo-baseline-audit?lang=en)

### Inferences
- A credible generated roadmap can mirror the agency consensus:
  - **Phase 1 (fix blockers):** crawler access, schema, entity and NAP accuracy.
  - **Phase 2 (owned pages):** rewrite the specific pages that should answer the specific lost prompts.
  - **Phase 3 (earned sources):** get onto the specific domains and threads AI already cites for competitors.
  - **Phase 4:** re-measure against the baseline.
- **SaaS/B2B vs local:** B2B playbooks center on comparison, pricing and docs pages, original data, Reddit and LinkedIn, and pipeline attribution. Local playbooks center on Google Business Profile, reviews, NAP and directory consistency, and location-specific FAQs, with Gemini and AI Overviews depending on Google Maps data. A per-business generator should switch task libraries by business type.
- Prioritization in practice means **business value × competitor advantage × gap size, discounted by effort**. Peec's 1-3 score is a simplified version of this.

### Gaps
- No public engagement structures or sample deliverables were found for First Page Sage, NoGood, Graphite, Animalz, Directive or Omniscient Digital (searches surfaced only roundups). Their monthly deliverable formats are unverified.
- No formal published "impact × effort" matrix from a named GEO agency was found. The multi-factor lists above are the closest.
- BrightLocal's own AI-visibility checklist was not surfaced.

## 3. What KPIs do they use, what timelines do they promise, and are there case studies with numbers?

### Takeaway
Standard KPIs are **brand visibility/mention rate, citation rate (own-domain URLs), share of voice vs competitors, sentiment and accuracy, and position**, later tied to AI-referral traffic and pipeline. Agencies promise **first citations in roughly 30-60 days and meaningful movement by about 90 days**, while warning against two-week promises. Public before/after numbers are scarce and almost all self-reported.

### Cited Findings
- KPI definitions:
  - **Brand Visibility** is the share of tracked responses that mention the brand.
  - **Citation Rate** is how often AI cites your own website, measured separately.
  - **Sentiment** covers tone, accuracy, category placement and competitive context.
  - Supporting metrics are AI share of voice, position, citation share, cited URLs, competitor visibility and business outcomes.
  - Superlines recommends measuring each platform separately and waiting for 3-4 weeks of trend data before judging.
  - Source: [Superlines](https://superlines.io/articles/90-day-geo-plan-ai-search-visibility)
- Ahrefs separates mentions, citations and demand-weighted impressions — [Ahrefs help](https://help.ahrefs.com/en/articles/15501968-ai-visibility-metrics)
- Discovered Labs 90+ day KPIs: share of voice, citation stability, cost per AI-sourced customer, brand accuracy, and weekly monitoring for drops after model updates. It says the main 30-day signal is fewer hallucinations about the brand, not citations — [Discovered Labs](https://discoveredlabs.com/blog/geo-timeline-when-to-expect-results-30-60-90-day-benchmarks/)
- Timeline claims:
  - First citations in 30-60 days (4-8 weeks), vs 6-12 months for traditional SEO (Frase, cited by Discovered Labs).
  - Discovered Labs' own unsourced estimate: 20+ pieces/month for its timeline, while 10-15 pieces extends it to 4-6 months.
  - The "65% visibility gains in 90 days for Q2 2025 adopters" figure is unverified and traced to vendor content.
  - Source: [Discovered Labs](https://discoveredlabs.com/blog/geo-timeline-when-to-expect-results-30-60-90-day-benchmarks/); [DerivateX](https://derivatex.agency/blog/90-day-geo-sprint/)
- "If someone promises AI search visibility in first two weeks, they do not understand how GEO works" — [upgrowth](https://upgrowth.in/geo-first-90-days-what-to-expect)
- Conversion context (third-party): LLM traffic converted to sign-ups at 1.66% vs 0.15% from search (Microsoft Clarity data via Digiday, 1,200+ publishers). Ahrefs: AI search visitors were 12% of signups from 0.5% of traffic — both as cited in [Discovered Labs](https://discoveredlabs.com/blog/geo-timeline-when-to-expect-results-30-60-90-day-benchmarks/)
- Case studies (**all self-reported**):
  - Siege Media / Instacart: "46.5K citations in LLMs" plus +451K organic blog traffic and $73K traffic value, with no timeframe or method shown — [Siege Media](https://www.siegemedia.com/?p=31434)
  - Siege also claims Mentimeter got 250,000 ChatGPT visits (details not retrieved) — [Siege Media](https://www.siegemedia.com/seo)
  - DerivateX: Gumlet "turned ChatGPT mentions into 20% of inbound revenue" — [DerivateX](https://derivatex.agency/blog/90-day-geo-sprint/)
  - A B2B SaaS author claims +280% AI citations in 60 days after restructuring an article to lead with a statistic and adding 8-10 citations per 1,000 words, with no baseline given — [guptadeepak.com](https://guptadeepak.com/the-complete-guide-to-generative-engine-optimization-what-b2b-saas-companies-need-to-know-in-2026/)
- Academic baseline: the Princeton GEO paper (KDD 2024) reported citation-visibility improvements of up to about 40% from techniques such as adding statistics, quotations and citations. This is cited secondhand here; check the original paper — [xseek summary](https://www.xseek.io/blogs/articles/what-are-the-best-geo-tactics-and-tools)

### Inferences
- A generated to-do list should attach each task to the **specific KPI and prompts it is meant to move**, and re-measure on a 3-4-week horizon rather than weekly.
- Honest timeline framing (setup in weeks 0-4, early citations in weeks 4-8, trend by day 90) matches industry norms and avoids the "guaranteed rank" red flag.

### Gaps
- No independent (non-vendor) before/after case study with a stated method, prompt set and baseline was found.
- No local-business case study with numbers was found.

## 4. Common criticisms, and what makes a strategy credibly specific?

### Takeaway
The main criticisms are dashboards without execution, generic AI-generated advice, vanity scores, single-screenshot "proof", guaranteed "ChatGPT rankings", and opaque prompt selection. Credibility comes from transparent sampling methodology, keeping mentions, citations, accuracy and share separate, showing source URLs, evidence-linked tasks, and work that improves real evidence (content, reviews, profiles, PR) rather than promising to control AI wording.

### Cited Findings
- **Red flags:** guaranteeing a specific ChatGPT rank; claims of "secret" or direct submission to AI; no explanation of how prompts are chosen; one-off screenshots as proof ("an anecdote, not a monitoring system"); no interest in positioning, customers or competitors; ignoring SEO basics; confusing a mention with a citation — [SBO.sg](https://sbo.sg/business/marketing/geo-monitoring-tools-agencies-ai-visibility/)
- More from the same source:
  - "Being mentioned wrongly is not a win."
  - Monitoring "must be designed like sampling, not like a scoreboard."
  - If a tool "cannot explain its methodology, the dashboard is decoration."
  - An agency that can't explain uncertainty is "hiding the hard part."
  - "Buy the tool if it helps you learn. Hire the agency if it improves your evidence."
  - Source: [SBO.sg](https://sbo.sg/business/marketing/geo-monitoring-tools-agencies-ai-visibility/)
- Christopher Penn (Trust Insights, Feb 2026) argues that many AI-optimization tools rely on "deceptive and inaccurate claims". The page returned 403, so this is from a search snippet — [Christopher Penn](https://www.christopherspenn.com/2026/02/mind-readings-the-truth-about-geo-tools/)
- A hands-on review of five platforms found "most platforms help teams understand the problem, while few help them execute against it" — [HackerNoon](https://hackernoon.com/why-most-geo-tools-fail-at-ai-search-visibility-and-what-actually-works)
- Brand-level mention totals without per-query breakdown are "a lot less useful than [they look]". API-only sampling can diverge from live consumer answers — [search result set incl. Superlines](https://superlines.io/articles/best-generative-engine-optimization-tools); [StartupHub roundup (drew on r/SEO, r/DigitalMarketing, r/b2bmarketing)](https://www.startuphub.ai/news/best-geo-ai-visibility-tools)
- HubSpot's free grader states its recommendations are AI-generated and not human-reviewed. Third parties call them broad — [HubSpot](https://www.hubspot.com/aeo-grader?faq=5); [Salesdorado](https://salesdorado.com/en/ai/review-hubspot-aeo-grader/)
- Superlines warns against creating a page for every fan-out phrase and against "manipulative citation tactics". Its recommended alternative is to create content only for genuinely unmet needs (an anti-slop stance) — [Superlines](https://superlines.io/articles/90-day-geo-plan-ai-search-visibility)
- Reviewers say AthenaHQ action quality "varies" — [Dageno](https://www.dageno.ai/blog/athenahq-review)

### Inferences
What makes an auto-generated to-do list credibly specific, distilled from the above:
1. Each task names the **exact prompt(s)** lost, the **AI engine(s)**, the **competitor(s)** that won, and the **cited URL or domain** behind the answer.
2. Each task names the **specific asset to change**: "add a pricing FAQ to /pricing", not "improve content". For off-page work, it names the specific domain, listicle or Reddit thread.
3. Each task carries a **priority with visible reasoning** (citation frequency × competitor dominance × business value ÷ effort).
4. Each task has a **target metric and re-check date**, and items move through open, done and re-measured states (LLM Pulse's completed/archived model).
5. **Business-type calibration** (local vs SaaS) and **user constraints** (no comparison pages, no paid placements).
6. **Accuracy fixes** (wrong hours, pricing or features in AI answers) are listed as their own high-priority category, since a wrong mention isn't a win.
7. Return a short list when data is thin rather than padding it with generic advice.

### Gaps
- No actual Reddit r/SEO or r/bigseo threads were retrieved directly. Practitioner sentiment is secondhand via roundups.
- No G2 review text specifically about recommendation quality was retrieved. Only one aggregate mention says Profound users appreciate its "actionable recommendations" — [G2 Profound reviews](https://g2.com/products/profound/reviews_and_filters?page=3)
