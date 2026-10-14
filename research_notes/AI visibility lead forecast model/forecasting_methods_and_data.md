# Forecasting methods and purchasable demand data for an AI-visibility "Forecast" tab (state as of 13 October 2026)

Reading notes for the report writer:
- Every finding carries its source and date. "Secondary" means I saw the figure quoted by a third party and did not open the original.
- Several pages could not be opened (SEOmonitor product page returned 429, Neil Patel/NP Digital returned 403). Those figures come from search-result summaries and are marked.
- Prices are quoted exactly as published on the page named. DataForSEO raised many prices on 1 July 2026, so any figure dated before then is stale.

## 1. How do classic SEO forecasting models work, which tools ship one, and how do they present confidence?

### Takeaway
Every shipped SEO forecast is the same chain: search volume × click-through rate at a target position × conversion rate × customer value, with seasonality and scenarios layered on. Confidence is shown as named scenarios (conservative / medium / aggressive) or, in SEOmonitor's case, a "chance of reaching the goal"; none of the tools I found publishes a statistical error band or a documented formula for its confidence figure.

### Cited Findings

The core formula
- The standard chain is volume × CTR at the target position = traffic; traffic × conversion rate = leads; leads × close rate × customer value = revenue. Worked example given: 1,000 searches/month at rank 1 ≈ 400 visits (1,000 × 40%); the CTR figures in that guide are illustrative, not measured — [SEO Sherpa, SEO Forecasting guide](https://seosherpa.com/seo-forecasting/) (undated, retrieved Oct 2026)
- Statistical alternatives (linear regression, moving averages on historical traffic) are used to capture seasonality and year-over-year patterns; guides recommend treating search volume as a range rather than a fixed number and allowing for a lag before gains appear — [SE Ranking, SEO Forecasting Methods](https://seranking.com/blog/seo-forecasting/) (retrieved Oct 2026)

Tools that ship a forecast
- SEOmonitor (SEO Forecast 3.0): inputs are (a) a Top-10 CTR curve per keyword that "significantly changes based on SERP features and device mix", (b) search volume adjusted for each keyword's monthly seasonality and year-over-year trend, (c) separate desktop and mobile volumes and curves. Output: additional sessions, additional conversions, and a live "chance of reaching the set goal" — [SEOmonitor, SEO Forecast 3.0 announcement](https://www.seomonitor.com/product-updates/weve-launched-seo-forecast-3-0/) (page returned 429 on direct fetch; text from search summary, retrieved Oct 2026)
- SEOmonitor's help centre says the model uses the percentage of clicks that go to organic results (i.e. net of SERP features) to estimate additional sessions — [SEOmonitor help, Our CTR curves](https://help.seomonitor.com/en/articles/3542786-our-ctr-curves) (retrieved Oct 2026)
- SEOmonitor lets users keep the default CTR curve or substitute their own Google Analytics / Adobe Analytics data — [First Page Digital, Forecasting SEO traffic with SEOmonitor](https://www.firstpagedigital.sg/resources/seo/forecasting-seo-traffic-with-seomonitor/) (third-party guide, retrieved Oct 2026)
- SE Ranking: traffic forecast T is computed from keyword search volume (Google Keyword Planner), the site's current ranking, a search-engine adjustment index, and an index for the maximum traffic a SERP position can get. A separate AI-based whole-site estimate uses rankings, volume and CTR — [SE Ranking, Analyzing traffic forecast data](https://seranking.com/blog/traffic-forecast/) (retrieved Oct 2026)
- seoClarity: forecasts combine historical data, Google Search Console CTR, site analytics for conversion rate and average order value, and assumed ranking changes; users can supply a custom CTR model — [seoClarity, SEO Forecasting Tool](https://www.seoclarity.net/seo-forecasting-tool) (retrieved Oct 2026)
- BrightEdge Opportunity Forecasting: calculates "total addressable market" and potential gains in revenue or traffic, with aggressive, medium and conservative scenarios and editable assumptions for rankings, conversion rates, search demand and revenue. The formula is not published — [BrightEdge, Opportunity Forecasting](https://www.brightedge.com/products/s3/opportunity-forecasting) (retrieved Oct 2026)
- AgencyAnalytics: publishes a keyword-method guide and template using average CTR per ranking position; the platform's internal formula is not published — [AgencyAnalytics, SEO Forecasting](https://agencyanalytics.com/blog/seo-forecasting) (title says 2025; retrieved Oct 2026)

CTR curves are unstable, which is the main weakness
- First Page Sage meta-analysis: position 1 = 39.8%, position 2 = 18.7%, position 3 = 10.2%; other datasets put position 1 anywhere from about 20% to 40% — [OuterBox, SERP CTR by position](https://outerboxdesign.com/articles/seo/ctr-based-on-organic-position/) (secondary, retrieved Oct 2026)
- Ahrefs, 300,000 keywords (Feb 2026): for keywords that later showed an AI Overview, average desktop CTR of the #1 result fell from 0.073 (Dec 2023) to 0.016 (Dec 2025); impact ranged from about -50.8% at position 2 to -19.4% at position 10; a July 2026 Ahrefs analysis put the cut to the top result at about 58% — [SEOworth summary of Ahrefs study](https://seoworth.it.com/news/ahrefs-ai-overviews-ctr-study/) (secondary, 2026)
- Seer Interactive, 3,119 queries, 42 companies, 25 million impressions, June 2024 – Sept 2025: organic CTR on AI Overview queries fell 61%, from 1.76% to 0.61%; sites cited inside an AI Overview got 35% more organic clicks than uncited ones — [OuterBox, SERP CTR by position](https://outerboxdesign.com/articles/seo/ctr-based-on-organic-position/) (secondary); same 1.76% → 0.61% figure repeated in [AirOps, Forecast SEO ROI](https://www.airops.com/blog/forecast-seo-roi)
- One guide reports about 68% of Google searches now end without a click and recommends conservative real-world CTRs rather than clean-SERP curves — [AirOps, Forecast SEO ROI](https://www.airops.com/blog/forecast-seo-roi) (secondary, retrieved Oct 2026)

### Inferences
- The sound parts to copy: per-keyword (per-prompt) inputs rather than one blended rate; seasonality from 12 months of volume; three named scenarios; user-overridable conversion rate and customer value; showing the formula line by line.
- The weak part to avoid: a single fixed CTR curve. Published position-1 CTRs range from about 1.6% (AI Overview keywords, Ahrefs) to about 40% (First Page Sage), a 25x spread, so any forecast that hides which curve it used is not checkable.
- "Chance of reaching the goal" style confidence (SEOmonitor) has no published method. Mirror would be on firmer ground showing a low / expected / high range with the assumption that drives each, instead of a single percentage.

### Gaps
- Semrush and Ahrefs: I found no evidence in this research of a native traffic/revenue forecast module in either (both report "traffic potential"-style estimates per keyword, but I did not verify current documentation). Treat as unconfirmed, not as "they have none".
- SEOmonitor's formula for "chance of reaching the goal" is not documented in any page I could reach.
- No tool publishes a numeric error band or a backtested accuracy figure for its forecast.

## 2. Do any AI-visibility products publish a forecast, ROI calculator or "opportunity size" figure?

### Takeaway
I found no forecast or opportunity-size figure shipped inside any of the named AI-visibility products (Profound, AthenaHQ, Peec AI, Otterly, Semrush AI toolkit, Ahrefs Brand Radar, Bluefish, Gauge, Relixir, Yext Scout). What exists is backward-looking attribution (GA4 / Shopify / Stripe joins) and proxy "volume" metrics; the only forward-looking calculator found is a free marketing widget from a small vendor (Rank Prompt) that calls itself "a directional estimate, not a financial forecast".

### Cited Findings
- Rank Prompt free GEO ROI calculator. Inputs: monthly website visitors; average customer value; industry dropdown; a slider "modeled AI opportunity captured" (default 25%, described as the user's judgment, not a measured metric); optional overrides for AI-referred visits as % of visitors and visit-to-revenue rate. Formula: AI pool = visitors × AI-referred %; ceiling revenue = AI pool × conversion rate × customer value; captured = ceiling × slider; gap = ceiling − captured; annualised gap = monthly gap × 12. The per-industry defaults are not disclosed; the FAQ says "2-8% of website discovery" is influenced by AI assistants. Disclaimers: illustrative, directional, defaults are "not verified benchmarks" — [Rank Prompt, Free GEO ROI Calculator](https://rankprompt.com/tools/free-geo-roi-calculator/) (undated, footer © 2026)
- Profound: offers an attribution chain, not a forecast. Agent Analytics traces AI crawler visit → citation → human traffic → conversion through a GA4 connection; "Prompt Volumes" estimates how often queries are asked across LLMs — [Profound blog, best AI visibility tools for agencies](https://www.tryprofound.com/blog/best-ai-visibility-tools-for-marketing-agencies) (vendor-authored, 2026)
- AthenaHQ: ties revenue attribution to native Shopify and Google Analytics integrations and advertises a "1,561% ROI" figure; this is vendor-published and unverified — [AthenaHQ vs Profound](https://athenahq.ai/comparison/profound) (2026)
- A third-party comparison says Profound offers citation data only for attribution, Peec AI offers none, AthenaHQ uses Shopify SKU and GA4 data — [Analyze AI, Profound vs Peec vs AthenaHQ](https://www.tryanalyze.ai/blog/profound-vs-peec-vs-athenahq-comparison) (2026, competitor-authored)
- A review of trackers (published 26 May 2026, updated 1 Aug 2026) states none of the major AI visibility trackers compute a revenue-weighted share of voice; its table marks Profound, SE Ranking, Geoptie, Loamly and Otterly "No". The author sells a competing product (Attrifast) that joins citations to Stripe revenue, so this is an interested source — [Attrifast, AI share of voice](https://attrifast.com/blog/ai-search-share-of-voice)
- Ahrefs Brand Radar reports mentions, estimated impressions and share of voice and links them to search demand; Ahrefs itself is reported to call the numbers directional, modelled signals — [Profound blog, AEO tools guide 2026](https://www.tryprofound.com/blog/9-best-answer-engine-optimization-platforms) (competitor-authored, 2026)
- Yext Scout: tracks visibility and sentiment across ChatGPT, Gemini, Perplexity, Grok, Google and Bing at national and hyper-local level, benchmarks against local competitors, gives prioritised recommendations; the cited outcome is a 186% rise in citations for one hearing-care provider, not a revenue figure — [Yext press release, agentic capabilities](https://www.yext.com/about/news-media/yext-expands-agentic-capabilities-to-grow-ai-visibility) (2026)
- There is no industry-standard formula for AI share of voice as of mid-2026; HubSpot, Semrush and Profound publish materially different methods — [LLM Pulse, Share of voice in AI search](https://llmpulse.ai/blog/share-of-voice-ai-search/) (2026, vendor blog)
- DataForSEO's LLM Mentions API describes its output as including "the traffic potential" of mentions and an "AI search volume" per matched prompt — the closest thing to a purchasable opportunity-size input — [DataForSEO, LLM Mentions pricing](https://dataforseo.com/pricing/ai-optimization/llm-mentions) (retrieved Oct 2026)

### Inferences
- A "customers you would gain at your best competitor's visibility" figure appears to be unoccupied ground among the named products, on the evidence I could reach. That is an opening, and also a warning: nobody has published a validated method to copy.
- The one public calculator starts from the business's own site traffic and an arbitrary "captured" slider. Its weak points are exactly the ones Mirror can fix: Mirror has a measured share of mentions per competitor, so the gap can come from data instead of a slider.
- Attribution products all require a first-party join (GA4, Shopify, Stripe). A forecast that offers an optional first-party override for conversion rate and customer value matches what the market already accepts.

### Gaps
- Not checked individually (no results or not searched by name): Scrunch, Writesonic GEO, Goodie, Evertune, BrightLocal, SOCi, Birdeye. A search across Yext/BrightLocal/SOCi/Birdeye returned no revenue or forecast feature for the latter three, but absence in one search is weak evidence. The report should say "none found", not "none exist".
- Semrush AI toolkit: no forecast or estimated-audience feature surfaced; not confirmed against Semrush documentation.
- Vendor pricing for these tools conflicts between sources (e.g. Profound "$99–$399" vs "sales demo required"; AthenaHQ "$295–$2,000+" vs "$95/month annual") — [Industry Lens](https://industry-lens.com/intelligence/ai-search), [AthenaHQ vs Peec](https://athenahq.ai/comparison/peec). Not resolved.

## 3. How is AI share of voice linked to market share or revenue, and how strong is the evidence?

### Takeaway
There is decent evidence that a single AI mention raises the chance of a site visit in the following week (two panel studies, lifts of roughly 2 to 3 percentage points, or 1.5–2.5x baseline), but no published study links a brand's AI share of mentions to its market share, sales or customers. The share-of-voice-to-market-share rule that vendors borrow (Binet and Field) comes from advertising spend and has not been tested on AI answers.

### Cited Findings

Evidence that mentions lead to visits
- Profound, "The AI mention effect" (published 1 July 2026; data Jan–June 2026): double-opt-in US panel, more than 2 million AI conversations with subsequent browsing, across ChatGPT, Gemini and Google AI Overviews. Method: for each exposure (brand named in the answer but not in the prompt), compare the same user's 7-day visit rate to that brand's site against a linear forecast from three prior 7-day windows; brands the user searched or visited in the prior week excluded; user-clustered bootstrap, 2,000 replicates. Results (treated vs baseline, lift, 95% CI): Gemini 5.42% vs 2.21%, +3.21 pp [2.34, 4.08]; Google AI Overviews 7.79% vs 4.83%, +2.96 pp [2.76, 3.17]; ChatGPT 6.39% vs 4.33%, +2.07 pp [1.67, 2.48]. Relative lift about 2.5x for Gemini and 1.5x for ChatGPT — [Profound, The AI mention effect](https://www.tryprofound.com/blog/the-ai-mention-effect)
- Same study, by industry (pp lift, relative lift): Financial services — AIO +3.7 (+59%), ChatGPT +3.8 (+59%), Gemini +5.7 (+132%); Retail — AIO +3.5 (+52%), ChatGPT +2.6 (+38%), Gemini +5.6 (+140%); Software — AIO +4.0 (+128%), ChatGPT +3.0 (+59%), Gemini +3.6 (+107%); Telecom — AIO +3.0 (+137%), ChatGPT +1.5 (+85%), Gemini +2.3 (+71%) — [Profound, The AI mention effect](https://www.tryprofound.com/blog/the-ai-mention-effect)
- Same study, timing and attribution: 20.5% of first visits within one hour, 42.0% within 24 hours. More than 97% of resulting brand-site visits carried no UTM; visits with a ChatGPT referral parameter were about 1.0% (Jan–Apr), 1.79% (May), 2.47% (June, partial). Stated limits: outcome is site visits only, not purchases; not randomised; selection bias not fully removed; no local or small-business breakdown; brand-level results withheld — [Profound, The AI mention effect](https://www.tryprofound.com/blog/the-ai-mention-effect)
- Similarweb (reported 23 June 2026): brands recommended by ChatGPT were 2.5x more likely to receive a site visit within 7 days than non-recommended competitors; 55.9% of AI-influenced visits arrived via search rather than a visible AI referral (40.4% for the comparison group); AI-influenced visitors viewed about 12 pages and 11.8 minutes vs 6.5 pages and 5.6 minutes. Limits: correlation only; US desktop only; finance, travel and beauty only; sample size not reported — [Search Engine Journal](https://www.searchenginejournal.com/ai-recommended-brands-saw-2-5x-more-site-visits-similarweb/580241); [Search Engine Land](https://searchengineland.com/chatgpt-recommendations-brand-website-visits-study-480989). The data window is given as July–December 2025 in one summary and July 2025–January 2026 in another — [Position Digital, AI SEO statistics](https://www.position.digital/blog/ai-seo-statistics/) (conflict not resolved)

Evidence on conversion (weaker, secondary)
- AI-referred visits convert at 11.4% vs 5.3% for organic (Similarweb, 2025) — quoted in [LLM Pulse](https://llmpulse.ai/blog/share-of-voice-ai-search/) (secondary, original not opened)
- Ahrefs 2025: AI search visitors generated 12.1% of signups from 0.5% of traffic (Ahrefs' own site); a March 2026 figure says AI-referred retail traffic converted 42% better than non-AI traffic — both quoted in [Position Digital, AI SEO statistics](https://www.position.digital/blog/ai-seo-statistics/) (secondary, unverified against originals)
- Citation-to-click rates: Perplexity 8–25%, ChatGPT 5–15%; the article attributes these to its own unpublished logs and calls them "observational" and "directional"; its reference list does not match the attribution — [Attrifast](https://attrifast.com/blog/ai-search-share-of-voice) (May/Aug 2026)

What drives AI visibility (not revenue)
- Ahrefs study of about 75,000 brands: branded web mentions correlate with AI visibility at about 0.664 (Spearman), backlinks about 0.218, YouTube mentions 0.737 — [AuthorityTech summary](https://authoritytech.io/curated/ai-search-trust-dropped-measurement-stack-brand-mentions-2026) (secondary, 2026)

The share-of-voice-to-market-share rule
- Binet and Field, IPA "Media in Focus" (2017, with Google and Thinkbox, IPA Databank cases): about 0.6 points of market share per year per 10 points of excess share of voice (share of voice minus share of market); the share of annual market-share growth explained by excess share of voice was 6% in 1998–2006 and 12% in 2008–2016 — [Selfstorming summary of Media in Focus](https://www.selfstorming.com/tools/libraries/wisdom/the-share-of-annual-market-share-growth-explained-by-excess-share) (secondary); the body of work is listed at [IPA, key works of Binet and Field](https://ipa.co.uk/knowledge/effectiveness-research-analysis/les-binet-peter-field)
- A common vendor restatement is "every 10% ESOV yields about 0.5% market share gain", attributed to Binet and Field on 171 campaigns — [LLM Pulse](https://llmpulse.ai/blog/share-of-voice-ai-search/) (secondary; differs from the 0.6 figure above)
- WARC's summary of the 2017 research: market share is "still deeply influenced" by share of voice — [WARC, New lessons from Binet and Field](https://www.warc.com/content/article/event-reports/new-lessons-from-binet-and-field---media-in-focus-marketing-effectiveness-in-the-digital-era/en-gb/113293)
- Vendor blogs assert a chain from AI share of voice → AI referral sessions → conversion → revenue without data joining the steps; one describes a team whose AI share of voice rose from 14% to 38% with no measured revenue answer — [Attrifast](https://attrifast.com/blog/ai-search-share-of-voice)

### Inferences
- Strength of evidence, in order: (1) a mention raises the same person's chance of visiting within 7 days — moderately strong, two independent panels, one with confidence intervals; (2) AI-influenced visitors are more engaged or convert better — weak to moderate, mostly single-site or secondary; (3) higher share of mentions produces more customers or market share — no direct evidence found.
- Even explained share of growth is small in the advertising work: 6–12% of annual share growth explained by excess share of voice. A forecast that maps a visibility gap straight to an equal customer gap would overstate badly.
- The Profound lift is a per-exposure effect on absolute visit rate (about +2 to +3 points). That is the most defensible published number to build a forecast step on: exposures × lift = incremental visits. It still needs a category demand figure (how many relevant AI questions get asked locally), which nobody publishes for local categories.
- Because more than 97% of AI-driven visits carry no referral tag and about 56% arrive as search, a client's analytics will under-count AI-driven visits. A backtest against GA "AI referral" sessions alone would make the forecast look too high.
- Both lift studies cover national brands in finance, retail, travel, beauty, software and telecom. Applying them to a local dentist or roofer is an extrapolation and should be labelled as one.

### Gaps
- No study found linking AI share of mentions to market share, revenue, or customer counts, for any business size.
- No study found on local or small businesses specifically.
- Evertune, Jellyfish ("share of model") and Seer Interactive AI-referral material did not surface; not reviewed.
- The Nielsen link to excess share of voice named in the brief was not confirmed in any source reached; the research traced is IPA Databank based.
- Original Similarweb report not opened; sample size unknown.

## 4. How can competitor website traffic be estimated, what does it cost by API, and how accurate is it for small sites?

### Takeaway
DataForSEO (already purchased) gives organic traffic estimates per domain for about a tenth of a cent each, built as rank × search volume × CTR; Similarweb and Semrush are far costlier and sales-gated. Every published accuracy check finds large errors for small sites — typically 40% or more off, sometimes 6–10x — so competitor traffic for small local businesses should be used as a rough rank ordering at most, not as a number in the forecast.

### Cited Findings

DataForSEO (pay as you go, $50 minimum deposit, no subscription — [Ryan Doser review, prices pulled 22 Aug 2026](https://ryandoser.com/dataforseo-review/))
- Labs Bulk Traffic Estimation: estimated monthly traffic for up to 1,000 domains per request, with separate values for organic, paid, featured snippet and local pack — [DataForSEO docs](https://docs.dataforseo.com/v3/dataforseo_labs-google-bulk_traffic_estimation-live/)
- How "etv" is built: "estimated organic monthly traffic to the domain, calculated as the product of CTR (click-through-rate) and search volume values of all keywords the domain ranks for" — [DataForSEO docs](https://docs.dataforseo.com/v3/dataforseo_labs-google-bulk_traffic_estimation-live/). A clickstream variant uses clickstream-derived search volume times a CTR coefficient by rank group — [DataForSEO help centre](https://dataforseo.com/help-center/whats-clickstream-estimated-traffic-volume-and-how-is-it-calculated)
- Labs prices (Live only): general rate $0.012 per task + $0.00012 per item; historical Bulk Traffic Estimation $0.12 per task + $0.0012 per domain; `include_clickstream_data=true` doubles the request cost — [DataForSEO Labs pricing](https://dataforseo.com/pricing/dataforseo-labs/dataforseo-google-api) (retrieved Oct 2026). Same general rate quoted independently — [Ryan Doser, 22 Aug 2026](https://ryandoser.com/dataforseo-review/)
- Google Ads search volume (Live): $0.09 per task, up to 1,000 keywords per task — [Ryan Doser, 22 Aug 2026](https://ryandoser.com/dataforseo-review/)
- Google organic SERP: $0.0006 (standard queue), $0.0012 (priority), $0.002 (live) per SERP; Google AI Mode SERP: $0.0012 / $0.0024 / $0.004 per page — [Ryan Doser, 22 Aug 2026](https://ryandoser.com/dataforseo-review/)
- LLM Mentions API: $0.1 per task + $0.001 per row ("$1,100 per 1M rows"); Live only; covers ChatGPT and Google AI Overviews from a database of over 280M prompts and answers; returns questions, full answers, cited sources, mention counts and AI search volume per match — [DataForSEO LLM Mentions pricing](https://dataforseo.com/pricing/ai-optimization/llm-mentions) (retrieved Oct 2026)
- AI Keyword Search Volume: $0.01 per task + $0.0001 per row ("$110 per 1M keywords"), max 1,000 keywords per request; returns last-month AI search volume and a 12-month trend. The metric is proprietary and is "calculated from statistical data drawn from questions in the 'People Also Ask' SERP element" — i.e. modelled from Google data, not measured inside chat tools — [DataForSEO AI Keyword Search Volume pricing](https://dataforseo.com/pricing/ai-optimization/ai-keyword-search-volume) (retrieved Oct 2026)
- LLM Responses API: $0.0006 per task live, $0.0002 standard, plus the underlying model's charges — [Ryan Doser, 22 Aug 2026](https://ryandoser.com/dataforseo-review/)
- 1 July 2026 price change: Labs +20% all endpoints; Domain Analytics +20%; Keywords Data +20% for most endpoints (+22% Google Trends Explore); Backlinks +20%; Business Data +20% for Business Listings Search and Categories Aggregation. The $100 monthly commitment for Backlinks and LLM Mentions was removed (now pay as you go). Percentages only; no base prices on the page — [DataForSEO pricing update](https://dataforseo.com/update/pricing-update-in-dataforseo-apis) (1 July 2026)

Similarweb
- API is billed in "data credits"; each returned data point costs credits depending on endpoint; most endpoints 1 credit per data point — [Similarweb API docs, data credits](https://docs.similarweb.com/api-v5/guides/data-credits-calculations)
- No public API price; sold through sales. Reported platform entry about $125/month annual ($199 month to month), while another source says the public page went quote-only in 2026; a reported median contract is $107,200/year from 4 buyer reports — [ScrapeGraphAI, Similarweb API pricing](https://scrapegraphai.com/blog/similarweb-api-pricing); [CostBench](https://costbench.com/software/seo-tools/similarweb/) (third-party, conflicting)
- Similarweb's own accuracy page says its strength is sites with 5K–100K monthly users, citing a SparkToro study — [Similarweb support, data accuracy](https://support.similarweb.com/hc/en-us/articles/360002219177) (vendor claim; original not opened)
- Ahrefs reported Similarweb showed estimates for only about one fifth of small sites tested (Flippa listings) — [Ahrefs blog, website traffic](https://www.ahrefs.com/blog/website-traffic) (competitor-authored)

Semrush and Ahrefs
- Semrush API requires the Advanced plan at $549/month, with units bought separately in packs of 2M, 5M, 10M or 20M; no per-unit price is published; "about $50 per million units" is a third-party estimate. I found no price specific to Traffic Analytics — [That Marketing Buddy](https://thatmarketingbuddy.com/blog/semrush-api-pricing); [Adeye](https://adeye.ai/blog/semrush-api-pricing) (third-party, 2026)
- Ahrefs API v3: sources disagree — "Lite plan at $129/month includes 200,000 API units" vs Enterprise-only at about $1,499/month with about 2,000,000 units. Brand Radar quoted "from $199/mo" in one source and about $828/month ($129 base + $699 bundle) in another — [SE Ranking, Ahrefs API alternatives](https://seranking.com/blog/ahrefs-api-alternatives/); [Omid Saffari, Brand Radar vs Semrush AI Visibility](https://omidsaffari.com/blog/growth-brand-radar-vs-semrush-ai-visibility-cost-math) (third-party, conflicting, 2026)

Accuracy studies
- Screaming Frog (13 June 2016; 25 UK sites, Feb–Apr 2016, organic, vs Google Analytics; author calls it "a quick test"): total difference Similarweb +17%, Ahrefs -17%, Semrush -30%; average difference +1%, -36%, -42%. For the lowest-traffic sites (under 10k visits) "almost every estimation by each tool was at least 40% incorrect". Extremes: -94% (Ahrefs) and +128% (Similarweb). Commenter-computed mean absolute errors: Semrush 48.6%, Similarweb 37.4%, Ahrefs 42.2% — [Screaming Frog](https://www.screamingfrog.co.uk/how-accurate-are-website-traffic-estimators/)
- Ahrefs' own 2022 study (1,635 sites vs Search Console): median deviation 49.52% for Ahrefs, 68.36% for Semrush — reported with a note that Ahrefs ran the study — [Geotoolbox, Semrush vs Ahrefs](https://geotoolbox.ai/blog/semrush-vs-ahrefs.md) (2026, secondary)
- Same source's own test: on the smallest (new) site both Semrush and Ahrefs overshot by six to ten times — [Geotoolbox](https://geotoolbox.ai/blog/semrush-vs-ahrefs.md)
- Correlation with real traffic across 641 sites: Semrush 0.790, Datos 0.720, Similarweb 0.659, Ahrefs 0.504 (Ahrefs figure is organic only) — [Authority Hacker, traffic estimates accuracy](https://www.authorityhacker.com/traffic-estimates-accuracy) (date not confirmed)
- Size-segment comparison vs Google Analytics: Semrush error 45% vs Similarweb 57% for sites over 1 million sessions, but Semrush was less accurate (67%) for small sites and its misses were larger — [CustomerThink, Similarweb vs Semrush](https://customerthink.com/similarweb-vs-semrush-which-offers-more-accurate-data/) (date not confirmed)
- Other reported averages: Ahrefs 22.5% average discrepancy across 47 sites; Semrush 61.58% average error across 184 sites (both vs Search Console) — [Analyze AI, traffic estimations accuracy](https://www.tryanalyze.ai/blog/traffic-estimations-accuracy) (secondary, studies not opened)

### Inferences
- Cost is not the constraint. For a client with 5 competitors, DataForSEO domain traffic estimates cost roughly $0.012 + 5 × $0.00012 per call at the general Labs rate (my arithmetic from the published rate). Accuracy is the constraint.
- DataForSEO's etv is the same formula as the classic SEO forecast (rank × volume × CTR), so it inherits the CTR-curve problem in section 1 and counts only Google organic search, not direct, maps, referral or AI traffic. For a local business whose customers mostly arrive via Maps and phone calls, it measures a minor channel.
- No accuracy study found tests DataForSEO specifically, and none tests sites in the hundreds-of-visits-a-month range typical of local businesses. The nearest evidence ("at least 40% off under 10k visits", "6–10x on a new site") says single-site figures are not reliable enough to print as a customer estimate.
- DataForSEO "AI search volume" is derived from People Also Ask data. It is a Google-search proxy relabelled, not a count of prompts in ChatGPT or Claude. If used, the explanation page should say so.
- LLM Mentions covers only ChatGPT and Google AI Overviews; Mirror's own scans cover more engines, so Mirror's share-of-mentions data is the better numerator; DataForSEO can at most supply a demand denominator.

### Gaps
- No published accuracy study of DataForSEO traffic estimates.
- Exact post-July-2026 dollar prices for Domain Analytics and Business Listings were not on the pages reached (the update page gives percentages only). Check the account dashboard.
- Whether Labs general-rate figures quoted are pre- or post-increase: the DataForSEO pricing page fetched in Oct 2026 and the 22 Aug 2026 review agree ($0.012 + $0.00012), so they appear to be current, but I did not see a dated statement.
- Similarweb, Semrush and Ahrefs API prices could not be confirmed from first-party pages; third-party sources conflict.
- Most accuracy studies are old (2016, 2022) or undated; none found from 2026 other than the secondary Geotoolbox test.

## 5. For local businesses with little web traffic, what other demand signals can be bought or scraped, and are there published ratios?

### Takeaway
Review count, rating distribution, review dates (hence review velocity) and Google "popular times" are all purchasable for any competitor through DataForSEO for fractions of a cent, and are the best available cross-business signal for local firms. But the only reviews-per-customer ratio I found is a self-reported agency figure (about 10 reviews per 100 customers asked, range roughly 8% to 42% and one outlier at 75%), so converting reviews into customer counts carries an uncertainty of several-fold.

### Cited Findings

What can be bought
- DataForSEO Google My Business Info returns, per business: `rating` (value, `votes_count`, `rating_max`), `rating_distribution` (counts of 1–5 star), `popular_times` with `popular_times_by_days` and an hourly `popular_index` ("relative time-bound popularity index measured from 0 to 100"), `people_also_search` (related businesses with their ratings), `category`, `additional_categories`, `attributes`. `popular_times` can be null (it is null in the docs sample) — [DataForSEO docs, My Business Info](https://docs.dataforseo.com/v3/business_data/google/my_business_info/live/)
- DataForSEO Google Reviews: $0.00075 per 10 reviews standard queue (up to 45 min), $0.0015 priority (up to 1 min) — "$75 per 1M reviews" standard. Depth is billed in whole blocks of 10. Extended reviews: $0.00075 per task (up to 20 reviews) plus +$0.0015 if looked up by keyword or +$0.00075 by place_id/cid. A keyword containing a search operator multiplies the charge by 5 — [DataForSEO Google Reviews pricing](https://dataforseo.com/pricing/business-data/google-reviews-api) (retrieved Oct 2026; page undated)
- City-level category search volume: Google Ads search volume at $0.09 per task for up to 1,000 keywords — [Ryan Doser, 22 Aug 2026](https://ryandoser.com/dataforseo-review/)
- Local-pack traffic is reported as a separate value in DataForSEO Bulk Traffic Estimation — [DataForSEO docs](https://docs.dataforseo.com/v3/dataforseo_labs-google-bulk_traffic_estimation-live/)

Ratios and benchmarks
- Relentless Digital (agency, 2026): across 72 home-service companies (HVAC, plumbing, electrical, roofing), "roughly 10 of every 100 past customers contacted left a Google review"; 8,539 new reviews in total. Campaign examples: 754 reviews from 1,803 contacts (41.8%, Feb 2026); 77 from 103 (74.8%); a 5,469-contact list at 7.8%. Caveats: self-reported by a firm selling review services; total contacts for the 72 not given so the 10% cannot be recomputed; this is the response to an active request campaign, not a passive rate — [Relentless Digital](https://www.relentless-digital.com/google-reviews-per-100-past-customers)
- E-commerce rule of thumb: about 5–10% of customers leave a review unprompted; service businesses "between 25% and 32% when prompted and incentivized" — [Growave](https://growave.io/blog/what-percentage-of-customers-write-reviews) (review-software vendor, unverified)
- Survey: 45% of shoppers say they have ever left an online review, 55% never — Uberall survey reported by [NACS, 30 Nov 2018](https://www.convenience.org/Media/Daily/2018/Nov/30/3-Consumers-Turn-to-Online-Store-Reviews_Research) (self-reported, old)
- Average local business has 39 Google reviews — [BrightLocal, Google Reviews Study](https://www.brightlocal.com/research/google-reviews-study/) (secondary via search summary; study year not confirmed)
- A roundup claims revenue is "up approximately 18% with good reviews" with no method shown — [Shapo](https://shapo.io/blog/google-review-statistics/) (2025; not reliable)

### Inferences
- Review velocity (new reviews in the last 90 or 365 days, from review timestamps) is a better activity proxy than total count, because totals reflect business age and past review campaigns. It can be computed for the client and every competitor from the same paid endpoint, so it is at least consistent across the set.
- The safest use is relative, not absolute: competitor A gains reviews 3x faster than the client, so A is probably serving more customers. Converting to absolute customers needs the review rate, which the evidence puts anywhere from under 8% to over 40%; a 5x range.
- The client's own review rate can be calibrated: ask the client for last year's customer count and divide into their own new reviews. Applying the client's rate to competitors is an assumption (competitors that run review campaigns will look bigger than they are) and should be stated on the explanation page.
- Popular times is a 0–100 relative index per business, not a headcount, and is often missing for service-area businesses with no walk-in premises. It cannot be compared across businesses in absolute terms.
- Google Business Profile performance figures (calls, direction requests, profile views) are, as far as I know, available only to the profile owner and not for competitors; I did not find a source confirming this in this research, so it is listed under Gaps.

### Gaps
- No independent or academic study found giving reviews per customer for local businesses, by category or otherwise.
- No source reached on Google Business Profile Performance API access rules, or on purchasable foot-traffic panels (Placer.ai, SafeGraph/Dewey, Advan) and their prices. Not researched for lack of budget; worth a follow-up if walk-in categories matter.
- Yelp data access (Fusion API terms and price) not researched.
- DataForSEO price for My Business Info and Business Listings not captured (only Reviews pricing was on the page reached).
- No data found on local-pack click-through rates.

## 6. How do agencies and tools estimate a local category's total market size bottom-up?

### Takeaway
The standard bottom-up method is households (or population) in the service area × share that buys the category in a year × average annual spend, cross-checked against the number of local establishments; the inputs come from free US federal sources (Census population and County Business Patterns, BLS Consumer Expenditure Survey). I found the inputs well documented but no published end-to-end worked method for a small local category, and no free source for the incidence rate.

### Cited Findings
- BLS Consumer Expenditure Survey is used to estimate household spending by category; a City of Portland market study converted household counts into category spending totals using it, then tested capture rates of 2%, 10% and 20% — [City of Portland study](https://efiles.portlandoregon.gov/Record/13127388/File/Document) (date not confirmed)
- BLS notes the survey is built for price-index baskets, that others use it for regional work, and that the sample thins at small geographies (hierarchy runs from national down to block groups) — [BLS, regional household spending (2018 workshop)](https://www.bls.gov/cex/research_papers/pdf/ws2018-regional-household-spending.pdf)
- Commercial products model local spending from the Consumer Expenditure Survey: Esri publishes a "spending potential index" where 100 is the national average — [Esri, 2015 consumer spending methodology](https://downloads.esri.com/support/whitepapers/other_/2015_USA_ESRI_Consumer_Spending_Methodology.pdf); Environics offers average spend per consumer unit for any area — [Environics Analytics product list](https://environicsanalytics.com/docs/default-source/us---data-product-support-documents/consumer-buying-power---change-list.csv)
- Census County Business Patterns gives establishment counts, employment and payroll by industry for counties and is available by API — [data.gov, County Business Patterns](https://catalog.data.gov/dataset/annual-economic-surveys-business-patterns-county-business-patterns)
- Practitioner guidance: run top-down and bottom-up as two approaches and anchor to a named federal source with documented assumptions — [Vanta Insights, How to calculate market size](https://vantainsights.com/insights/how-to-calculate-market-size) (2026)
- BrightEdge labels its keyword-demand total "total addressable market", i.e. SEO tools size the market as total search demand, not total customers — [BrightEdge, Opportunity Forecasting](https://www.brightedge.com/products/s3/opportunity-forecasting)

### Inferences
- A workable structure for Mirror: service-area households (Census) × annual purchase incidence for the category × average ticket = category revenue; divide by average ticket for customers per year. Sanity-check by dividing by the local establishment count (County Business Patterns) to see whether the implied customers per business is plausible, and against the client's actual customer count.
- The Portland study's use of 2% / 10% / 20% capture scenarios is a precedent for showing low / mid / high rather than one figure.
- Consumer Expenditure categories are coarse (for example "personal care services", "maintenance and repairs") and do not map cleanly to a single trade, and the survey covers households, not business customers. Categories such as commercial services need a different base (establishment counts).
- Search-demand "TAM" (sum of keyword volume) and customer TAM are different things; SEO tools use the former. Mirror's page should state which one it means.

### Gaps
- No source found for annual purchase incidence by local service category (share of households hiring a plumber, visiting a dentist, etc.). This is the weakest input and would need category-by-category sourcing (trade associations, IBISWorld-type reports).
- IBISWorld pricing and API availability not researched; I found no evidence of a small-budget API.
- Census API query parameters and current data vintages not verified.
- Non-US markets not covered.

## 7. How well have SEO forecasts held up when checked afterwards?

### Takeaway
I found no published backtest of SEO traffic forecasts against actual results. The only SEO-specific figure is a vendor survey (58% of independently made SEO forecasts land within ±10% of actual revenue), and the best-audited analogue, road-traffic forecasting, shows typical errors of 17–40% with a bias toward over-prediction.

### Cited Findings
- NP Digital survey of 210 marketing teams (June 2026): SEO forecast independently "produces 58 percent accuracy", where accuracy means within ±10% of actual revenue — [Neil Patel, forecasting SEO and paid together](https://neilpatel.com/marketing-stats/forecasting-seo-paid-together-revenue-accuracy/) (vendor survey, self-reported; page returned 403 on direct fetch, figure from search summary)
- Opinion piece: a forecast that hard-codes click behaviour "will drift further from accuracy with each percentage point increase in zero-click rate" — [Neil Patel, forecast accuracy and zero-click](https://neilpatel.com/marketing-stats/forecast-accuracy-ai-search-zero-click/) (not a backtest; not opened)
- Road-traffic analogue, Virginia retrospective of 39 studies: median absolute percent error ranged from 1% to 134%, averaging 40%; forecasts tended to exceed observed volumes — [Virginia Transportation Research Council, report 17-R1](https://vtrc.virginia.gov/reports/all-reports/17-r1/)
- US un-tolled roads: general over-prediction, actual traffic deviating from forecast by about 17.29% on average — [University of Kentucky thesis](https://uknowledge.uky.edu/ce_etds/79)
- National Academies review: actual traffic about 6% below forecast on average; method, forecast horizon and recessions together explained only about 29% of the variation in error — [National Academies, NCHRP report](https://nap.nationalacademies.org/read/25637/chapter/15)
- The inputs themselves moved sharply within two years: #1-position CTR on AI Overview keywords fell from 0.073 to 0.016 between Dec 2023 and Dec 2025 — [SEOworth summary of Ahrefs](https://seoworth.it.com/news/ahrefs-ai-overviews-ctr-study/) (secondary)
- Underlying traffic estimates that forecasts start from are themselves 22–68% off on average (see section 4) — [Analyze AI](https://www.tryanalyze.ai/blog/traffic-estimations-accuracy); [Geotoolbox](https://geotoolbox.ai/blog/semrush-vs-ahrefs.md)

### Inferences
- "58% within ±10%" is a self-reported survey answer, not a measured result, and is hard to square with input errors of 20–70% and a CTR that fell by three quarters in two years. Treat it as an upper bound on how good teams think they are.
- Errors compound multiplicatively. A chain of four inputs each uncertain by ±30% gives an end range of roughly 0.24x to 2.9x the midpoint (0.7^4 to 1.3^4; my arithmetic). A Mirror forecast with visibility gap × demand × visit lift × conversion × customer value has at least that many links, so an honest range will be wide.
- Forecasts in well-audited fields skew high. The safe default is to present the conservative scenario most prominently.
- Since no competitor publishes a backtest, logging each forecast and comparing it to the client's reported new customers later would be a genuine differentiator, and the only way to tighten the range over time. The transport studies give the template: percent error per forecast, direction of bias, error by forecast horizon.

### Gaps
- No SEO or AI-visibility forecast backtest found from any tool vendor, agency or academic source.
- The NP Digital survey method (how accuracy was measured, who responded) could not be read.
- No evidence on whether forecast error is smaller for local businesses or larger.
