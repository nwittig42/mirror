# Fixing Wrong Facts About a Business in AI Answer Engines (2025-2026)

Research date: 2026-10-14. Labels: **[Documented]** = official docs, primary data, court records or reported news. **[Vendor data]** = a study run by a company that sells GEO or listings services (indicative only). **[Anecdotal]** = one case or practitioner advice.

## 1. Root causes and how often it happens

### Takeaway
About 1 in 11 AI-stated facts about a brand are wrong. The error rate is highest for pricing (13.5%) and for small firms, AI/ML companies and SaaS. The main causes are outdated facts, mistaken identity with a same-named business, and thin or inconsistent sources. For local businesses, the most damaging pattern in 2026 is Google AI Overviews saying a shop is "permanently closed" when it is open. Several of these came from confusion with a same-named business in another city.

### Cited Findings
- **[Vendor data]** Searchable "AI Brand Misinformation Report" (updated July 30, 2026): 32,556 AI-stated facts about 1,704 brands, each graded by an employee of that brand. **9.2% were flagged false.** 75% of brands with 20+ reviewed facts found at least one false fact. "False" covers outdated facts, mistaken identity and fabrications. — [Searchable](https://www.searchable.com/data/ai-brand-misinformation-report)
  - By engine: Perplexity 11.5%, Google AI Overviews 11.4%, ChatGPT 8.1%. Copilot, Gemini, AI Mode, Claude, Grok and DeepSeek are in the sample, but no per-engine rate is given for them.
  - By fact type: **pricing 13.5%**, funding/financials 10.9%, integrations/tech stack 10.6%, partnerships/clients 9.9%, reviews/ratings 8.8%, products/services 8.6%, M&A 7.2%, history/founding 6.9%, location/coverage 4.8%, awards 3.4%.
  - By sector: AI/ML 18.5%, Professional Services 10.8%, SaaS 9.5%. By size: small firms (1-50 staff) 9.4%, mid-size 7.4%, large 6.3%. US pricing errors were 16.1%.
  - The report's suggested causes, which it says it did not measure: fast-changing facts such as prices and funding go stale, young or small companies have thin footprints so the AI guesses, and sources disagree with each other. Limitation: the brands are self-selected Searchable customers.
- **[Vendor data, unverified secondhand]** An Originality.ai analysis from 2025 reportedly found about 1 in 5 brand-related AI responses contained a factual error about pricing, availability or features. I could not reach the primary source. — cited via [Search Atlas blog](https://searchatlas-static-blog-content-coverage-lock.labs.searchatlas.com/blog/entity-resolution-fix-brand-hallucinations-llms-2026)
- **[Vendor data]** Yext studied 6.8M AI citations (ChatGPT, Gemini, Perplexity; July-Aug 2025; retail, financial services, healthcare, food service). **86% of citations came from sources the brand controls: first-party websites 44%, listings 42%, reviews/social 8%.** Forums such as Reddit were 2%. Gemini leaned on websites (52.1%), ChatGPT on listings (48.7%), and Perplexity spread across MapQuest, TripAdvisor and others. Listings made up 52.6% of citations in healthcare. In food service, reviews/social reached 13.3%. — [Yext press release](https://yext.com/about/news-media/ai-citations-release)
- **[Documented, news] Entity confusion leading to a false "closed" claim.** Anna Mae's Bakery (Millbank, Ontario) was described by a Google AI Overview on July 18-19, 2026 as closing permanently on July 31. Google apparently confused it with a same-named Illinois bakery that was closing. Google blamed the "absence of high quality information on the web." — [PinMeTo summary of CBC report](https://www.pinmeto.com/news/google-ai-overview-false-closure-location-accuracy-2026/); [PPC Land](https://ppc.land/google-ai-overview-forces-anna-maes-bakery-to-deny-fake-july-31-closing/)
- **[Documented, news]** Viridian Bookshop (Willoughby, Ohio) was called permanently closed by a Google AI summary, which also gave an address a few doors down. The owner linked a significant sales drop to the error. — [Cleveland Magazine](https://clevelandmagazine.com/articles/willoughby-bookstore-confronts-google-ai-error-claiming-it-was-permanently-closed/); [News 5 Cleveland](https://www.news5cleveland.com/news/local-news/were-open-local-bookstore-battles-false-google-ai-summary)
- **[Documented, news]** Uni Uni, a bubble tea shop in Rochester, MN, was told by Google's AI feature that it had "permanently closed its storefront in August" (Sept 2026). No cause was reported. — [KTTC](https://www.kttc.com/2026/09/08/uni-uni-says-googles-ai-feature-wrongly-listed-it-permanently-closed/)
- **[Documented, news]** Wrong phone numbers in AI Overviews: a search for Sterling Sky's number returned a trampoline park's number, an artist's number pointed to a former employer, and a search for a United Airlines customer-service number surfaced a scam number. Queries containing "phone number" or "customer service" are among the most likely to trigger AI Overviews (Local SEO Guide study). — [MarTech, Feb 2025, updated July 2025](https://martech.org/time-to-check-your-phone-numbers-in-ai-overviews)
- **[Documented, court filing]** Wolf River Electric, a Minnesota solar company: a Google AI Overview said the Minnesota Attorney General was suing the company. It was not a defendant. This looks like a mix-up of a real lawsuit against other solar firms with this company's name. The company says customers cancelled contracts worth up to $150k. — [Minnesota Lawyer](https://minnlawyer.com/2025/06/13/wolf-river-electric-google-ai-defamation-lawsuit/); [GovTech](https://www.govtech.com/public-safety/minnesota-solar-company-sues-google-over-ai-summary)
- **[Vendor data / anecdotal]** A local SEO source notes that no research measures how often local businesses specifically are shown wrongly in AI answers. Typical errors it lists are wrong hours, services the business doesn't offer, and invented reviews, all tied to inconsistent data. — [Localogy, Sept 2026](https://www.localogy.com/2026/09/ai-hallucinations-pose-risks-for-local-businesses/); [Local Falcon](https://www.localfalcon.com/blog/what-causes-ai-hallucinations-for-local-businesses-and-how-to-prevent-them)
- **[Practitioner]** Wrong-entity errors are a different problem from hallucination. The model attaches a same-named entity's real facts to your brand, and it tends to default to the same-named entity with the strongest online presence. — [Pixelmojo](https://www.pixelmojo.io/blogs/brand-disambiguation-ai-entity-confusion)

### Inferences
- A tool can sort each wrong fact into one of five root-cause buckets:
  1. **Stale first-party page.** An old pricing or feature page, or a dated blog post, is still indexed.
  2. **Wrong or stale third-party listing or profile.** For example GBP, Yelp, Apple, Bing Places, Crunchbase, G2, LinkedIn or Wikipedia.
  3. **Model memory.** No citation is shown, and the answer persists when web search is off, so it comes from training data.
  4. **Entity confusion.** The facts are true of another company or location with the same or a similar name.
  5. **Category pattern-matching or gap-filling.** For example, "SaaS in this category usually has a free tier," or "plumbers usually do 24/7." This is most likely when no page states the fact either way.
- Pricing and integrations are the most error-prone facts, so fix-steps for those should be prioritised for SaaS. For local businesses, open/closed status, phone and address are the highest-harm facts even if they are not the most frequent.
- Yext's 86% figure covers local and franchise queries in four industries. It probably overstates how much brands control for SaaS, where review sites, Reddit and media weigh more. That is an inference; I found no comparable SaaS citation split.

### Gaps
- I found no BrightLocal, Profound or Search Engine Land report that measures AI inaccuracy about brands. Searchable is the only large fact-level dataset found, and it is vendor-run.
- No study splits errors by root cause, such as the share caused by training data versus retrieval versus entity confusion.
- I could not get the Originality.ai primary data.

## 2. Official correction and feedback channels per engine

### Takeaway
No engine offers a business-facts correction form with tracking. Every engine's in-product thumbs-down or feedback goes to model and quality teams, with no ticket and no promised outcome. The only formal "correction" route is OpenAI's privacy portal, and that is for **personal data about individuals**, such as a founder, not for company facts. In reported 2026 cases, Google feedback produced an apology from the AI but no confirmed fix. The working lever is fixing the sources. Feedback is cheap documentation, and press attention has occasionally prompted action.

### Cited Findings
- **OpenAI / ChatGPT [Documented].** Under laws such as GDPR, a person can submit a "Remove my personal data from ChatGPT responses" request via the Privacy Portal (privacy.openai.com → "Make a Privacy Request"), with or without an account, including when they believe the information is inaccurate. OpenAI asks for specific examples and links to chats. Submitting does not guarantee removal. — [OpenAI Help Center](https://help.openai.com/en/articles/20001057)
- **OpenAI [Documented, older].** The privacy policy has offered a "correction request" for factually inaccurate personal information (privacy.openai.com or dsar@openai.com), with the caveat: "Given the technical complexity of our models, we will not be able to correct inaccuracies in every case." — [TechCrunch 2023](https://techcrunch.com/2023/05/02/chatgpt-delete-data/); [The Decoder](https://the-decoder.com/openai-introduces-personal-data-removal-form-as-chatgpt-faces-criticism-over-false-information/)
- **OpenAI outcome [Documented complaint].** In noyb's 2024 GDPR complaint, OpenAI reportedly refused to correct a wrong date of birth and offered instead to block outputs mentioning the person's name. — [Mezha](https://mezha.media/en/2024/04/29/openai-faces-a-complaint-in-the-eu-because-chatgpt-cannot-correct-false-information-about-people)
- **Anthropic / Claude [Documented].** Use the thumbs-down on the response (pick an issue type, add details), or email feedback@anthropic.com. The help article says Claude can produce incorrect answers and recommends checking sources. — [Claude Help Center](https://support.claude.com/en/articles/8525154-claude-is-providing-incorrect-or-misleading-responses)
- **Google AI Overviews [Documented + anecdotal].** In-product options are thumbs up/down and the three-dot "feedback" menu. A Google Search Help Product Expert suggested reporting AI concerns via Gemini. Google also has a policy page for reporting problematic content in Search. MarTech "could not find a formal process" for removing factually incorrect AI Overviews. — [MarTech](https://martech.org/time-to-check-your-phone-numbers-in-ai-overviews)
- **Google escalation via the GBP Help Community [Anecdotal].** Posting there may get a volunteer Product Expert to escalate. The caveat is that local search is a different department from AI, so this mostly serves as documentation. — [MarTech](https://martech.org/time-to-check-your-phone-numbers-in-ai-overviews)
- **Google outcomes [Documented, news].** The Anna Mae's Bakery owner typed a correction into Google's AI search bar and got an apology and a promise to fix, with no ticket number. No confirmed fix was reported. — [PinMeTo](https://www.pinmeto.com/news/google-ai-overview-false-closure-location-accuracy-2026/). The Viridian Bookshop owner "reported the problem repeatedly, filed Google's complaint form" and still saw the error weeks later. News 5's own search showed "open" while the owner said others still saw "closed." — [Cleveland Magazine](https://clevelandmagazine.com/articles/willoughby-bookstore-confronts-google-ai-error-claiming-it-was-permanently-closed/); [News 5](https://www.news5cleveland.com/news/local-news/were-open-local-bookstore-battles-false-google-ai-summary)
- **Google Maps [Practitioner].** Maps has an option to mark a place as reopened or closed, which is relevant to false-closure errors. — [summarised via search of web60.ie / pushleads](https://web60.ie/blog/ai-wrong-information-about-business)
- **Google Knowledge Panel [Documented / practitioner].** Verified entities can claim the panel and use "Suggest edits," which Google reviews before applying. Unverified users can use the panel's Feedback link. Google named the Knowledge Graph as an input to AI Mode (March 2025 announcement), but I found no AI-Mode-specific correction route. — [Semrush](https://www.semrush.com/blog/google-knowledge-panel); [Search Engine Land](https://searchengineland.com/claim-your-knowledge-graph-heres-how-320070); [Hartzer](https://hartzer.it.com/entity-grounding-and-the-knowledge-graph/)
- **Grok / xAI [Documented, one incident].** The only documented "fix" was a public xAI statement after Grok's 2025 antisemitic output. xAI said Grok had picked up a viral meme through web search. No brand-facing correction process was found. — [TechCrunch](https://techcrunch.com/?p=3027911)
- **Unofficial escalation that has worked [Practitioner].** MarTech's suggested steps include tagging Google reps on social media in the hope they disable the AI Overview for that query, pitching the story to a reporter, and consulting an attorney. — [MarTech](https://martech.org/time-to-check-your-phone-numbers-in-ai-overviews). Every false-closure case found reached the press: CBC, Spectrum, News 5 and KTTC.

### Inferences
- In the tool, list the engine feedback step on every fix, but describe it as "log it" and not as "this fixes it." Its realistic value is getting a record on file and maybe a query-level suppression.
- When the wrong fact is about a **named person**, such as a founder or CEO, the OpenAI Privacy Portal is the one formal route. It is stronger in GDPR jurisdictions. Expect blocking rather than correction.
- For harmful local errors, such as a false closure or a scam phone number, the escalation ladder is: in-product feedback → GBP Help Community post → public social post tagging Google Search Liaison or Google → local press → lawyer.

### Gaps
- I found no official Perplexity, Microsoft Copilot/Bing or Grok help page describing a factual-error report route beyond generic in-product feedback (thumbs and flag). This needs a direct check of each help centre.
- No engine publishes outcome data, and I found no documented case of a business-facts correction being confirmed as fixed through feedback alone.

## 3. Source-side fixes (the part that actually works)

### Takeaway
Fixing the sources the engines cite is the only reliably effective remedy. Start with the brand's own site, then listings, profiles and knowledge bases. If a wrong claim is repeated by third-party sites, fixing only your own site barely works: such claims took a median of 33 days to change and 41% never changed within 45 days.

### Cited Findings
- **[Vendor data]** Because 86% of local AI citations come from brand-managed websites and listings, Yext advises distributing accurate facts to websites, listings and review platforms. — [Yext](https://yext.com/about/news-media/ai-citations-release)
- **[Practitioner]** Tracing steps: save the answer and any cited sources, then search for the wrong phrase. Check your own pages first (home, About, contact, services, FAQ), then GBP, Bing Places, Apple Business Connect and maps, then external profiles (Clutch, G2, Capterra, LinkedIn, social). If no source is shown, re-run the query in web search mode or in an engine that shows citations. — [Everything PR](https://everything-pr.com/how-to-correct-ai-misinformation-about-your-company); [Growtika](https://growtika.com/geo-hub/chatgpt-wrong-info)
- **[Practitioner]** Engines draw on knowledge bases such as Wikipedia, Crunchbase, LinkedIn company pages and industry directories. Making these consistent is "the core fix." — [Everything PR](https://everything-pr.com/how-to-correct-ai-misinformation-about-your-company)
- **[Practitioner]** For local businesses: make the website, GBP and social profiles consistent, and clean up Yelp, Facebook and other directories. — [web60.ie](https://web60.ie/blog/ai-wrong-information-about-business); [Pushleads](https://pushleads.com/how-to-fix-business-info-in-ai-search-results-before-wrong-data-costs-you-custom/)
- **[Vendor data]** Edit type changes how fast the fix lands (MaxAEO, 312 edits). Swapping a number or fact on a page that is **already cited** was fastest: median 4 days, 6% still unchanged at day 45. A new Q&A section: 8 days, 12% unchanged. A rewrite or new URL: 16 days, 22% unchanged. **A claim contradicted by third-party sites: 33 days median, 41% never changed.** Changing only the page date did not help, because engines compare content. — [MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/)
- **[Vendor/practitioner]** Overall timeline estimate of 60-180 days to correct a brand misrepresentation, depending on severity and authority. This is unverified. — [Everything PR](https://everything-pr.com/how-to-correct-ai-misinformation-about-your-company)

### Inferences — remediation playbook (by error type × source)
Rule for the tool: (a) find the source (the cited URL, or a phrase search); (b) fix the source; (c) publish one clear statement of the correct fact on the brand's own site; (d) speed up recrawl; (e) log engine feedback; (f) re-test on a schedule.

| Error type | Most likely source | Fix steps | Expected time to show up (live-retrieval engines) |
|---|---|---|---|
| Wrong price / plan / free tier (SaaS) | Old pricing page, archived blog, G2/Capterra/review-site pricing fields, comparison listicles | Update the /pricing page with plain-text prices (not only images or JS); 301-redirect or noindex old pricing URLs; add a FAQ line such as "Do you have a free plan? No/Yes…"; update G2/Capterra vendor profiles; email publishers of top cited listicles | 4-11 days for a cited-page fact swap; 30+ days if third-party pages disagree |
| Feature claimed but not offered / "does X" | Category pattern-matching; competitor comparison pages | Publish an explicit "What we do / don't do" or "Integrations" page; FAQ entries phrased like the triggering prompt; ask comparison-page owners to correct | ~8 days for a new Q&A section (median) |
| Wrong hours / phone / address | GBP, Apple Business Connect, Bing Places, Yelp, Facebook, aggregators | Fix GBP first, then Bing Places, Apple, Yelp, Facebook and data aggregators; match the website NAP exactly; LocalBusiness schema | Days; AI Overviews ~9-day median per vendor data |
| Falsely "permanently closed" | Entity confusion with a same-named closing business; stale listing; closure news about another location | Confirm GBP shows open (and use Maps "reopened" if flagged); post "We're open" on the site, GBP posts and social; AI Overview feedback; GBP Help Community; press/social escalation if revenue is affected; disambiguation (see section 5) | No reliable data; cases ran for weeks |
| Wrong location / service area | Old address on directories; multi-location confusion | Clean up citations; location pages; LocalBusiness schema per location | Days to weeks |
| Wrong founder / exec / history | Crunchbase, LinkedIn, Wikipedia/Wikidata, old press | Update Crunchbase, LinkedIn and the About page; edit Wikidata (with sources); Wikipedia via the talk page if there is a COI; for false claims about a named person, OpenAI Privacy Portal | Retrieval: weeks. Model memory: until the next model version (months) |
| Confused with similarly named company | Shared name; stronger entity dominates | See section 5 | Weeks to months |
| False legal/reputational claim (lawsuit, fraud) | Mixing of news about others with your name | Document with screenshots; feedback; ask cited publishers to clarify; legal letter; see section 6 | Unknown |
| Answer has no citation and persists with search off | Training-data memory | Fix sources anyway; feedback; expect the change only after a model refresh; check the search-enabled answer separately | Months (model refresh cycle) |

### Gaps
- No controlled study measures how much a Wikidata, Crunchbase or G2 edit specifically changes AI answers.
- No documented success rate for asking publishers to correct an article.

## 4. Timelines and verification

### Takeaway
How long a fix takes depends on how the engine gets its information. Engines that search the live web pick up a fixed page within days to two weeks. Answers from training-data memory only change when a new model ships, which takes months. In one vendor study, about 1 in 6 page edits still hadn't shown up after 45 days. Verify by re-running the exact prompt that triggered the error several times on each engine, with search on and off.

### Cited Findings
- **[Vendor data]** MaxAEO, Feb-June 2026: 64 B2B SaaS/tech domains, 312 edits, 8 engines, 3 runs per prompt per day. A fact counted as reflected when it appeared in at least 2 of 3 runs on 3 consecutive days. Median days until reflected: **Perplexity 2, Claude 7, Copilot 8, Google AI Overviews 9, ChatGPT (search) 11, Gemini 13; pooled 8.** Share never reflected by day 45: Perplexity 9%, Claude 15%, Copilot 17%, AIO 16%, ChatGPT 20%, Gemini 24%; pooled 16%. — [MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/)
- **[Vendor data]** Three layers set the speed. Model memory refreshes over months, search indexes over days to weeks, and live fetches within minutes, but only for pages the index already surfaces. Ways to speed it up: accurate sitemap `lastmod`, internal links from frequently crawled pages, and IndexNow for Bing-backed surfaces (Copilot, partly ChatGPT). — [MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/)
- **[Practitioner]** IndexNow speeds Bing indexing, which feeds Copilot, DuckDuckGo and some ChatGPT search results. Google does not use IndexNow, and Perplexity and OpenAI crawlers benefit only indirectly. — [Tenten](https://geo.tenten.co/en/blog/indexnow-implementation)
- **[Documented]** OpenAI says ChatGPT search partners with other search providers, including Microsoft. — cited via [Tenten](https://geo.tenten.co/en/blog/indexnow-implementation)
- **[Practitioner]** Verification: run the same prompt across several engines, several times each. An error in one engine on one run is often noise. An error that is consistent across runs or engines points to a source problem. — [Everything PR](https://everything-pr.com/how-to-correct-ai-misinformation-about-your-company)
- **[Documented, news]** Results differ by user and session. In the Viridian case, a reporter's search showed "open" while the owner said others still saw "closed." — [News 5](https://www.news5cleveland.com/news/local-news/were-open-local-bookstore-battles-false-google-ai-summary)

### Inferences
- Suggested re-test schedule for the tool: day 3, day 7, day 14, day 30, day 45. Run 3 times per engine per check, and mark a fix "resolved" only when the correct fact appears in at least 2 of 3 runs on two consecutive checks, following MaxAEO's rule. Escalate if the fix is unresolved at day 30, and re-diagnose the source if unresolved at day 45. At that point it is likely third-party contradiction or model memory.
- Check ChatGPT and Claude with web search both on and off. If the answer is correct with search on but wrong with it off, the cause is training-data memory. Tell the user it will take until a future model release, and that search-on answers are already fixed.
- Re-test from the business's actual location for local queries, since results differ by location (Yext study design). — [Yext](https://yext.com/about/news-media/ai-citations-release)

### Gaps
- No vendor-independent timeline data. MaxAEO covers B2B SaaS pages only, with no local listings and no GBP-edit timing.
- No public data on how often the major model makers refresh training data for brand facts.

## 5. Entity disambiguation for name collisions

### Takeaway
When an engine mixes you up with a same-named company, adding more content doesn't help. Make your business a clearly separate "entity": one consistent identity linked across schema, Wikidata and profiles, plus explicit statements that tell the two apart. The guidance is all from practitioners, and I found no before-and-after case study.

### Cited Findings
- **[Practitioner]** Use Organization schema with a stable `@id` and a thorough `sameAs` array (official social profiles, Wikidata, Crunchbase, LinkedIn, GBP), so machines treat your brand as a single entity node. — [Pixelmojo](https://www.pixelmojo.io/blogs/brand-disambiguation-ai-entity-confusion); [GEO Toolbox](https://geotoolbox.ai/blog/entity-seo.md)
- **[Practitioner]** Check Wikidata: does your company have an item, do same-named companies have items, and is there a disambiguation page? Create or fix your item with distinguishing properties such as location, industry, founding date and website. — [Parse](https://www.parse.gl/blog/entity-disambiguation-ai)
- **[Practitioner]** Add a disambiguation line to llms.txt naming the entity you're confused with. This helps AI browsers and agents, but Google does not use llms.txt for AI Overviews. — [Parse](https://www.parse.gl/blog/entity-disambiguation-ai)
- **[Practitioner heuristic]** Test direct entity prompts across ChatGPT, Perplexity, Gemini and Claude. If more than 10% of brand-name prompts return blended or wrong-entity content, you have a disambiguation problem. — [Parse](https://www.parse.gl/blog/entity-disambiguation-ai)
- **[Documented case]** Anna Mae's Bakery (Ontario) was mixed up with an Illinois bakery of the same name. Google pointed to the lack of high-quality information about the business. — [PinMeTo](https://www.pinmeto.com/news/google-ai-overview-false-closure-location-accuracy-2026/)

### Inferences
- Fix steps for name collisions in the tool:
  1. Add an About/FAQ line written the way people ask: "Is [Brand] the same as [Other Brand]? No. [Brand] is a [category] based in [city], founded [year]; we are not affiliated with [Other] in [place]."
  2. Organization or LocalBusiness schema with `@id`, `sameAs`, address, `foundingDate` and `areaServed`.
  3. A Wikidata item with distinguishing properties.
  4. Consistent name, city and category on GBP, LinkedIn and Crunchbase.
  5. Use the full name plus place or category, such as "Anna Mae's Bakery Millbank," in titles and listings.
  6. Re-test with prompts that include and exclude the place or category qualifier.
- For local businesses, the city or region is the strongest tell-apart signal. For SaaS, use the domain, category and founders.

### Gaps
- No engine documents how it disambiguates entities, and there are no published results for schema or Wikidata fixes.

## 6. Legal and reputation angles

### Takeaway
Suing has become possible but has not won anything yet, and it is slow and expensive. OpenAI won Walters (2025) because its hallucination warnings helped defeat negligence. Meta settled with Starbuck by giving him an advisory role. Starbuck v. Google survived dismissal in July 2026. Wolf River Electric v. Google (a private business, where the bar is negligence rather than actual malice) is the key business case. In practice, a documented legal threat plus press coverage is leverage, not a quick fix.

### Cited Findings
- **Wolf River Electric v. Google [Documented].** A Minnesota solar company sued in state court in March 2025 over an AI Overview falsely saying the Minnesota AG was suing it. It seeks $110M-$210M and says customers cancelled contracts. Google moved the case to federal court. A remand motion was filed in July 2025 ([Haynes Boone](https://www.haynesboone.com/news/articles/defamation-in-the-ai-age)). Quinn Emanuel reports the court remanded it to state court in January 2026; I could not independently confirm this ([Quinn Emanuel](https://quinnemanuel.com/the-firm/publications/client-alert-defamation-in-the-ai-era)). As a private entity, it need only show negligence, not actual malice ([Today's General Counsel](https://todaysgeneralcounsel.com/lawsuit-tests-defamation-laws-application-to-ai-hallucinations/)). — [Minnesota Lawyer](https://minnlawyer.com/2025/06/13/wolf-river-electric-google-ai-defamation-lawsuit/)
- **Starbuck v. Meta [Documented].** Filed April 2025 in Delaware Superior Court over Meta AI falsely linking him to January 6 and QAnon. Settled August 2025, with Starbuck becoming an advisor to Meta on political bias and hallucinations. No payment was disclosed. — [Reason/Volokh](https://reason.com/volokh/2025/08/08/ai-libel-suit-by-conservative-activist-robby-starbuck-against-meta-settles/printer/); [Fox Business](https://www-ak-ms.foxbusiness.com/media/robby-starbuck-meta-settle-lawsuit-after-ai-chatbot-defamed-him)
- **Starbuck v. Google [Documented].** Filed October 22, 2025, seeking at least $15M over Bard, Gemini and Gemma outputs. On July 24, 2026, Delaware Superior Court Judge Meghan Adams denied Google's motion to dismiss in full, calling it "a new frontier for defamation law." The case is now in discovery. Google says some of the hallucinations were addressed in 2023. — [Bloomberg Law](https://news.bloomberglaw.com/esg/google-ordered-to-face-robby-starbucks-ai-defamation-lawsuit); [Leagle opinion](https://www.leagle.com/decision/indeco20260724049); [Claims Journal](https://claimsjournal.com/news/national/2026/07/27/339086.htm)
- **Walters v. OpenAI [Documented].** Summary judgment for OpenAI on May 19, 2025 (Gwinnett County, GA). The court found: no defamatory meaning as a matter of law, since a reasonable reader wouldn't take the output as fact given the context; OpenAI's hallucination disclaimers weighed against negligence; and as a limited-purpose public figure, Walters had to show actual malice and couldn't. — [Cleary Gottlieb](https://www.clearygottlieb.com/news-and-insights/publication-listing/georgia-court-dismisses-defamation-lawsuit-against-openai-over-chatgpt-output); [Gibson Dunn](https://www.gibsondunn.com/gibson-dunn-wins-significant-victory-for-client-openai-defending-against-defamation-claim-based-on-hallucinated-generative-ai-output/)
- **GDPR route [Documented complaint].** noyb's 2024 complaint argues that OpenAI's inability to correct false personal data breaches GDPR. This applies to individuals such as founders, not companies. — [Mezha](https://mezha.media/en/2024/04/29/openai-faces-a-complaint-in-the-eu-because-chatgpt-cannot-correct-false-information-about-people)
- **[Practitioner]** "Consult an attorney" is listed as a response to harmful AI Overview misinformation. — [MarTech](https://martech.org/time-to-check-your-phone-numbers-in-ai-overviews)

### Inferences
- What the tool should tell users: save timestamped screenshots, prompts, engine and location for every harmful wrong fact. Keep a record of feedback submitted and the dates. Log business harm, such as cancelled orders or a sales drop. That record is what Wolf River-style claims rely on, and it supports press and escalation.
- Only suggest the legal route for serious reputational claims (crime, lawsuits, fraud, closure causing measurable loss). Never suggest it for pricing or feature errors.
- Walters suggests that a reader's context and the engine's disclaimers matter. Private businesses, like Wolf River, face a lower negligence standard than public figures.

### Gaps
- No ruling on the merits in any AI-defamation case brought by a business yet. I could not confirm Wolf River's current posture beyond the Quinn Emanuel report of a January 2026 remand.
- No reported settlement in which an AI company agreed to correct a business's facts.
