# Sizing AI-assistant demand for a business category and location (as of October 2026)

Research date: 13 Oct 2026. Source quality is flagged per line: **[primary]** = vendor doc / original study read directly; **[secondary]** = aggregator or third-party write-up, not checked against the original; **[search-snippet]** = taken from a search summary of the page, not a full read. Several requested sources (OpenAI's own page, Datos full reports, Similarweb/Semrush methodology pages) could not be opened; see Gaps.

---

## 1. Which products publish AI prompt / "AI search volume" data, how do they get it, what does it cost, is there an API?

### Takeaway
No AI platform (except Microsoft Copilot, per Ahrefs) shares real query data, so every "AI search volume" number is either (a) a small opt-in panel extrapolated up, (b) Google search volume multiplied by a ratio, or (c) derived from Google's People Also Ask data. The two cheapest, API-accessible and most transparent options for a small company are DataForSEO AI Keyword Data (about $0.0001 per keyword, which Mirror already has access to) and re-implementing Ahrefs' published platform ratios on top of Google Keyword Planner volume.

### Cited Findings

**DataForSEO AI Optimization API (already a Mirror vendor)**
- AI Keyword Data "keywords search volume" endpoint returns `ai_search_volume` (latest month) and `ai_monthly_searches` (12-month trend) per keyword. **[primary]** — [DataForSEO docs](https://docs.dataforseo.com/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live.md)
- Method, verbatim: "The AI Search Volume values are calculated using statistical data from questions in the 'People Also Ask' SERP element." It is therefore modelled from Google SERP data, not measured from AI logs or a clickstream panel. The docs do not name which AI tools it represents (only "AI tools"). **[primary]** — [DataForSEO docs](https://docs.dataforseo.com/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live.md)
- Limits: up to 1,000 keywords per task, 250 characters per keyword, Live method only, 2,000 API calls/minute, 30 simultaneous requests. **[primary]** — [DataForSEO docs](https://docs.dataforseo.com/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live.md)
- Location: `location_name` or `location_code` is required (examples given are countries: "United Kingdom", 2840 = United States). The page does not state whether sub-national (city/metro) codes are accepted. **[primary]** — [DataForSEO docs](https://docs.dataforseo.com/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live.md)
- Price: AI Keyword Data (Live) listed at $0.0001 per keyword, $110 per 1M, about 2 s average; $1 free trial credit, $50 minimum top-up. **[search-snippet of vendor page]** — [DataForSEO AI Optimization API](https://dataforseo.com/ai-optimization-api)
- For comparison, DataForSEO's Google Ads (Keyword Planner) search volume is a separate product priced around $0.09 per 1,000 keywords. **[search-snippet]** — [DataForSEO Keyword Planner API](https://dataforseo.com/keyword-planner-api)
- LLM Mentions API: returns mention counts plus an `ai_search_volume` rate per month; platform is either `google` (AI Overview) or `chat_gpt`; history from 2025-08-01; default location 2840 (US) and "chat_gpt data is available for United States only". Cost is on the pricing page, not in the docs. **[search-snippet of vendor docs]** — [DataForSEO LLM Mentions docs](https://docs.dataforseo.com/v3/ai_optimization-llm_mentions-historical-live/)
- The sample response in the docs shows `ai_search_volume` of 0 for some 2024 months with no explanation. **[primary]** — [DataForSEO docs](https://docs.dataforseo.com/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live.md)

**Ahrefs Brand Radar ("AI adjusted volume")**
- Method: for each prompt, take the Google search volume of its parent keyword and multiply by a platform-specific ratio. Prompts are sourced from People Also Ask questions; if several keywords share a question, the highest-volume keyword is used. Ratios come from "Ahrefs' aggregated website traffic data", comparing traffic from each AI platform with Google organic traffic. Went live 31 Aug 2026 (before that, every platform showed the same volume). **[primary]** — [Ahrefs help center, 3 Sep 2026](https://help.ahrefs.com/en/articles/16755865-what-is-ai-adjusted-volume-and-how-is-it-calculated)
- Published ratio table (see section 3 for the numbers). **[primary]** — [Ahrefs help center](https://help.ahrefs.com/en/articles/16755865-what-is-ai-adjusted-volume-and-how-is-it-calculated)
- Ahrefs explicitly says the metric is "not suitable for estimating AI-only addressable market size" or for measuring how many people saw a brand in a specific response; it is directional. **[primary]** — [Ahrefs blog, 17 Aug 2026](https://ahrefs.com/blog/how-ahrefs-estimates-ai-search-demand/)
- Pricing (conflicting third-party reports): "from $199/mo" on the main pricing page vs $398/mo (select platforms) and $699/mo (all platforms) on the Brand Radar page. Prompt database size claims range 260M to 477M monthly prompts. **[secondary, competitor blog]** — [Ryze AI pricing guide](https://www.get-ryze.ai/blog/ahrefs-brand-radar-pricing-2026)

**Profound Prompt Volumes**
- Method per Profound's help docs: licenses AI answer-engine conversations, cleans them, and applies probabilistic modelling to extrapolate. Engines covered: ChatGPT, Gemini, Claude, Perplexity. **[search-snippet of vendor help doc]** — [Profound knowledge base](https://profound-knowledge-base.help.usepylon.com/articles/4288109168-prompt-volumes)
- A third-party review describes the source as anonymized, double-opt-in consumer-panel conversations updated weekly. **[secondary]** — [Trakkr review](https://trakkr.ai/reviews/profound-review/data-accuracy)
- Profound says its models "correct for biases in demographics, geography, and churn" (panel projection). Dataset size claims conflict between Profound's own pages: "tens of millions" vs "hundreds of millions" of conversations. Refresh latency is stated as under one week on the product page and under two weeks in a May 2026 FAQ. **[search-snippet of vendor pages]** — [Profound blog](https://www.tryprofound.com/blog/prompt-volumes-general-availability); [Profound changelog](https://product.tryprofound.com/en/changelog/new-prompt-volumes-features-available-now)
- Pricing: $99/mo Starter (ChatGPT only) and $399/mo Growth (3 engines) as of June-July 2026; Enterprise unpublished. Reviewers report that the demand data (Prompt Volumes) sits in the Enterprise tier; this is a reviewer's reading, not confirmed by Profound. **[secondary]** — [geotoolbox](https://geotoolbox.ai/blog/profound-pricing); [fixaeo review](https://fixaeo.com/blogs/profound-ai-review/)

**Semrush (AI toolkit / Prompt Research) and Datos**
- Semrush Prompt Research advertises 317M+ AI prompts refreshed monthly, 42 geographic AI prompt databases (country-level markets), covering ChatGPT, Perplexity, Gemini, AI Mode. **[search-snippet of vendor page]** — [Semrush Prompt Research](https://nl.semrush.com/features/prompt-research/)
- Datos is a Semrush company and runs a clickstream panel of "millions of users across the US, UK, and EU"; it publishes quarterly State of Search reports with SparkToro. **[primary, event page]** — [Datos](https://datos.live/event/datos-pulse-of-the-web-state-of-search-q1-2026-on-demand/)
- Semrush published a ChatGPT search study based on 80 million clickstream records. **[search-snippet, title only]** — [Semrush news](https://www.semrush.com/news/379285-new-semrush-study-reveals-chatgpt-search-trends-insights-from-80-million-clickstream-records/)

**Similarweb Gen AI Intelligence**
- Toolkit combines AI Brand Visibility and AI Traffic, including the prompts that drive AI traffic to a site ("Prompt Analysis"). **[secondary]** — [Business Wire, 28 Jul 2025](https://www.businesswire.com/news/home/20250728784234/en)
- No public price; Similarweb moved to sales-quoted suites in Q3 2025. One tracker reports a median contract of $107,200/yr from 4 buyer reports (directional only). **[secondary]** — [PricingSaaS](https://pricingsaas.com/companies/similarweb/diffs/2025Q3); [Costbench](https://www.costbench.com/software/seo-tools/similarweb/)

**Scrunch**
- Scrunch describes prompt volume as "fragile" and directional. It combines clean-slate AI response collection, "consented consumer panels", cross-platform monitoring, and validation against citations, agent traffic and AI referrals. States "No AI platform provides a native, first-party prompt feed today." **[primary]** — [Scrunch help center, 4 Sep 2026](https://helpcenter.scrunchai.com/en/articles/13146531-understanding-prompt-volume-in-ai-search)

**Peec, Otterly, AthenaHQ (tracking tools; prices from competitor blogs, treat as approximate)**
- Otterly: $29 / $189 / $489 per month, Enterprise from about $1,000. Peec: about $95/mo starter (50 prompts). AthenaHQ: $295/mo self-serve (another source says $499). **[secondary, competitor blogs]** — [Ryze AI comparison](https://www.get-ryze.ai/blog/ai-visibility-tools-pricing-compared-2026); [Writesonic](https://writesonic.com/blog/peec-ai-vs-otterly-ai)
- Peec has published its own research estimating ChatGPT's search volume as roughly 4-12% of Google's (Oct 2025). **[search-snippet]** — [Peec docs](https://docs.peec.ai/research/chatgpt-google-market-share)

**SparkToro**
- SparkToro's "Search & AI Tools" feature shows, for a given audience, what share uses Google vs AI tools; in March 2026 it was rebuilt on Datos search-and-prompting activity after admitting the earlier version used site visitation. **[search-snippet of primary]** — [SparkToro blog, Mar 2026](https://sparktoro.com/blog/how-much-is-your-audience-searching-google-vs-prompting-ai-tools-sparktoros-answers-just-got-an-upgrade/)

### Inferences
- There are only three real methodologies behind every product: panel extrapolation (Profound, Semrush/Datos, Similarweb, Scrunch), Google-volume-times-ratio (Ahrefs), and PAA-derived modelling (DataForSEO). Anything else is a repackaging.
- For Mirror, the most defensible low-cost stack is: Google Keyword Planner local volume (via DataForSEO) x a published, citable ratio (Ahrefs' table), cross-checked against DataForSEO `ai_search_volume` for the same keywords at national level. Both inputs have a public URL describing the method.
- Because DataForSEO and Ahrefs both anchor on Google/PAA data, they are not independent confirmations of each other; they are two modelled views of the same underlying Google demand.

### Gaps
- Could not confirm from DataForSEO docs whether AI Keyword Data accepts city/DMA location codes, nor which LLMs it represents. The linked DataForSEO help-center article explaining the calculation was not found. Needs a direct call to the `locations_and_languages` endpoint (cheap to test).
- LLM Mentions API price not found.
- Semrush AI toolkit price and the exact source of its 317M prompts not confirmed (likely Datos panel, but no source says so).
- Similarweb's prompt-collection method not found.
- No information found on Writesonic's or AthenaHQ's prompt-volume methodology.

---

## 2. Latest usage numbers and what share of prompts is search-like, shopping or local

### Takeaway
ChatGPT is at roughly 900M weekly users (2026, secondary sources) and about 2.5B prompts/day (a July 2025 figure still being recycled); Gemini app is 950M monthly users and Google AI Mode over 1B monthly users (Alphabet Q2 2026). Only about a quarter to two-thirds of ChatGPT prompts are search-like depending on definition, and no published study isolates a "local business" share.

### Cited Findings

**ChatGPT**
- 18 billion messages/week, about 2.5B/day, as of July 2025, with about 700M weekly active users at that time (OpenAI/Harvard NBER paper). **[secondary citing primary]** — [Ahrefs, 11 Feb 2026](https://ahrefs.com/blog/chatgpt-has-12-percent-of-googles-search-volume/); [NBER w34255](https://www.nber.org/papers/w34255)
- 900M weekly active users as of Feb-Apr 2026, up from 400M a year earlier. **[secondary aggregators; OpenAI primary not checked]** — [getairefs](https://getairefs.com/blog/chatgpt-user-statistics/); [searchlab](https://searchlab.nl/en/statistics/chatgpt-statistics-2026)
- About 330M of daily messages come from the US. **[secondary, unverified]** — [wisernotify](https://wisernotify.com/blog/chatgpt-users/)
- The 2.5B/day figure quoted in 2026 sources is the July 2025 number; no newer official prompts-per-day figure was found. **[primary for the dating]** — [Ahrefs, 11 Feb 2026](https://ahrefs.com/blog/chatgpt-has-12-percent-of-googles-search-volume/)

**Intent mix of ChatGPT prompts (NBER "How People Use ChatGPT", Sept 2025; data May 2024 to July 2025)**
- Practical Guidance, Seeking Information and Writing together are nearly 80% of conversations. **[search-snippet of primary]** — [NBER w34255](https://www.nber.org/papers/w34255)
- "Seeking information" (pure search-like) = 24% of messages; "Asking" intent = 51.6%. **[secondary citing the paper]** — [Ahrefs, 11 Feb 2026](https://ahrefs.com/blog/chatgpt-has-12-percent-of-googles-search-volume/)
- Practical guidance is the largest category at roughly 29%. **[secondary]** — [Medianama](https://www.medianama.com/2025/09/223-over-70-chatgpt-interactions-non-work-guidance-openai/)
- Non-work messages rose from 53% to 73% of consumer messages between June 2024 and June 2025. **[secondary]** — [Medianama](https://www.medianama.com/2025/09/223-over-70-chatgpt-interactions-non-work-guidance-openai/)
- Ahrefs' Patrick Stox argues 65% of ChatGPT usage is "what people traditionally search on Google"; this is his own classification, not the study's. **[primary]** — [Ahrefs, 11 Feb 2026](https://ahrefs.com/blog/chatgpt-has-12-percent-of-googles-search-volume/)

**Google**
- Gemini app: 950M monthly active users (Alphabet Q2 2026 call, 22 Jul 2026); 750M at Q4 2025 results (Feb 2026); 900M+ at I/O on 19 May 2026. **[search-snippet of primary]** — [Google blog, CEO remarks Q2 2026](https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q2-2026/)
- AI Mode: over 1 billion monthly active users (Q2 2026 CEO remarks). **[search-snippet of primary]** — [Google blog](https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q2-2026/)
- AI Overviews: 2.5B+ monthly users reported at I/O 2026 by one source, about 2B by others. Conflicting; treat as "2B+". **[secondary]** — [pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/8853/gemini-950-million-users-chatgpt)
- Google handles about 5 trillion searches/year, i.e. about 13.7B/day (Google figure from Jan 2025). **[secondary citing Google]** — [Ahrefs, 11 Feb 2026](https://ahrefs.com/blog/chatgpt-has-12-percent-of-googles-search-volume/)

**Perplexity**
- Last company-confirmed figure: about 780M queries in May 2025. 2026 estimates of 1.0-1.5B queries/month and 30-45M MAU are third-party extrapolations that disagree with each other. **[secondary]** — [getairefs](https://getairefs.com/blog/perplexity-statistics-june-2026/); [gradually.ai](https://www.gradually.ai/en/perplexity-statistics/)
- Perplexity's share of AI chatbot referral traffic fell to 5.88% in July 2026 from 7.73% in April 2026. **[secondary]** — [getairefs](https://getairefs.com/blog/perplexity-statistics-june-2026/)

**Claude, Grok**
- Claude: over 800M monthly web visits in 2026 (visits, not users). **[secondary]** — [getairefs](https://getairefs.com/blog/perplexity-statistics-june-2026/)
- ChatGPT's share of AI chatbot referrals fell from 84% to about 77% by April 2026. **[secondary]** — [searchlab](https://searchlab.nl/en/statistics/chatgpt-statistics-2026)

### Inferences
- Relative platform weights for a forecast can be taken from Ahrefs' ratio table (ChatGPT about 10x Gemini or Perplexity for referral-generating activity) rather than from MAU figures, because Gemini's 950M MAU does not translate into proportionate search-like, click-generating usage.
- ChatGPT weekly users roughly doubled in 12 months (400M to 900M, Feb 2025 to Feb 2026). If prompts per user held constant, daily prompts would now be well above the July 2025 figure of 2.5B; no source confirms this, so 2.5B/day should be treated as a floor and labelled "July 2025".

### Gaps
- OpenAI's own page returned HTTP 403; the exact NBER sub-category shares (e.g. "purchasable products", "specific info") were not confirmed. I found no published share for local or commercial-intent prompts. Do not quote a "local share of ChatGPT prompts" figure; none was found.
- No company-disclosed 2026 MAU or query figures found for Claude or Grok.
- No official 2026 ChatGPT prompts/day figure found.
- No later (2026) large-scale intent study equivalent to the NBER paper was found.

---

## 3. Published ratios between Google search volume and AI assistant query volume, and rate of change

### Takeaway
The most usable published conversion table is Ahrefs' (Sep 2026): ChatGPT = 0.115 x Google volume, Gemini 0.011, Perplexity 0.01, Copilot 0.0033, Grok 0.000054, AI Mode 0.05-0.10. Independent estimates of ChatGPT's search-like volume as a share of Google range from about 4% to 12%, and Datos/SparkToro put all AI tools at about 3.2% of search interactions in Q4 2025; no category-level ratios were found.

### Cited Findings
- Ahrefs platform ratios applied to Google parent-keyword volume: AI Overview 1.00 (search queries) / 0.20 (prompts); AI Mode 0.10 (search queries) / 0.05 (prompts); ChatGPT 0.115; Gemini 0.011; Perplexity 0.01; Copilot 0.0033; Grok 0.000054. Worked example from Ahrefs: 1,296 x 0.115 = about 149, shown as 150. **[primary]** — [Ahrefs help center, 3 Sep 2026](https://help.ahrefs.com/en/articles/16755865-what-is-ai-adjusted-volume-and-how-is-it-calculated)
- Ahrefs (Patrick Stox, 11 Feb 2026): ChatGPT 2.5B prompts/day vs Google 13.7B searches/day = 18% of Google's raw volume (Google about 5.5x ChatGPT). Search-like share: 24% (pure search) gives 4.38% of Google; 51.6% (asking) gives 9.42%; author's 65% gives 11.86% (the "12%" headline). **[primary]** — [Ahrefs blog](https://ahrefs.com/blog/chatgpt-has-12-percent-of-googles-search-volume/)
- Same study: Google sends 39.98% of website traffic vs ChatGPT 0.21% across 76,000 sites in Ahrefs Web Analytics, i.e. 190x. Implied click-through per query: Google about 29%, ChatGPT about 1.3% (0.84% to 3.5% depending on denominator). **[primary]** — [Ahrefs blog](https://ahrefs.com/blog/chatgpt-has-12-percent-of-googles-search-volume/)
- Caveat on that study: Google's volume is a Jan 2025 figure and ChatGPT's is July 2025; the article's "8.33 Google searches per ChatGPT search" is 1/0.12 and slightly inconsistent with its own inputs (13.7/1.625 = 8.43). **[primary, own arithmetic check of the article]** — [Ahrefs blog](https://ahrefs.com/blog/chatgpt-has-12-percent-of-googles-search-volume/)
- Peec (Oct 2025): ChatGPT's real search volume is roughly 4-12% of Google's; argues click-based figures (about 0.6%) undercount. **[search-snippet]** — [Peec docs](https://docs.peec.ai/research/chatgpt-google-market-share)
- seoClarity (older model): about 1.2-1.4B search-like tasks/day on ChatGPT, roughly 9% of Google's daily searches. **[search-snippet, secondary]** — [ppc.land](https://ppc.land/chatgpt-sends-190x-less-traffic-than-google-despite-12-search-volume/)
- Datos/SparkToro "Search Happens Everywhere" (Q4 2025, US desktop clickstream, 41 sites): traditional search engines about 80.8% of search interactions, e-commerce 9.8%, social 5.4%, AI tools 3.2%. **[secondary, German press write-up; original not opened]** — [t3n](https://t3n.de/news/google-dominiert-weiter-chatgpt-holt-auf-wo-internetsuche-wirklich-stattfindet-1732358/)
- SparkToro/Datos (Mar 2026): about 97% of Google visitors perform a search, but only about 56% of ChatGPT visitors actually prompt (many arrive via shared links). **[search-snippet of primary]** — [SparkToro blog](https://sparktoro.com/blog/how-much-is-your-audience-searching-google-vs-prompting-ai-tools-sparktoros-answers-just-got-an-upgrade/)
- Growth: ChatGPT weekly users 400M to 900M in about a year to Feb 2026. **[secondary]** — [getairefs](https://getairefs.com/blog/chatgpt-user-statistics/). Gemini app MAU 750M (Feb 2026) to 950M (Jul 2026). **[search-snippet of primary]** — [Google blog](https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q2-2026/)

### Inferences
- Summing Ahrefs' standalone-assistant ratios (ChatGPT 0.115 + Gemini 0.011 + Perplexity 0.01 + Copilot 0.0033 + Grok about 0) gives about 0.14: roughly 14 assistant prompts per 100 Google searches on the same topic. Adding AI Mode (0.05-0.10) gives about 0.19-0.24. Claude is not in Ahrefs' table.
- Ahrefs says its ratios come from referral-traffic comparisons, yet its own Feb 2026 study shows ChatGPT's traffic share is only about 0.5% of Google's (0.21/39.98) while its search-like volume share is about 12%. The 0.115 ChatGPT ratio matches the volume estimate, not the raw traffic share, so the ratio table appears to be calibrated on usage rather than on clicks. The help article does not explain this. Worth stating as a known ambiguity.
- A defensible range for "ChatGPT search-like prompts as a share of Google searches" is 4% (low, pure-search definition) / 9-12% (central) / 18% (high, all prompts). A 3x spread between low and central is the honest error bar from definition alone, before any category or local adjustment.
- The ratio is moving fast: if ChatGPT users roughly doubled in a year while Google volume is roughly flat, a ratio fixed at mid-2025 inputs (which the 12% figure is) understates late-2026 demand. Any ratio should carry an "as of" date and be refreshed at least twice a year.
- These are global, all-topic ratios. Applying them to a local-service keyword assumes people ask AI about plumbers in the same proportion as about everything else, which is unproven and probably too high for "near me" emergencies and too low for researched purchases (B2B SaaS, legal, medical).

### Gaps
- No published ratio by business category or industry was found (not from Datos, Semrush, Similarweb, BrightEdge or Ahrefs).
- Datos State of Search Q1 and Q2 2026 reports exist ([Q1](https://datos.live/report/state-of-search-q1-2026/), [Q2](https://datos.live/report/state-of-search-q2-2026/)) but are behind download forms; their AI-share and AI Mode numbers were not retrieved. These are the best candidates for a year-over-year trend and should be downloaded manually.
- No BrightEdge or Similarweb volume-ratio study was retrieved.
- No measured year-over-year change in the Google-to-AI ratio itself was found; growth is inferred from user counts.

---

## 4. Share of local and commercial Google searches that trigger an AI Overview, by industry

### Takeaway
AI Overviews appear on a small minority of true local-intent ("near me", service + city) searches, roughly 8-22% across sources, because Google shows the map pack instead; they are far more common on informational and commercial research queries (roughly 30-80% depending on industry). Figures vary heavily by sample and none is a rigorous 2026 industry-by-industry local study.

### Cited Findings
- Whitespark case study: AI Overviews appeared for 15% of local-intent queries vs 92% of informational-intent queries; local packs appeared for 93% of local-intent queries. Sample 540 queries collected by hand, May 2025. **[search-snippet of primary; dated May 2025]** — [Whitespark](https://whitespark.ca/blog/case-study-the-prevalence-of-ai-overviews-in-local-search/)
- Aug 2026 vendor report: AI Overviews on 21.8% of local-intent queries; AI Overviews sent 73.5% of local-intent citations to the business's own website, while AI Mode sent most citations to Google Maps / Business Profile URLs. **[secondary, vendor blog]** — [Hartzer](https://hartzer.it.com/steady-demand-local-citations-2026/)
- 2026 blog citing unnamed SERP-tracking studies: about 8% of explicit-local-intent queries trigger an AI Overview. **[secondary, weak]** — [ThinkProfits](https://thinkprofits.com/digital-news/maps-pack-still-wins-local-ai-overviews-8-percent/)
- cloro (Jul 2026): AI Overview rate on local restaurant queries 3.0% (400 local prompts, restaurants only), vs 52.3% for travel and 97.8% for voice-style queries. **[search-snippet]** — [cloro](https://cloro.dev/research/ai-overview-trigger-index/)
- Presenc AI (May 2026), commercial-intent queries by industry: healthcare 78%, personal finance 71%, HR/recruiting 31%; healthcare, personal finance and education above 60%. **[search-snippet, vendor]** — [Presenc](https://presenc.ai/research/ai-overview-citation-rates-by-industry-2026)
- Adthena data via Neil Patel (May 2026): travel has the lowest AI Overview trigger rates, 5.0% at one-word queries up to 27.7% at eight words; rates rise with query length across Auto, Finance, Health, Retail, Travel. **[search-snippet]** — [Neil Patel](https://neilpatel.com/marketing-stats/ai-overview-trigger-rates-by-query-length/)
- Overall prevalence estimates conflict: Presenc reports about 13% of all Google queries show an AI Overview; cloro reports mid-70s% on its monitored panel. Difference is sample definition. **[search-snippet]** — [Presenc](https://presenc.ai/research/ai-overviews-query-trigger-types-2026); [cloro](https://cloro.dev/research/ai-overview-trigger-index/)
- Unverified outlier: a claim that AI Overviews appear on about two-thirds of local business queries, with no primary source. Do not use. **[secondary, unsupported]** — [QuickSEO](https://quickseo.ai/blog/local-seo-in-2026-46-percent-of-searches-have-local-intent-50-more-stats-smbs-should-know)

### Inferences
- For a forecast, split each category's keywords into (a) local-intent "hire now" terms (plumber near me, med spa [city]) with an AI Overview rate of about 10-20%, and (b) research terms (cost of X, best X for Y, X vs Y) with a rate of about 50-90%. Using a single blended rate will be wrong for nearly every SMB.
- Mirror already buys DataForSEO SERP data, so the AI Overview trigger rate for a client's actual keyword set in their actual city can be measured directly rather than taken from a published benchmark. That is more defensible than any study cited here.
- AI Mode citing Google Business Profile / Maps for local intent (Hartzer) suggests local AI demand on Google surfaces flows back to the map listing, not the website.

### Gaps
- No rigorous 2026 study of AI Overview trigger rate by local industry (home services, legal, med spa, dental) was found. No BrightEdge, Semrush Sensor or Local Falcon figures were retrieved.
- AI Mode has no "trigger rate" (it is opt-in); no data found on what share of local searches are done in AI Mode.

---

## 5. Local and geographic adjustments: is city/metro AI prompt data available?

### Takeaway
No source found offers measured AI prompt volume at city or metro level; AI prompt datasets are country-level at best, and DataForSEO's ChatGPT mentions data is US-only. Local AI demand has to be modelled: Google Keyword Planner local volume (which does go to city/DMA level) multiplied by a national AI ratio.

### Cited Findings
- DataForSEO LLM Mentions: "chat_gpt data is available for United States only"; default location is country code 2840. **[search-snippet of vendor docs]** — [DataForSEO docs](https://docs.dataforseo.com/v3/ai_optimization-llm_mentions-historical-live/)
- DataForSEO AI Keyword Data requires a location and language; documented examples are countries; sub-national support is not stated. **[primary]** — [DataForSEO docs](https://docs.dataforseo.com/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live.md)
- Semrush Prompt Research offers 42 geographic prompt databases across 40+ markets (country-level). **[search-snippet of vendor page]** — [Semrush](https://nl.semrush.com/features/prompt-research/)
- Profound says it adjusts for geographic bias and has added "more global coverage" and demographic data in beta; no per-city or per-region sample is published. **[search-snippet of vendor pages]** — [Profound changelog](https://product.tryprofound.com/en/changelog/new-prompt-volumes-features-available-now)
- Ahrefs' method inherits whatever geography the Google parent-keyword volume has, since it is just Google volume times a ratio. **[primary]** — [Ahrefs help center](https://help.ahrefs.com/en/articles/16755865-what-is-ai-adjusted-volume-and-how-is-it-calculated)
- Panels have "gaps by geography, device type, and machine settings" and extension data is desktop-only. **[primary]** — [Conductor, updated 8 Jul 2026](https://www.conductor.com/academy/debunking-ai-prompt-volume/)

### Inferences
- With panels at well under 1% of prompts nationally (see section 7), slicing to a metro and a single category would leave a handful of observations or none. City-level measured prompt volume is not just unavailable; it is statistically infeasible with current panels.
- Practical local model: [Google Ads city/DMA volume for the category keyword set, from DataForSEO] x [national AI ratio, Ahrefs table or 4/12/18% range] x [optional local-adoption adjustment]. The third term has no published data; leaving it at 1.0 and saying so is more defensible than inventing one.
- AI prompts often omit the city (the assistant infers location or the user states it mid-conversation), so keyword-anchored local volume may miss prompts. No data found to quantify this.

### Gaps
- No data on how AI adoption varies by US metro, or by urban vs rural, was found.
- Whether DataForSEO AI Keyword Data accepts city-level location codes is unverified; test with one API call.

---

## 6. How consumers use AI to find local businesses (surveys)

### Takeaway
BrightLocal's 2026 survey (1,002 US adults, published 11 Feb 2026) found use of generative AI tools for local business recommendations jumped from 6% to 45% in a year, making AI the third most-used recommendation source after Google and Facebook. This is "used at least once in the past year", not frequency, so it cannot be converted directly into query counts.

### Cited Findings
- 45% of US consumers used ChatGPT or other generative AI tools for local business recommendations in 2026, up from 6% in 2025. Sample: 1,002 US adults, representative SurveyMonkey panel; published 11 Feb 2026. **[primary]** — [BrightLocal Local Consumer Review Survey 2026](https://www.brightlocal.com/research/local-consumer-review-survey/)
- AI tools are the third most popular source of business recommendations, behind Google and Facebook. Google's share of review-site use fell from 83% (2025) to 71% (2026). **[primary]** — [BrightLocal](https://www.brightlocal.com/research/local-consumer-review-survey/)
- 40% trust AI platforms to provide business recommendations vs 32% who do not; 42% trust AI as much as traditional reviews. **[primary]** — [BrightLocal](https://www.brightlocal.com/research/local-consumer-review-survey/)
- 82% read AI-generated review summaries; 23% would rely solely on the summary to decide. **[primary]** — [BrightLocal](https://www.brightlocal.com/research/local-consumer-review-survey/)
- 31% used ChatGPT specifically and 23% used Google AI Mode for a business recommendation in the last 12 months. **[secondary; not on the BrightLocal page I read]** — [justinharris.ai](https://justinharris.ai/blog/ai-local-search-45-percent-brightlocal-2026/)
- Scorpion home-services report (Feb 2026): 22% of homeowners use AI tools such as ChatGPT to research or find service recommendations; 80% of local service businesses are unsure how to appear in AI results. **[secondary press release]** — [Scorpion](https://www.scorpion.co/about-us/scorpion-news/scorpion-news/2026/scorpions-new-industry-report-reveals-a-disconne/)
- SOCi analysis: ChatGPT recommends about 1.2% of local businesses. **[search-snippet, secondary mention; original not located]** — [justinharris.ai](https://justinharris.ai/blog/ai-local-search-45-percent-brightlocal-2026/)
- 5W PR (Q1 2026; 320+ prompts, 10 US metros, 6 service categories): AI answers for local services most often cite Yelp, then Roto-Rooter, then Angi. Methodology not independently verified. **[secondary]** — [5W PR](https://5wpr.com/research/local-services-ai-visibility-crisis-2026/)
- Metricus internal test of 200+ homeowner queries: Angi appeared in over 90% of responses; an average independent contractor in under 1%. Vendor test. **[secondary, vendor]** — [Metricus](https://metricusapp.com/blog/home-services-ai-visibility/)

### Inferences
- The 6% to 45% jump in one year is unusually large for a survey metric; part of it may be wording (if the 2026 question included AI Overviews or AI Mode inside Google, many respondents would qualify passively). Quote it with the sample size and the "past year" framing.
- The home-services figure (22%) is about half the all-category figure (45%), which supports using lower AI ratios for urgent trades than for considered purchases.
- Aggregators (Yelp, Angi) dominate AI answers for local services, so "N people ask AI about your category" does not mean N people can see an individual business. The funnel needs a visibility/share-of-voice step, which is the thing Mirror measures.

### Gaps
- No SOCi consumer survey figures were retrieved directly.
- No survey gives frequency (AI local queries per person per month), which is what a volume model needs.
- No Pew figures on local-business AI use were retrieved.

---

## 7. Main criticisms of "AI search volume" numbers and how wide the error is

### Takeaway
Critics (Conductor, Ahrefs, Scrunch, independent SEOs) agree the numbers come from panels covering well under 1% of prompts, skewed to desktop, extension-installing, tech-savvy users, then multiplied 100x or more; nobody publishes an error range. The honest position is that these are order-of-magnitude, directional estimates.

### Cited Findings
- Vendor samples are "tens of millions" of prompts/month against about 2.5B prompts/day, i.e. "far less than 1%" of the market and possibly as low as 0.15%. **[primary]** — [Conductor, updated 8 Jul 2026](https://www.conductor.com/academy/debunking-ai-prompt-volume/)
- If a panel represents 1% of usage, results are multiplied 100x or more; extrapolation compounds error. **[primary]** — [Scrunch, 4 Sep 2026](https://helpcenter.scrunchai.com/en/articles/13146531-understanding-prompt-volume-in-ai-search)
- Panel coverage gaps: mobile usage, native apps, Safari, privacy-focused browsers; extension data is desktop-only and misses most enterprise users. **[primary]** — [Scrunch](https://helpcenter.scrunchai.com/en/articles/13146531-understanding-prompt-volume-in-ai-search); [Conductor](https://www.conductor.com/academy/debunking-ai-prompt-volume/)
- Panelists are paid opt-in participants, skewing toward incentive-motivated, tech-savvy people. Browser-extension data can vanish after a browser update, and brokers resell and recombine it so double-counting is unknown. **[primary]** — [Conductor](https://www.conductor.com/academy/debunking-ai-prompt-volume/)
- Prompts are long and context-heavy and rarely repeat exactly, so "the volume of any single prompt is effectively 1"; responses are probabilistic and personalized. **[primary]** — [Conductor](https://www.conductor.com/academy/debunking-ai-prompt-volume/)
- Only a fraction of prompts resemble search queries, so filtering for "commercial" prompts adds noise; comparing prompt volume with Search Console or SEO-tool volume is misleading because they measure different behaviours. **[primary]** — [Scrunch](https://helpcenter.scrunchai.com/en/articles/13146531-understanding-prompt-volume-in-ai-search)
- Ahrefs' research found other vendors' prompt volumes "can be significantly over-estimated"; summing topic volumes inside a multi-topic prompt inflates results; some tools generate prompt variations from seed keywords and assign volumes with no measurement. **[primary]** — [Ahrefs blog, 17 Aug 2026](https://ahrefs.com/blog/how-ahrefs-estimates-ai-search-demand/)
- Ahrefs states Microsoft Copilot is the only major AI platform that shares query data. **[primary]** — [Ahrefs blog](https://ahrefs.com/blog/how-ahrefs-estimates-ai-search-demand/)
- Prompt volumes often start from keyword anchors, imposing keyword logic on semantic multi-topic prompts. **[secondary, agency blog]** — [Jaeckert & O'Daniel](https://www.jaeckert-odaniel.com/en/prompt-search-volume-real-data-or-all-guessed/)
- Conductor's recommended alternative: use Google Trends, Search Console and Keyword Planner as topical demand proxies and treat prompts qualitatively. **[primary]** — [Conductor](https://www.conductor.com/academy/debunking-ai-prompt-volume/)
- All of these critics sell competing products; no independent or peer-reviewed validation of any prompt-volume dataset was found. **[observation from the sources above]** — [Conductor](https://www.conductor.com/academy/debunking-ai-prompt-volume/); [Ahrefs](https://ahrefs.com/blog/how-ahrefs-estimates-ai-search-demand/)

### Inferences
- No one publishes a confidence interval. The only quantifiable spread comes from the definition problem in section 3: ChatGPT is 4%, 9-12% or 18% of Google volume depending on what counts as a search, a 3-4x range. Stacking a local adjustment and category variation on top, a single-category single-metro estimate plausibly sits within a factor of 3-5 either way. This is my estimate, not a published figure.
- Mirror's forecast should show a range (low / likely / high), state the "as of" date for each ratio, and describe the top-of-funnel number as "modelled from Google search demand", never as measured AI queries. That wording matches what Ahrefs, the most transparent vendor, says about its own metric.
- Anchoring on Google volume has one real advantage for defensibility: the base (Keyword Planner) is first-party Google data at city level, and the multiplier has a public citation. The weakness is that it cannot see demand that exists only in AI (questions people never typed into Google).

### Gaps
- No published accuracy test comparing any vendor's prompt volume with ground truth (there is no ground truth available).
- No quantified error bars from any vendor.
- Did not find independent academic critique; all commentary is from interested vendors or practitioners.
