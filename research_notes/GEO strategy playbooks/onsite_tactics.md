# On-site tactics that measurably increase citation/recommendation in AI answers (2025-2026)

Evidence grades used throughout:
- **[CE] Controlled experiment**: randomized/factorial/difference-in-differences test isolating the tactic
- **[LC] Large correlational study**: big observational dataset, no causal isolation
- **[PA] Practitioner anecdote**: case studies, single sites, vendor claims, expert opinion without data
- **[MYTH]**: claim tested and not supported, or contradicted by primary data

Research date: October 2026. Caveat for the report writer: almost all non-academic studies come from vendors that sell AI-visibility tools (Ahrefs, BrightLocal, Peec, Search Atlas, etc.). The academic studies mostly test what an LLM does with documents *already placed in its context*, which is not the same as getting retrieved by a live engine.

## Q1. What did the Princeton/Georgia Tech GEO paper find, and did follow-up studies replicate it?

### Takeaway
The original GEO paper (KDD 2024, older evidence) found that adding quotations, statistics and citations to a page raised its share of the AI answer by roughly 30-40% in a lab setup, and keyword stuffing hurt. A 2025 NeurIPS benchmark (C-SEO Bench) largely failed to replicate this: most content-rewriting tricks had no significant effect, and gains disappear when competitors do the same thing. The strongest 2026 controlled study says what wins is topic match, explicit prices, recent dates and ranking position, not formatting.

### Cited Findings
- Original paper: "GEO: Generative Engine Optimization," Aggarwal et al., first submitted Nov 2023, accepted to KDD 2024; abstract claims GEO "can boost visibility by up to 40%" and that effectiveness varies by domain — [arXiv 2311.09735](https://arxiv.org/abs/2311.09735) **[CE, older, lab setting]**
- Per a 2026 critical survey of GEO: on GEO-bench (10,000 queries, 5 sources in context), Quotation Addition raised the position-adjusted word-count metric from 19.3 to 27.2 (~41% relative; the source of the "up to 40%" headline); Statistics Addition 25.2; Cite Sources 24.6; Fluency Optimization 24.7; Keyword Stuffing fell to 17.7, below baseline — [Critical Survey of GEO 2023-2026, arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)
- Gains depended heavily on starting rank: under Cite Sources, the 5th-ranked source gained 115.1% while the 1st-ranked source lost 30.3% — i.e. the tactics mainly help low-ranked pages and can hurt top pages — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)
- The paper's Perplexity test used 200 uploaded files, not organic retrieval; gains up to 22% (position-adjusted) and 37% (subjective impression) — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)
- **C-SEO Bench** (Puerto et al., arXiv 2506.11097, NeurIPS 2025 Datasets & Benchmarks): "most current C-SEO methods are largely ineffective, contrary to reported results in the literature"; only 3 of 54 method-domain cells were significant after Bonferroni-Holm correction; none helped in question answering; gains shrank as more actors adopted the same tactic — [AI Search Glossary summary](https://aisearchglossary.com/terms/c-seo-bench); [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1) **[CE — contradicts original]**
- **E-GEO** (Bagga et al., 2025, arXiv 2511.20867), e-commerce: 10 of 15 initial rewriting heuristics were neutral or negative; systematically optimized (learned) rewrites did better — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1) **[CE]**
- **AutoGEO** (Wu et al., 2026): average +35.99% improvement, but only with five retrieved documents fixed in context — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1) **[CE, lab only]**
- **SAGEO Arena** (Kim et al., 2026, arXiv 2602.12187), which models the full retrieve → rerank → cite pipeline: optimizing only the page body *cut* top-20 retrieval presence ~9%, top-10 after reranking ~16%, and final citation ~6%; AutoGEO-style body rewriting caused larger losses — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1) **[CE — rewriting for the LLM can hurt retrieval]**
- **"What Gets Cited: Competitive GEO in AI Answer Engines"** (Vishwakarma, Kumar, Jamidar — Sprinklr; SIGIR 2026, arXiv 2605.25517): 18 single-factor manipulations of product-review pages, two sources in context, order swapped, 6 LLMs (~252,000 trials total). Four "gatekeeper" factors were significant in all six models with very large effects (odds ratio > 100): **topic mismatch, price not mentioned, recent vs old timestamp, lower list position**. Seven secondary factors (OR 2.1-243): missing specifications, less comprehensive, hedged language, claims with evidence, internal contradictions, keyword gap, no comparisons. **Formatting ("dense paragraph vs organized sections", "scattered information") had no impact.** Overly promotional, weaker social proof, and no-timestamp variants were inconsistent. Authors' advice: "surface core topic terms early, add explicit price and key specs, include comparisons, keep dates current, and replace hedging with evidence-backed claims"; "Formatting changes showed minimal return and can be deprioritized." Limitation: post-retrieval testbed, brands anonymized — [arXiv 2605.25517](https://arxiv.org/pdf/2605.25517) **[CE]**
- Chen et al. 2025a ("Generative engine optimization: How to dominate AI search," arXiv 2509.08919): earned media is overrepresented in AI answers vs brand-owned sites (observational) — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1) **[LC]**
- CC-GSEO-Bench (arXiv 2509.05607, Sept 2025) benchmarks nine rewriting strategies; survey notes LLM-generated queries and automated judges with no human validation — [arXiv 2509.05607](https://arxiv.org/abs/2509.05607); [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)
- Warning from the survey: fabricated statistics can raise reuse while degrading accuracy — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)
- Sharma 2026 (arXiv 2601.00912): startups were recognized by name at high rates but surfaced in only 3.32% of ChatGPT organic discovery queries — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1) **[LC]**

### Inferences
- The "add stats/quotes/citations = +40%" claim widely repeated by agencies should be graded as **lab-only, not replicated** in realistic competitive settings. Keep "add real, sourced statistics" as a quality tactic, not a guaranteed lever.
- Rewriting copy in "LLM style" can reduce retrieval. The bottleneck is usually getting retrieved (classic SEO/indexing), then being the most complete/specific/current candidate.
- The most transferable, controlled-evidence to-dos for product/SaaS pages: state the price explicitly on the page (not "contact us"), list key specs, include a comparison to alternatives, show a recent date, use confident evidence-backed claims instead of hedges, and put the core topic terms early.

### Gaps
- I could not read the full C-SEO Bench paper directly; its numbers come via the survey and a glossary summary.
- No controlled study found that tests these tactics on live ChatGPT/Perplexity/AI Overviews retrieval end-to-end with real brands.
- I did not locate a paper titled "What generative search engines like"; the closest match per the survey is Chen et al. 2025a (arXiv 2509.08919).

## Q2. Content structure: answer-first, chunking, question headings, FAQ, tables, best-X/vs/alternatives pages, pricing pages, original data

### Takeaway
Best evidence for structure is correlational: ChatGPT pulls ~44% of citations from the first 30% of a page, so put the answer and key facts early. Formatting alone (headings, lists, sections) did not move citation in a controlled test. "Best X" listicles and comparison pages were heavily cited in 2025, but their share fell by roughly half after a 2026 ChatGPT model change. Pricing info on the page has strong controlled evidence.

### Cited Findings
- Kevin Indig (Growth Memo) analysis of ~1.2M ChatGPT answers and 18,012 verified citations: 44.2% of citations come from the first 30% of a page, 31.1% from the middle, 24.7% from the final third ("ski ramp"). Within a paragraph, the middle supplied the largest share. Cited passages were ~2x as likely to use clear definitional language; "entity richness" was another trait of cited content — [Search Engine Land](https://searchengineland.com/chatgpt-citations-content-study-469483); [Growth Memo](https://www.growth-memo.com/i/188121887/3-entity-richness); [conversion.com.br summary](https://www.conversion.com.br/blog/chatgpt-citacoes-primeiro-terco-conteudo) **[LC]** (note: secondary sources report differing dataset sizes — 1.2M responses vs. 3M responses/30M citations; check the original)
- Controlled test: formatting-only changes (organized sections vs. dense paragraph) had no consistent effect on which source is cited first — [arXiv 2605.25517](https://arxiv.org/pdf/2605.25517) **[CE]**; "No Comparisons" and "Missing Specifications" did significantly reduce citation — same source **[CE]**
- Explicit price on page: "Price Not Mentioned" was one of four universal gatekeepers (OR > 100 in all six models). Example the authors flag as weak: "Contact us for pricing details." — [arXiv 2605.25517](https://arxiv.org/pdf/2605.25517) **[CE]**
- Wix Studio AI Search Lab (75,000 answers, via secondary coverage): listicles ~21.9% of citations, articles ~16.7%, product pages ~13.7% — [mean.ceo summary](https://blog.mean.ceo/startup-news-ai-citation-study-listicles-articles-product-pages-2026/) **[LC, secondary]**
- Peec AI data after ChatGPT 5.6 (2026): listicle citations fell from ~15.8% to ~7.8%; comparison pages from ~9.1% to ~6.2%, following a drop in "best/top/vs/comparison" fan-out queries — [Lily Ray on X](https://x.com/lilyraynyc/article/2090256147441746150); [AI Marketing Newsletter](https://the-ai-marketing-newsletter.beehiiv.com/p/just-in-chatgpt-5-6-cites-half-as-many-listicles) **[LC]**
- Google says content chunking/AI-specific rewriting isn't needed (per secondary coverage of Google's 2026 AI optimization guide) — [Search Engine Journal](https://searchenginejournal.com/googles-new-ai-search-guide-calls-aeo-and-geo-still-seo/575026); [Previsible](https://previsible.io/seo-ai-news/google-published-its-first-guide-to-ai-search-optimization/) **[official guidance, secondary]**
- SAGEO Arena: structural fields could help retrieval without helping reranking or citation — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1) **[CE]**
- Original data: Growth Memo has a piece titled "Why most original data never gets [cited]" — [Growth Memo](https://www.growth-memo.com/p/why-most-original-data-never-gets) (content not retrieved)

### Inferences
- Concrete to-dos with reasonable evidence: (1) answer the target question and state key facts (price, location, who it's for, specs) in the top third of the page, ideally the opening paragraph [LC]; (2) use plain definitional sentences ("X is a ... that ...") [LC]; (3) put explicit pricing on a pricing page and on product pages [CE]; (4) include a comparison section/table vs named alternatives [CE for "comparisons present"; tables specifically are untested]; (5) list concrete specs/service details [CE].
- FAQ blocks and question-format headings: no controlled or large study isolating them found; formatting-only edits showed no effect in the controlled study. Grade as **[PA]** — fine as a way to cover more questions, not as a ranking lever.
- "Best X for Y" and "X vs Y / alternatives" pages on your own site: heavily cited page types in 2025, but share dropped ~50% in 2026 for ChatGPT, and third-party listicles (not self-published) dominate. Grade **[LC, declining]**. Self-serving "best X" lists where you rank #1 are a known spam pattern (no data found on penalty in AI answers).

### Gaps
- No controlled evidence on FAQ blocks, question headings, or tables specifically.
- Couldn't retrieve the Growth Memo original-data piece; no rigorous study found showing original statistics on your own site increase citation in live engines (only the lab GEO results, which C-SEO Bench didn't replicate).

## Q3. Technical: AI crawlability, JS rendering, speed, sitemaps, IndexNow/Bing, schema.org, llms.txt

### Takeaway
Hard requirements (strong evidence): let AI bots crawl, and serve the important content in the initial HTML, because GPTBot, ClaudeBot and PerplexityBot do not run JavaScript. Schema markup is hygiene: cited pages have it more often, but adding it did not raise citations in Ahrefs' causal test, and Google says no special schema is needed. llms.txt is essentially unused by AI crawlers: grade as myth.

### Cited Findings
- Vercel/MERJ (Dec 2024, older): GPTBot made 569M and ClaudeBot 370M requests in a month; they download JS files (11.50% / 23.84% of requests) but do not execute them; PerplexityBot (24.4M fetches) also lacks rendering; only Googlebot (and Gemini via Google infrastructure) and AppleBot render JS; ChatGPT and Claude bots spend over 34% of requests on 404s — [Vercel](https://vercel.com/blog/the-rise-of-the-ai-crawler) **[LC — server logs, strong]**
- May 2026 log analysis on a client SPA confirmed AI crawlers see only the first HTML response — [Till Freitag](https://till-freitag.com/en/blog/ai-crawler-prerendering-log-evidence-en) **[PA, consistent]**
- Google's official doc (updated 2025-12-10): "There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary"; page must be indexed and snippet-eligible; "There's also no special schema.org structured data that you need to add"; "You don't need to create new machine readable files, AI text files, or markup"; nosnippet/data-nosnippet/max-snippet control what's shown — [Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) **[official]**
- Ahrefs schema study (May 2026): correlation — AI-cited pages ~3x more likely to have JSON-LD (6M URLs). Causal test — 1,885 pages that added JSON-LD (Aug 2025-Mar 2026) vs matched controls, 30-day windows, difference-in-differences: AI Overviews **−4.6%** (significant), AI Mode +2.4% (not significant), ChatGPT +2.2% (not significant). Caveats: all pages already had 100+ AIO citations; 30-day window; schema types pooled; vendor study — [Ahrefs](https://ahrefs.com/blog/schema-ai-citations/) **[CE-ish quasi-experiment: schema does not causally raise citations for already-visible pages]**
- searchVIU experiment (cited by Ahrefs and others): major AI systems ignored schema during real-time page retrieval, extracting only visible HTML — [Ahrefs](https://ahrefs.com/blog/schema-ai-citations/); [isagentready](https://isagentready.com/en/blog/does-schema-markup-help-ai-citations) **[PA/small CE]**
- llms.txt: Ahrefs logs across 137K domains — 97% of llms.txt files got zero requests — [Search Engine Journal](https://www.searchenginejournal.com/97-of-llms-txt-files-got-no-requests-ahrefs-data-shows/579478/) **[LC]**; OtterlyAI 90-day test — 0.1% of AI crawler requests touched /llms.txt, no link to more bot activity — [OtterlyAI](https://otterly.ai/blog/the-llms-txt-experiment/) **[PA]**; ezy.ai, 83 sites, 12 weeks — OpenAI's crawler read it 7 times total — [ezy.ai](https://www.ezy.ai/research/do-ai-bots-read-llms-txt) **[PA]**; SE Ranking ~300K-domain analysis reportedly found no significant link between llms.txt and citations (not verified against primary) — [1clickreport summary](https://www.1clickreport.com/blog/llms-txt-evidence-2026)
- Bing: Bing Webmaster Tools launched an "AI Performance" report (public preview Feb 10, 2026) showing page-level citations and grounding queries in Copilot and Bing AI summaries (sample, not full log; does not cover ChatGPT); IndexNow Insights report shows submitted/indexed URLs — [Previsible](https://previsible.io/seo-ai-news/bing-ai-performance-report/); [geotoolbox](https://geotoolbox.ai/blog/bing-webmaster-tools) **[official feature, secondary coverage]**
- OpenAI says ChatGPT search partners with other search providers including Microsoft but gives no split; the "ChatGPT = Bing" claim is unconfirmed — [parse.gl](https://www.parse.gl/blog/bing-rankings-chatgpt-visibility); [geotoolbox](https://geotoolbox.ai/blog/bing-webmaster-tools)

### Inferences
- To-dos, in priority order: (1) robots.txt allows GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended decisions made deliberately, and check CDN/WAF (e.g. Cloudflare bot blocking) isn't blocking them [hygiene, high-impact if broken]; (2) server-side render or prerender all key content (prices, services, locations, FAQ answers) — test with curl/"view source" not the browser [LC strong]; (3) be indexed in Google and Bing (verify in Search Console and Bing Webmaster Tools, submit sitemap, enable IndexNow) because live AI search retrieves from search indexes [official/hygiene]; (4) fix 404s/redirect chains; (5) schema (Organization, LocalBusiness, Product, sameAs) as hygiene for rich results and entity consistency, not as an AI-citation lever, and it must match visible text [CE says no lift]; (6) skip llms.txt or treat as zero-priority [MYTH].
- Page speed: no study found linking speed to AI citation. Grade **[PA/hygiene]**.

### Gaps
- No public study measures speed/Core Web Vitals vs AI citation.
- No study tests schema effect on pages *not yet* cited (Ahrefs explicitly couldn't).
- JS rendering evidence is from Dec 2024 logs plus anecdotal 2026 follow-ups; no provider documents rendering behavior.
- No primary evidence on IndexNow's effect on ChatGPT citation specifically.

## Q4. Freshness signals (dateModified, updated content)

### Takeaway
AI assistants cite newer content than Google organic results (~25% younger on average), and a controlled study found a recent visible timestamp is one of four universal citation drivers. Faking dates without real updates is untested and risky.

### Cited Findings
- Ahrefs (July 2025), ~17M cited URLs across ChatGPT, Perplexity, Gemini, Copilot, AI Overviews vs organic: AI-cited URLs averaged 1,064 days old vs 1,432 for organic (~25.7% fresher); by last update 909 vs ~1,047 days (~13%); ChatGPT cites the newest pages, AI Overviews closest to organic; Perplexity and ChatGPT order references newest to oldest — [Ahrefs](https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/?pp=env) **[LC]**
- Controlled: "Recent vs Old Timestamp" was a gatekeeper (OR > 100, all six models). But "No vs Old Timestamp" and "Recent vs No Timestamp" were inconsistent (2-3 of 6 models) — [arXiv 2605.25517](https://arxiv.org/pdf/2605.25517) **[CE]**

### Inferences
- To-do: show a visible "Last updated [date]" on key pages and keep `dateModified` in schema/sitemap `lastmod` in sync with real edits; refresh prices, stats and year references on a cadence (e.g. quarterly for money pages). An old date actively hurts; having no date is roughly neutral.
- The Ahrefs data is correlational; it doesn't show that updating a page causes more citations.

### Gaps
- No controlled study on live engines of "refresh a page → citation change"; no data on whether date-only bumps (without content change) work or get detected.

## Q5. Entity clarity: consistent naming, About page, sameAs, Wikidata

### Takeaway
Widely recommended but weakly evidenced. No rigorous study shows Wikidata or sameAs raise AI mentions; the best-supported entity lever is off-site brand mentions (correlational). On-site, keep name/description/NAP consistent and explicit.

### Cited Findings
- No peer-reviewed study measures Wikidata/sameAs effect on AI mentions; Schema App case study (vendor) reports +46% non-branded impressions and +42% clicks over 85 days after adding sameAs on location pages — measures search, not AI — [AirOps/secondary summaries](https://www.airops.com/blog/entity-seo-ai-search); [radiantelephant](https://www.radiantelephant.com/entity-optimization-wikipedia-wikidata-sameas-ai/) **[PA]**
- Claim that brands with Wikidata items are "2.7x more likely to appear in AI Overview citations" names no study — [ranqo.ai](https://ranqo.ai/blog/entity-seo-knowledge-graph-ai-visibility) **[MYTH/unsupported]**
- Brand mentions correlate with AI Overview visibility at 0.664 vs 0.218 for backlinks (attributed to Ahrefs/Onely analysis, via secondary) — [digitalapplied](https://www.digitalapplied.com/blog/entity-seo-knowledge-graph-optimization-guide-2026) **[LC, secondary]**
- Controlled study: "Internal Contradictions" significantly reduced citation — [arXiv 2605.25517](https://arxiv.org/pdf/2605.25517) **[CE]** (relevant to inconsistent facts across a site)
- Indig: entity-rich, definitional passages more often cited — [Search Engine Land](https://searchengineland.com/chatgpt-citations-content-study-469483) **[LC]**

### Inferences
- To-dos: one canonical business name used identically everywhere; a plain one-sentence "who we are / what we do / where / for whom" statement on homepage and About page; Organization/LocalBusiness schema with `sameAs` to real profiles (GBP, LinkedIn, Crunchbase, G2, Yelp) as cheap hygiene [PA]; remove contradictory facts (old prices, old addresses) across pages [CE for contradictions]. Wikidata entry only if the business genuinely meets notability [PA].

### Gaps
- No controlled or large study isolating About-page quality, sameAs, or Wikidata on AI citations.

## Q6. Local business vs SaaS/product sites

### Takeaway
For local businesses, the business website is the largest citation source in BrightLocal's 200k-prompt study (42% of citations), with Google Business Profile second (28.6%, mostly Google's AI surfaces, barely ChatGPT) and Yelp ~9.5%. For SaaS/products, controlled evidence favors explicit pricing, specs and comparisons; third-party listicles/reviews carry much of the weight.

### Cited Findings
- BrightLocal (Sept 16, 2026): ~200,000 non-branded local prompts, ~1,342 locations, ChatGPT/AI Mode/AI Overviews, ~1.97M citations. Business websites = 93% of unique cited domains and 42% of all citations; GBP ~28.6% (AI Mode/AIO heavy, ChatGPT barely); Yelp ~9.5% (appeared for 85% of businesses); Facebook, Tripadvisor, BBB, Angi, vertical directories also cited. Tracked businesses appeared in 66% of Google Maps searches vs 32-38% of AI surfaces; repeat-run overlap only 20-33%; ChatGPT avg 4.1 businesses per answer, AI Mode 3.5, AIO 2.5; storefronts 33.6% mention rate vs 29.4% service-area businesses; ChatGPT's radius much wider (90% within 287 km). Author recommends clear NAP, specific location pages, service pages, answering customer questions, reviews/expertise shown on site; notes ChatGPT sometimes runs "site:" fan-out queries (per Lily Ray) — [BrightLocal](https://www.brightlocal.com/research/local-ai-visibility-study/) **[LC, vendor]** (prompt counts reported inconsistently on page)
- Earlier BrightLocal data (2025, via secondary): ChatGPT Search local sources 58% business websites, 27% business mentions, 15% directories — [solcrys summary](https://solcrys.com/local-business-aeo/) **[LC, secondary]**; one vendor review argues engines lean on directories/reviews/best-of lists instead — [openlens](https://openlens.com/blog/en/how-ai-recommends-local-businesses-source-audit) (conflicting, vendor)
- BrightLocal consumer survey: share of consumers using AI for local recommendations rose from 6% (2025) to 45% (2026) — [BrightLocal](https://www.brightlocal.com/research/lcrs-ai-trust/)
- Whitespark (540 queries): AI Overviews appear on ~68% of local-business queries but ~15% of direct "near me" searches, where the local pack shows 93% of the time — [aivisible / secondary](https://www.aivisible.co.uk/research/local-ai-visibility-study.html) **[LC, secondary]**
- SaaS/product: controlled gatekeepers — explicit price, specs, comparisons, recent date — [arXiv 2605.25517](https://arxiv.org/pdf/2605.25517) **[CE]**; startups rarely surface in ChatGPT discovery queries (3.32%) despite name recognition — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1); listicles and third-party comparisons are a large but falling share of ChatGPT citations — [Peec via Lily Ray](https://x.com/lilyraynyc/article/2090256147441746150)

### Inferences
- **Local to-do list:** one page per service and per location with the city/neighborhood, services, price ranges or starting prices, hours, and NAP in plain HTML text near the top; answer common customer questions on those pages; show reviews/credentials on site; keep NAP identical to GBP/Yelp/Facebook; LocalBusiness schema as hygiene; fully complete GBP (off-site but essential for Google AI surfaces).
- **SaaS to-do list:** public pricing page with actual numbers and plan limits; product/feature pages listing specs and integrations in text; "X vs [competitor]" and "alternatives" pages with honest comparison tables; use-case pages ("for [audience]") that state who it's for in the first paragraph; visible last-updated dates; SSR for marketing pages (many SaaS sites are JS-heavy SPAs, so the JS rendering issue hits them most).
- ChatGPT reaches much wider radius than Google AI for local, so ChatGPT local visibility is probably driven more by website/third-party text than by proximity.

### Gaps
- No controlled study specific to local-business on-site changes.
- Whitespark/BrightLocal 2026 ranking-factors weightings (e.g. "GBP ≈12% of AI citation weight") seen only in secondary write-ups; not verified.
