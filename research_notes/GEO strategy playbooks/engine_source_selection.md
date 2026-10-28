# How AI Answer Engines Find and Choose the Sources They Cite (2025-2026)

Scope: ChatGPT, Google AI Overviews / AI Mode, Gemini app, Perplexity, Claude, Grok, Microsoft Copilot. Research date: 2026-10-14. Almost every large citation study here comes from a vendor that sells GEO, SEO or listings tools (Profound, Ahrefs, Semrush, Peec AI, Yext, Seer, seoClarity, Surfer). Treat them as useful but not neutral. Methods differ a lot (share of all citations vs share of top-10 sources; API vs app; logged-out vs logged-in), so figures across studies are NOT directly comparable.

## 1. What index or partners does each engine retrieve from, and which crawlers matter?

### Takeaway
Each engine has a different "gate." ChatGPT: OAI-SearchBot allowed, plus being in the Bing-like retrieval set (now increasingly Google-like, the evidence conflicts). Google AIO/AI Mode/Gemini: normal Googlebot indexing with a snippet allowed. Claude: Brave Search's index. Copilot: Bing. Perplexity: its own index plus licensed Yelp and Tripadvisor data. Grok: X posts plus web search. Blocking the training crawlers (GPTBot, Google-Extended) does not remove a site from live answers. Blocking the search crawlers does.

### Cited Findings
**ChatGPT (OpenAI official docs)**
- OAI-SearchBot "is used to surface websites in search results in ChatGPT's search features." "Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers" (though they can still appear as navigational links). "It can take ~24 hours from a site's robots.txt update for our systems to adjust." — [OpenAI bots docs](https://developers.openai.com/api/docs/bots)
- GPTBot is for training only. "Disallowing GPTBot indicates a site's content should not be used in training generative AI foundation models." It is independent of search inclusion. — [OpenAI bots docs](https://developers.openai.com/api/docs/bots)
- ChatGPT-User handles user-triggered page visits. "robots.txt rules may not apply." It is "not used to determine whether content may appear in Search." OAI-AdsBot checks ad landing pages. — [OpenAI bots docs](https://developers.openai.com/api/docs/bots)
- Bing dependence (secondary reports, primary data not published): a Seer Interactive study of 500+ citations reportedly found 87% matched Bing results vs 56% matching Google. AirOps reportedly measured 73% ChatGPT-to-Bing overlap. A Profound figure, reported second-hand, shows Bing alignment FALLING from 26% to 8% while Google alignment rose from 12% to 33%. The sources conflict, so the "ChatGPT = Bing" assumption is no longer safe. — [aiplusautomation summary](https://aiplusautomation.com/blog/chatgpt-bing-or-google); [search summary of multiple vendor blogs](https://up-review.co/en/articles/seo-for-chatgpt-2026-strategy)
- AirOps reportedly found ChatGPT cites only ~15% of the pages it retrieves, and the top-3 Bing URLs matched actual citations only 6.8-7.8% of the time. Being in the retrieved set matters more than rank position (secondary). — [aiplusautomation](https://aiplusautomation.com/blog/chatgpt-optimization-complete-guide)
- ChatGPT local data: one vendor blog claims Foursquare appears in ~70% of local recommendation queries and Yelp in ~33%. This is unverified single-vendor data. — [MapAtlas](https://mapatlas.eu/blog/chatgpt-local-business-data-sources-foursquare)
- In Yext's 6.8M-citation study, ChatGPT (API) drew 48.73% of its citations from listings, and Google was its largest listing source (465,000+ citations). — [Yext Research](https://www.yext.com/research/articles/ai-citations-user-locations-query-context/)

**Google AI Overviews / AI Mode (Google Search Central)**
- "There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary." A page "must be indexed and eligible to be shown in Google Search with a snippet." "You don't need to create new machine readable files, AI text files, or markup." — [Google Search Central: AI features](https://developers.google.com/search/docs/appearance/ai-features)
- Controls: Googlebot robots.txt governs Search crawling. Google-Extended limits training and grounding in *other* Google systems. nosnippet, data-nosnippet, max-snippet and noindex limit what is shown. — [Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)
- AI Mode and AIO "may use different models," so their links differ. AIOs show only when "additive to classic Search." Clicks are counted in Search Console under the "Web" search type. — [Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

**Gemini app**
- Gemini uses Google Business Profile data in answers but does not cite it, because the data is proprietary. 52.15% of Gemini's citations came from first-party websites, the highest of the three models Yext tested. — [Yext Research](https://www.yext.com/research/articles/ai-citations-user-locations-query-context/)

**Perplexity**
- Licenses Yelp data through Yelp's Fusion program for maps, reviews and photos in local answers, and says it will not use the data for training. — [Maginative](https://www.maginative.com/article/perplexity-enhances-ai-search-engine-with-direct-yelp-data-integration/)
- Tripadvisor partnership (trial began January 2025): reviews, AI summaries and 300,000+ Viator experiences, which Perplexity "syncs regularly." — [Skift](https://skift.com/2025/01/14/tripadvisor-exec-explains-partnership-with-chatgpt-competitor-perplexity/)
- In Yext's data, MapQuest was Perplexity's largest listing source (364,000+ citations) and Tripadvisor its largest review source (239,000+). Perplexity had the highest share from industry directories on unbranded subjective queries (24%). — [Yext Research](https://www.yext.com/research/articles/ai-citations-user-locations-query-context/)

**Claude**
- Claude's web search appears to use Brave Search. Simon Willison found a "BraveSearchParams" parameter and identical citations, and Brave was added to Anthropic's subprocessor list in March 2025. — [TechCrunch, Mar 2025](https://techcrunch.com/2025/03/21/anthropic-appears-to-be-using-brave-to-power-web-searches-for-its-claude-chatbot/)
- Profound reportedly found 79.2% of Claude-cited URLs sit in Brave's top 10 for the query, vs 34% in Google's top 10 (secondary report). — [search summary: shahabpapoon.com](https://www.shahabpapoon.com/blog/claude-web-search-runs-on-brave); [oltre.ai](https://www.oltre.ai/en/blog/how-claude-picks-sources-technical-breakdown-claude-citations/)

**Grok**
- The xAI API exposes `web_search` and `x_search` tools. X search can be filtered by handle and date, and citations come back with URL or post and author (third-party docs). The old "Live Search" API was reportedly retired in early 2026; sources conflict on this. — [Hermes Agent docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/x-search); [FixAEO](https://fixaeo.com/blogs/does-grok-search-the-web/)

**Microsoft Copilot**
- Bing Webmaster Tools' "AI Performance" report entered public preview on 10 Feb 2026. It covers citations in Copilot, Bing AI summaries and "select partner integrations," and shows "Grounding Queries" plus "citation share" per query. It has no click data and is sampled. — [Search Engine Land](https://searchengineland.com/bing-webmaster-tools-testing-new-ai-performance-report-468039); [Practical Ecommerce](https://www.practicalecommerce.com/bings-improved-ai-performance-section)

### Inferences
- Base-layer checklist for any business: allow Googlebot, Bingbot, OAI-SearchBot and the Perplexity and Claude search bots in robots.txt. GPTBot and Google-Extended can be blocked without losing live citations (training-memory exposure is lost, though; see section 5). Get indexed in Google, Bing (submit via Bing Webmaster and IndexNow) and Brave.
- Copilot is the one engine with a first-party citation report. A GEO tool could pull Bing's grounding queries as ground truth.
- For local businesses, listings feed each engine differently: Google Business Profile for Gemini/AIO/AI Mode, Yelp, Tripadvisor and MapQuest for Perplexity, Google listings and possibly Foursquare for ChatGPT, Bing Places likely for Copilot (unverified).

### Gaps
- Official crawler docs for Perplexity (PerplexityBot, Perplexity-User), Anthropic (Claude's search and user bots) and xAI were not fetched in this session. Exact user-agent names and robots.txt behavior for those three are unverified here.
- No primary source found on whether ChatGPT's retrieval today is Bing, Google-scraped results, or OpenAI's own index. Vendor figures conflict.
- No source found linking Bing Places to Copilot local answers, or on ChatGPT Shopping merchant feeds.
- Anthropic has not officially confirmed Brave as its search provider.

## 2. Which domains and source types does each engine cite most, and how does this differ by business type?

### Takeaway
Reddit and YouTube lead across most engines. ChatGPT leans on Wikipedia and editorial sites (Forbes, TechRadar) and has been shifting toward official brand sites. Perplexity is the most Reddit- and review-heavy (G2, Yelp, Tripadvisor). Google's AI surfaces lean social and UGC (YouTube, Reddit, Facebook, Yelp). For local businesses, brand websites and listings dominate (Yext: about 86% "brand-managed"). For B2B/SaaS, G2, LinkedIn, Gartner and listicles matter more.

### Cited Findings
- **Profound** (680M citations, Aug 2024-Jun 2025, updated Aug 2025; Profound is a GEO vendor; method not described). Share of all citations:
  - ChatGPT: Wikipedia 7.8%, Reddit 1.8%, Forbes 1.1%, G2 1.1%, TechRadar 0.9%, NerdWallet 0.8%
  - Google AIO: Reddit 2.2%, YouTube 1.9%, Quora 1.5%, LinkedIn 1.3%, Gartner 0.7%
  - Perplexity: Reddit 6.6%, YouTube 2.0%, Gartner 1.0%, Yelp 0.8%, LinkedIn 0.8%, TripAdvisor 0.6%, G2 0.6%
  - Reddit held 46.7% of Perplexity's *top-10-source* share.
  - [Profound](https://www.tryprofound.com/blog/ai-platform-citation-patterns)
- **Peec AI** (30M sources, US; GEO vendor; no collection period or per-domain percentages given). Overall top 10: Reddit, YouTube, LinkedIn, Wikipedia, Forbes, G2, Yelp, Facebook, Medium, TechRadar. Top 5 by engine:
  - AI Mode: YouTube, Reddit, Facebook, LinkedIn, Yelp
  - AIO: YouTube, Reddit, Facebook, LinkedIn, Medium
  - Gemini: Reddit, YouTube, Wikipedia, Medium, PCMag/Forbes
  - Perplexity: Reddit, YouTube, LinkedIn, Wikipedia, G2
  - ChatGPT: Wikipedia, Reddit, Forbes, TechRadar, LinkedIn
  - Reddit was "#1 or #2" on every engine. G2 was flagged for B2B (Perplexity), Clutch for B2B services, and Yelp and Tripadvisor for local and hospitality.
  - [Peec AI](https://peec.ai/blog/top-domains-cited-by-ai-search-analysis-based-on-30m-sources)
- **Ahrefs, ChatGPT shift** (US ChatGPT citations, Mar-Sep 2026, 2.4-3.8M answers/month; Ahrefs sells AI tracking): Reddit citations fell 88%, Wikipedia 80% and YouTube 27% from March to September 2026. Partner publications' share rose from 7.5% to 15.8% (July), then 12.5%. For factual questions, 84.4% of answers cited at least one official source, vs 68.3% for comparisons. 75.9% of `site:` fan-out searches targeted brand sites. — [Ahrefs, Oct 2026](https://ahrefs.com/blog/query-fan-out-chatgpt/)
  - This contradicts the older Profound and Peec rankings for ChatGPT. Reddit/Wikipedia-heavy findings for ChatGPT should be treated as dated.
- **LLM Pulse** (May 2026) reportedly puts YouTube first and Reddit second (search-snippet level only). — [LLM Pulse](https://llmpulse.ai/data-studies/top-cited-domains)
- **Yext** (6.8M citations from ChatGPT, Gemini and Perplexity via API, Jul 1-Aug 31 2025, Yext client/prospect locations across 200,000+ locations; Yext sells listings management):
  - First-party websites: 2.9M+ citations. Listings: 2.9M+. Reviews/social: 545,000+. Reddit: just over 2% (~154,000).
  - Headline claim of "86% brand-managed." The category totals sum to ~93% of 6.8M, so the headline figure does not reconcile.
  - By industry: Healthcare listings 52.61% (highest). Food service listings 41.63% and reviews 13.28%. Financial-services websites 48.16%. Retail websites 47.62%.
  - Unbranded objective queries: websites exceed 40% on all three models.
  - Branded subjective queries on ChatGPT: third-party directories peak at 46.3%.
  - [Yext Research](https://www.yext.com/research/articles/ai-citations-user-locations-query-context/); [Yext press release](https://www.yext.com/about/news-media/ai-citations-release)
- A Muck Rack analysis reportedly found 84% of AI links came from earned media, which conflicts with Yext's framing (secondary mention only). — [search summary citing Muck Rack](https://openlens.com/blog/en/how-ai-recommends-local-businesses-source-audit)

### Inferences
- **Local services (med spa, dentist, restaurant):** the biggest levers are the website (clear service, location, price and FAQ facts) and listings. Healthcare is the most listing-dependent vertical, so Google Business Profile, Yelp, MapQuest-fed data aggregators and industry directories come first. Reviews (Yelp, Tripadvisor) matter most for food and hospitality and for Perplexity.
- **B2B/SaaS:** G2, Gartner, LinkedIn, TechRadar/Forbes-style listicles and Reddit threads carry more weight, especially for Perplexity and ChatGPT comparison prompts.
- **Consumer apps** (e.g., a student career tool): YouTube and Reddit presence plus "best X" listicles likely matter most. ChatGPT's 2026 shift toward official sources means the brand's own pages (pricing, features, specs) should state the facts plainly.

### Gaps
- No large study found that covers Claude, Grok or Copilot citation domain mixes with the same method as the others.
- No study isolates "student/consumer SaaS" as a category. The B2B vs local split is inferred from vertical mentions.

## 3. How well does classic search ranking predict being cited, and what does query fan-out imply?

### Takeaway
Ranking top 10 for the exact prompt is a weak predictor: roughly 12-38% overlap depending on engine and study. The engines rewrite one prompt into several sub-searches (adding "best," "2026," "reviews," "price," "official," "vs," and site: searches), and ranking for those sub-queries predicts citation better than ranking for the head term. Off-site brand mentions (especially YouTube) correlate with AI visibility far more than backlinks do.

### Cited Findings
- Google officially uses fan-out: AI features may issue "multiple related searches across subtopics and data sources." — [Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)
- **ChatGPT fan-out** (Ahrefs: 66.6M logged-out responses, Aug-Sep 2026, 15M fan-outs):
  - ~1.6 fan-out queries per searching response. 6.8% of fan-outs are `site:` searches.
  - In September, "2026" appeared in 22.9% of fan-outs, "official" in 13.1% and "price" in 8.9%. "Reviews" grew by about a third.
  - In a running-shoes example, "best," "2026," "review," "vs" and "official" were the most common added terms.
  - [Ahrefs](https://ahrefs.com/blog/query-fan-out-chatgpt/)
- Nectiv (8,500+ prompts, late 2025) reportedly found ~2.17 searches per prompt, capped at four (via French press summary). — [Siècle Digital](https://siecledigital.fr/2025/11/18/chatgpt-31-des-requetes-declenchent-desormais-une-recherche-en-ligne/)
- **Rank overlap with AI citations:**
  - Ahrefs, AIO (863k keyword SERPs, 4M AIO URLs): only 38% of cited pages rank in the top 10. An earlier ~76% figure was reported second-hand.
  - Surfer, Dec 2025: 68% of AIO-cited pages were not in the top 10, and pages ranking for fan-out queries were 161% more likely to be cited.
  - [secondary summary of studies](https://www.ekamoira.com/blog/query-fan-out-original-research-on-how-ai-search-multiplies-every-query-and-why-most-brands-are-invisible)
- seoClarity, AI Mode (1,000 transactional US queries, Sep 2025): only 19% of AI Mode citations came from the top-20 web rankings, and top-10 overlap occurred for 28% of queries. — [seoClarity](https://www.seoclarity.net/ai-mode-rankings-overlap)
- Ahrefs (15,000 long-tail queries): only 12% of AI-assistant (e.g., ChatGPT) citations appear in Google's top 10 for the same query (secondary). — [aiplusautomation](https://aiplusautomation.com/blog/chatgpt-bing-or-google)
- iPullRank reportedly measured AI search queries at 70-80 words (Dec 2025) vs 3-4 words for classic search, and identified 8 query-variant types in Google's fan-out (secondary). — [iPullRank on fan-out personalization](https://ipullrank.com/query-fan-out-personalization)
- **Ahrefs, 75,000 brands** (Dec 2025, Spearman correlations; correlation is not causation):

  | Factor | ChatGPT | AI Mode | AIO |
  |---|---|---|---|
  | Branded web mentions | 0.664 | 0.709 | 0.656 |
  | Branded anchors | 0.511 | 0.628 | 0.527 |
  | Branded search volume | 0.352 | 0.466 | 0.392 |
  | Domain Rating | 0.266 | 0.285 | 0.326 |

  - YouTube mentions ~0.737 across platforms. Backlinks were "very weak."
  - [Ahrefs](https://ahrefs.com/blog/ai-brand-visibility-correlations)
- Claude reportedly does not re-rank much and pulls near-directly from Brave's top 10 (secondary). — [oltre.ai](https://www.oltre.ai/en/blog/how-claude-picks-sources-technical-breakdown-claude-citations/)

### Inferences
- Classic rank still matters most for Claude (Brave top 10) and probably Copilot (Bing). It matters least for AI Mode.
- The fan-out implication for a GEO tool: generate each prompt's likely sub-queries ("best [category] [city] 2026," "[brand] reviews," "[brand] price," "[brand] vs [competitor]," "site:brand.com") and check rankings and coverage for those, not just the head prompt.
- Off-site mentions (YouTube, listicles, Reddit, press) are the strongest measured correlate for ChatGPT and Google AI. This applies to SaaS and consumer brands; local businesses get the equivalent from listings and reviews.

### Gaps
- No primary iPullRank overlap number was found.
- No fan-out data for Perplexity, Claude, Grok or Copilot (Copilot's grounding-query report is the only first-party view).

## 4. Freshness, recency bias, and how fast changes spread

### Takeaway
ChatGPT has the strongest recency bias, Perplexity is moderate, and Google AIO the weakest (it even skews slightly older than organic results). Robots.txt changes reach ChatGPT in about 24 hours. Google recrawls can take "several days to several months." Refreshing (updating) existing pages counts: many "fresh" citations are old pages with new update dates.

### Cited Findings
- **Ahrefs** (17M AI citations, Jul 2025, secondary summary): AI-cited pages averaged 1,064 days old vs 1,432 for organic Google, i.e. 25.7% fresher.
  - ChatGPT-cited URLs were ~393 days newer than organic.
  - Perplexity ~250 days newer.
  - AIO cited pages ~16 days *older* than organic.
  - [NoGood summary](https://nogood.io/blog/content-freshness-ai-citations/)
- **Seer** (5,000+ cited URLs): 71% of ChatGPT citations were from 2023-2025, ~80% for Perplexity, ~85% for AIO. A later Seer study reportedly found only 42% of recent-looking cited pages were actually newly published; the rest were refreshed. — [Seer Interactive](https://www.seerinteractive.com/insights/study-ai-brand-visibility-and-content-recency)
- Ahrefs found "2026" in 22.9% of ChatGPT fan-outs (Sep 2026). ChatGPT actively searches for current-year content. — [Ahrefs](https://ahrefs.com/blog/query-fan-out-chatgpt/)
- OpenAI says robots.txt changes take ~24h for OAI-SearchBot. — [OpenAI](https://developers.openai.com/api/docs/bots)
- Google says "crawling can take anywhere from several days to several months" for preview-control changes. — [Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)
- Perplexity "syncs regularly" with Tripadvisor partner data. — [Skift](https://skift.com/2025/01/14/tripadvisor-exec-explains-partnership-with-chatgpt-competitor-perplexity/)

### Inferences
- Put "2026"/"updated [month]" and current pricing on key pages, and refresh comparison and listicle pages quarterly. This is a ChatGPT and Perplexity lever, less so for AIO.
- Listing and review updates likely reach Perplexity and Gemini faster than website content does, since they come through data feeds and GBP rather than recrawls (inferred).

### Gaps
- No measured re-crawl or propagation times for Brave (Claude), Bing (Copilot) or Perplexity's own index.
- Primary Ahrefs freshness report not fetched; figures come via secondary summary.

## 5. How much comes from model memory vs live retrieval?

### Takeaway
The share varies hugely: ChatGPT searches the web on roughly 14-35% of natural prompts (up to 58-80% in some commercial or comparison test sets). So for most ChatGPT answers, what the model already "knows" from training decides which brands get named. Perplexity, Google AIO/AI Mode and Copilot retrieve live for essentially every answer (by design; not quantified in sources found).

### Cited Findings
- Ahrefs (66.6M logged-out ChatGPT responses, Aug-Sep 2026): 14.4% triggered a web search; "about 6 in 7 answers did not search." Their conclusion: "visibility depends on what ChatGPT already knows about a brand." — [Ahrefs](https://ahrefs.com/blog/query-fan-out-chatgpt/)
- Semrush (clickstream): ChatGPT search triggered on 34.5% of queries as of Feb 2026, down from 46% in late 2024 (secondary). — [Semrush](https://www.semrush.com/blog/chatgpt-search-insights/)
- Nectiv (8,500+ prompts, late 2025): 31% triggered search (secondary, French press). — [Siècle Digital](https://siecledigital.fr/2025/11/18/chatgpt-31-des-requetes-declenchent-desormais-une-recherche-en-ligne/)
- Graphite: 58% of ChatGPT responses searched on entity-comparison prompts. Forcing search in prompt tracking shifts measured visibility by ~20 points on average. — [Graphite Five Percent](https://graphite.io/five-percent/research/do-not-force-search-prompt-tracking)
- cloro: grounding in 80.5% of responses in its test set (vendor). — [cloro](https://cloro.dev/blog/chatgpt_grounding_frequency_study/)
- Peec notes Wikipedia influences AI "through both live retrieval and training data." — [Peec AI](https://peec.ai/blog/top-domains-cited-by-ai-search-analysis-based-on-30m-sources)

### Inferences
- Two-track strategy:
  1. **Memory track** (ChatGPT non-search answers, Claude and Gemini without search): be widely and consistently mentioned on crawlable, training-friendly sources (Wikipedia/Wikidata where eligible, Reddit, YouTube, press, review sites). Do not block GPTBot or Google-Extended if memory visibility is a goal. This is slow; it changes only with new model releases.
  2. **Retrieval track** (AIO, AI Mode, Perplexity, Copilot, ChatGPT search): indexing, fan-out coverage, freshness and listings. This is fast; changes show in days to weeks.
- Local "near me" and commercial prompts are the most likely to trigger search, so local businesses lean on the retrieval track. National SaaS or consumer brands queried generically ("best career tools for students") depend more on memory.
- Measurement implication: a GEO tool should track ChatGPT both with and without forced search, since forcing search distorts visibility by ~20 points (Graphite).

### Gaps
- No published retrieval rate found for Claude, Gemini app, Grok or Copilot.
- No study found on how often new model releases refresh brand knowledge, or on training cutoff lag per engine.
