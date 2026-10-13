# Self-serve GEO / AEO / AI-visibility software pricing (as of 12 Oct 2026)

Notes on method and reliability:
- "Vendor page" rows were read directly from the vendor's own pricing page on **2026-10-12**. Pages were read through an automated fetch-and-summarise tool, so toggles (monthly vs annual) and JavaScript-rendered tables were sometimes not fully visible; those cases are flagged.
- Third-party roundups are flagged where the publisher sells a competing tool (lower reliability).
- All prices USD unless marked EUR.

## 1. Plans and prices for each tool

### Takeaway
The self-serve software floor is roughly **$17-$30/month** (Rankscale Essentials, Local Falcon Starter, Otterly Lite, BrightLocal Track), the common "real" entry tier is **$79-$129/month**, and mid tiers cluster at **$189-$500/month**; almost every vendor prices on prompts tracked (or credits = prompts x engines x frequency), with extra engines such as Claude sold as add-ons. The enterprise-oriented players (Profound, Evertune, Bluefish, Daydream, Yext Scout) are either custom-quote or start at $800+/month, and Profound removed its public self-serve brand plans in mid-September 2026.

### Cited Findings

#### Dedicated AI-visibility trackers with public pricing

- **Otterly.AI** (vendor page): Lite **$29/mo**, Standard **$189/mo**, Premium **$489/mo**, Enterprise custom ("starting from 1,000" prompts). Annual 15% off; the page also shows $25 / $160 / $422, which a pricing tracker labels as the annual-billed rates. Scales on search prompts: 15 / 100 / 400. Four engines included (ChatGPT, Google AI Overviews, Perplexity, MS Copilot). Unlimited seats and brand reports on all plans; Lite has 1 workspace. Add-ons: +100 prompts $99/mo (Standard/Premium only); Google AI Mode or Gemini $9 / $59 / $149 per month by plan; **Claude $29 / $109 / $439 per month** by plan. Free trial exists, length not stated on page; no free tier. — [Otterly pricing](https://otterly.ai/pricing); annual labels from [PricingSaaS Otterly](https://pricingsaas.com/companies/otterly)
- **Peec AI**: the vendor pricing page shows plan names Starter / Pro / Advanced / Enterprise but **no prices were visible to my fetch on 2026-10-12** (likely rendered client-side or geo-priced). — [Peec pricing](https://peec.ai/pricing)
  - PricingSaaS tracker lists **Starter $80/mo, Pro $205/mo, Advanced $420/mo billed annually**, Enterprise contact sales; extra-model add-ons $30 / $70 / $140 per month; and records that these prices were first made public on the page on Aug 3, 2026. — [PricingSaaS Peec](https://pricingsaas.com/companies/peec)
  - Glen Allsopp's Sept 8, 2026 comparison uses $95 (25-50 prompts, up to 3 models), $245 (100 prompts x 3 models), $330 (100 x 4), $660 (200 x 4), which look like the monthly-billed rates. Author works at Ahrefs (disclosed). — [Detailed.com](https://detailed.com/ai-visibility-tools-pricing/)
  - Search-result summaries report prompt caps of Starter 50 / Pro 150 / Advanced 350, three models included per plan, unlimited seats, a free trial (7 or 14 days depending on source), no free tier; one source claims an Aug 14, 2026 move to EUR-denominated, geo-priced plans (Starter EUR 70, Pro EUR 180, Advanced EUR 360 billed annually). That last claim comes from a competing vendor's comparison page and was not confirmed. — [Capterra Peec pricing](https://capterra.com/p/10030058/Peec-AI/pricing); [Ayzeo comparison (competitor)](https://munich2026.piabo.net/comparisons/peec-ai-alternatives)
- **Profound** (vendor page): brand plans are now **Trial (free)** and **Enterprise (custom)** only; no dollar amounts on the page. Trial = 50 preset prompts run daily for 7 days on 3 engines (ChatGPT, Gemini, Google AI Overviews), no history/exports/API. Enterprise = up to 9 engines, custom prompts, unlimited seats, SSO, API. A self-serve "Agency Growth" plan is named in the FAQ (400 credits per month per client workspace) without a price. — [Profound pricing](https://www.tryprofound.com/pricing)
  - History: brand self-serve prices appeared June 11, 2026 (Starter $99/mo, ChatGPT only, 50 prompts; Growth $399/mo); both were gone from the brand tab by about Sept 17, 2026, around the time Profound announced a $180M Series D (Sept 15, 2026). Agency Growth reported at **$99/mo base + $399/mo per client workspace** (100 prompts daily per client, 3 engines, 5 seats). Publisher states it is a competitor. — [GEO Toolbox, verified Sept 28, 2026](https://geotoolbox.ai/blog/profound-pricing)
  - Enterprise price is not public. **Estimate only:** $2,000-$5,000+/month, attributed to a competing vendor (Maintouch) via the same article. — [GEO Toolbox](https://geotoolbox.ai/blog/profound-pricing)
  - Stale figures still circulating: $499 (Rankability, Oct 2, 2026) and $99/$399 (Detailed.com, Sept 8, 2026; DataDab, Aug 4, 2026). — [Rankability](https://www.rankability.com/blog/how-much-should-you-pay-for-ai-search-visibility-tracking-tools/); [Detailed.com](https://detailed.com/ai-visibility-tools-pricing/); [DataDab](https://www.datadab.com/research/ai-marketing-software-pricing)
- **Scrunch AI** (vendor page): Starter **$300/mo** month-to-month or **$250/mo** billed annually; Growth **$500/mo** or **$417/mo** annual; Enterprise custom. Annual = 17% off. Starter: 350 custom prompts, 1,000 industry prompts, 3 users, 3 personas, 5 page audits. Growth: 700 custom prompts, 2,500 industry prompts, 5 users, 5 personas, 10 page audits. Extra seat $25/mo. **7-day free trial of Starter, no credit card.** Agency packages on a separate page, no price shown. — [Scrunch pricing](https://scrunch.com/pricing)
- **AthenaHQ** (vendor page): Essential **Free** (300 credits, "$25 free credit", 5 engines, unlimited members); Starter **$295/mo** (3,600 credits/mo, 11 models, unlimited seats); Enterprise custom. "1 credit = 1 AI response." Annual toggle says 17% off (annual dollar figure not shown). Extra credits and API are paid add-ons priced via sales. Agency column is "Enterprises & Agencies", no public price. — [AthenaHQ pricing](https://www.athenahq.ai/pricing)
- **Goodie AI** (vendor page): Brand plans Core **$399/mo** (5 engines, 120 prompts, 5 seats, self-serve, 7-day free trial); Pro **$999/mo** (8 engines, 250 prompts, unlimited seats, demo required); Enterprise custom (up to 13 engines). Annual billing = two months free. Agency plans: Growth **$275/mo** (10 pitch workspaces/mo, unlimited seats) with **client workspaces as an add-on from $399/mo each**; Agency Enterprise custom. — [Goodie pricing](https://higoodie.com/pricing)
- **Rankscale** (vendor page): Essentials **$17/mo, yearly billing only** ($20 shown as reference); Pro **$99/mo** (1,200 credits, 10 brand dashboards, 7-day free trial); Pro+ **$229/mo** (3,000 credits, 25 dashboards); Growth **$385/mo** (5,500 credits, 50 dashboards, white-label links, API); Enterprise **$780/mo** (12,000 credits, 100 dashboards); Custom quoted. Yearly saves 15%. Credit-based: about 0.25 credit per engine query, Claude costs 2 credits; the page's own example of 50 prompts weekly on five engines = 162.5 credits/month. Unlimited seats. — [Rankscale pricing](https://rankscale.ai/pricing)
- **Writesonic** (vendor page): Starter **$79/mo billed annually** (about $99 monthly; 50 prompts tracked daily, 1 user, 1 project); Basic **$199/mo annual** (about $249 monthly; 100 prompts, 2 users); Growth **$399/mo annual** (about $499 monthly; 200 prompts, 3 users, 2 projects); Enterprise custom. Annual saves 20%. Self-serve plans track only ChatGPT, Gemini and Google AI Overviews; all 8 engines (incl. Claude, Perplexity, Grok) are Enterprise only. Monthly figures were back-calculated from the stated annual savings. "Start free, no credit card"; trial length not stated; 7-day refund. — [Writesonic pricing](https://writesonic.com/pricing)
- **LLMrefs** (vendor page): one plan, "All in One" **$79/mo** ("limited time only"), 500 prompts, unlimited team members, projects and domains; 7-day free trial; a free account with no credit card is also offered (limits not described). No separate agency plan; the same plan is pitched to agencies. — [LLMrefs pricing](https://llmrefs.com/pricing)
- **Knowatoa** (vendor page): Starter **$59/mo**, Growth **$199/mo**, Enterprise custom. Unlimited sites share one question quota (quota not shown in fetched text). Free trial on both paid plans, length not stated. Annual pricing "available", no rate shown. — [Knowatoa pricing](https://knowatoa.com/pricing)
- **Promptwatch** (vendor page): Essential **$95/mo** (50 prompts, 4 models, 7-day free trial); Professional **$245/mo** (150 prompts, 7-day trial); Business **$579/mo** (350 prompts, demo). Annual figures not visible. Agencies tab exists; Detailed.com reports agency pricing of $199/mo for about 10K checks. — [Promptwatch pricing](https://promptwatch.com/pricing); [Detailed.com](https://detailed.com/ai-visibility-tools-pricing/)
- **Evertune** (vendor page): Pro **$800/mo** "for mid-market brands" (100,000 prompts across 11 AI models, 25 AI-optimised articles/mo, 3 onboarding sessions); Enterprise custom. No free trial or contract minimum stated. Conflict: a search-result summary of the same vendor page and Toolradar both said "starts at $3,000 per month"; the page as fetched on 2026-10-12 showed $800, which matches Findstack's figure dated July 24, 2026. — [Evertune pricing](https://www.evertune.ai/pricing); contradicted by [Toolradar](https://toolradar.com/tools/evertune-ai/pricing); [Findstack](https://findstack.com/products/evertune-ai/pricing)
- **HubSpot AEO** (vendor page): paid product **$50/month, "no HubSpot subscription required"**, also included in Marketing Hub Pro and Enterprise. Tracks ChatGPT, Perplexity, Gemini; prompt count not stated on the page. DataDab (Aug 4, 2026) lists it as 25 prompts, 3 engines. — [HubSpot AEO Grader page](https://www.hubspot.com/aeo-grader); [DataDab](https://www.datadab.com/research/ai-marketing-software-pricing)

#### SEO suites with AI-visibility modules

- **Semrush** (vendor page, "SEO + AI Search" tab): SEO $139/mo (no AI prompts); Starter **$199/mo** ($165.17 annual; 50 AI prompts/day); Pro+ **$299/mo** ($248.17 annual; 100 AI prompts/day); Advanced **$549/mo** ($455.67 annual; 200 AI prompts/day); Free plan $0 (1 demo project, 10 reports/day); Enterprise custom. Extra users from $45/mo. 7-day free trial. — [Semrush pricing](https://www.semrush.com/pricing/)
  - The standalone AI Visibility Toolkit price was **not visible on the vendor page I could reach**. Third parties report **$99/month per domain** (some say that figure is the annual-billed rate, and that extra users cost $99 each). The clearest source for this is a competitor that discloses it. — [Ryze (competitor)](https://www.get-ryze.ai/blog/semrush-ai-visibility-pricing-2026); [Detailed.com](https://detailed.com/ai-visibility-tools-pricing/)
- **Ahrefs Brand Radar** (vendor pages): Ahrefs base plans Starter $29, Lite $129, Standard $249, Advanced $449, Enterprise $1,499 per month; "save up to 17%" annually. **Brand Radar AI "from $199/mo"**. Custom prompt packages: Basic **$50/mo** (+2,500 checks/mo, overage $0.020/check), Growth **$100/mo** (+7,000 checks), Scale **$250/mo** (+25,000 checks). — [Ahrefs pricing](https://ahrefs.com/pricing)
  - The Brand Radar product page (served in EUR) shows Custom Prompts from EUR 47/mo, AI Visibility Index from EUR 179/mo, and "EUR 654/mo for all models"; Claude uses 8 checks per update; some custom prompts are included free with paid Lite or higher. — [Ahrefs Brand Radar](https://ahrefs.com/brand-radar)
  - Third-party USD figures for the index bundles: Select $398, All platforms $699 (verified Aug 4, 2026). — [DataDab](https://www.datadab.com/research/ai-marketing-software-pricing)
  - Custom prompt tracking at $50/mo does not require a standard Ahrefs subscription, per an author who works at Ahrefs. — [Detailed.com](https://detailed.com/ai-visibility-tools-pricing/)
- **SE Ranking** (vendor page): Core **$129/mo** ($103.20 annual; 100 GEO prompts tracked daily, 1 seat); Growth **$279/mo** ($223.20 annual; 250 GEO prompts, 3 seats); Enterprise custom. Annual = 20% off. **AI Search add-on $89/mo** ($71.20 annual) covering AI Overviews, AI Mode, Perplexity, ChatGPT, with prompt tiers of 200 / 450 / 1,000. **Agency Pack +$69/mo (annual only)**: white-label platform and reports, 30 client seats. 14-day free trial, no card (20 AI prompts/day in trial). — [SE Ranking pricing](https://seranking.com/subscription.html)
- **Surfer AI Tracker** (vendor page, prices shown billed yearly): AI Search Analytics **$82/mo** (50 prompts, daily); Standard $99/mo (25 prompts, weekly); Pro $182/mo (50 prompts, daily); Peace of Mind $299/mo (100 prompts, daily); Discovery $49/mo (no prompts); Enterprise custom. Annual discount "up to 17%"; monthly-billed prices not shown. Detailed.com (Sept 8, 2026) uses $219 and $359 as the monthly-billed prices for 25-50 and 100 prompts. — [Surfer pricing](https://surferseo.com/pricing/); [Detailed.com](https://detailed.com/ai-visibility-tools-pricing/)
- **Nightwatch** (vendor page, **EUR**): Starter **EUR 79/mo** (50 AI prompts, 1,500 AI answers/mo); Professional **EUR 159/mo** (150 prompts); Agency **EUR 399/mo** (500 prompts); Enterprise custom. Six AI platforms on all plans (ChatGPT, Claude, Gemini, Perplexity, AI Mode, AI Overview). 14-day free trial, no card. The page's annual maths is internally inconsistent (annual totals equal 12 x the listed monthly price while claiming 20% off), so the listed prices may already be the annual-billed rates with monthly at EUR 99 / 199 / 499. — [Nightwatch pricing](https://nightwatch.io/pricing/)

#### Local-SEO tools with AI visibility

- **BrightLocal** (vendor page): Track **$41/mo** ($31/mo annual), Manage **$54/mo** ($40 annual), Grow **$65/mo** ($49 annual) for 1 location; annual saves 25%. Prices scale per location (e.g. 2-5 locations: $62 / $76 / $87 monthly). **Local AI Visibility Tracker is included in Track and above** at no extra cost. 14-day free trial, no card. — [BrightLocal pricing](https://www.brightlocal.com/pricing/); plan eligibility also in [BrightLocal help](https://help.brightlocal.com/hc/en-us/articles/38792699012882-Which-plans-include-Local-AI-Visibility)
- BrightLocal's tracker covers ChatGPT, Google AI Mode and Google AI Overviews. — [BrightLocal Local AI Visibility](https://www.brightlocal.com/local-seo-tools/local-ai-visibility)
- **Local Falcon** (vendor page): credit plans Starter **$24.99/mo** (7,500 credits), Basic $49.99, Pro $99.99, Premium $199.99; enterprise packages $499-$4,999/mo. 100 free credits at sign-up, no card. "AI Visibility Tracking" and "White Label Reports" are listed features; the fetched text did not show which engines or which plans. — [Local Falcon pricing](https://www.localfalcon.com/pricing)

#### Pricing not public

- **Yext Scout**: not public. Yext's FAQ says rates scale with location count and solution. Third-party figures for Yext's base platform ($199/year per location "Emerging"; $999/year per location "Premium") do not say whether Scout is included. Scout was expanded to brand-level AI visibility on Sept 1, 2026. — [Yext FAQ](https://www.yext.com/knowledge-center/yext-faq); [Yext press release](https://www.yext.com/about/news-media/yext-expands-agentic-capabilities-to-grow-ai-visibility); [Gappsy](https://gappsy.com/tools/yext/)
- **Bluefish**: not public (quote only). **Estimate only:** one review reports entry tiers of $99-$799/month and enterprise contracts in the five to six figures annually; the reviewer sells a competing product. — [G2 Bluefish pricing](https://www.g2.com/products/bluefish/pricing); [Analyze AI review](https://tryanalyze.ai/blog/bluefish-ai-review)
- **Daydream**: no plans or prices on its pricing page; positioned at "growth and content teams from top companies". — [Daydream pricing](https://www.withdaydream.com/pricing)

#### Other entrants seen in roundups (third-party figures, not checked on vendor pages)

- Rankability's Oct 2, 2026 table of entry prices: Rankscale $20, Keyword AI Tracker $25, Otterly $29, Nightwatch LLM Tracking $32, Geneo $39, LLMrefs $79, Peec $99, Writesonic GEO $99, Knowatoa $99, ZipTie $99, Rankability from $97, Am I On AI $100, SE Ranking $119, Surfer AI Tracker $194, Hall $239, AthenaHQ $295, Scrunch $300, Profound $499, Ahrefs Brand Radar $699, Semrush AI Toolkit $745, seoClarity ArcAI $3,000. Stated median $99. Rankability sells a competing tracker, and several rows disagree with vendor pages read on Oct 12 (Knowatoa, Profound, Semrush). — [Rankability](https://www.rankability.com/blog/how-much-should-you-pay-for-ai-search-visibility-tracking-tools/)
- Searchable: $125 (25-100 prompts x 3 models), $150 (100 x 4), $525 (200 x 4). — [Detailed.com](https://detailed.com/ai-visibility-tools-pricing/)
- DataDab's Aug 4, 2026 snapshot: median entry price across six vendors with public figures was $74.50; median across 11 published plans was $189. — [DataDab](https://www.datadab.com/research/ai-marketing-software-pricing)

### Inferences
- The unit of price is nearly always "prompts tracked" (15 to 700 on self-serve plans). A small local business needs perhaps 15-50 prompts, which every vendor sells for under $130/month.
- Claude is frequently a paid extra or enterprise-only (Otterly add-on $29-$439/mo; Rankscale 2 credits vs 0.25; Ahrefs 8 checks per update; Writesonic Enterprise only; Profound Trial excludes it). Grok is rarer still. A service that scans all five assistants including Claude and Grok covers engines that cheap software tiers leave out.
- Headline entry prices understate real cost once engines and prompts are added; e.g. Otterly Lite plus Claude, Gemini and AI Mode add-ons is $29 + $29 + $9 + $9 = $76/month for 15 prompts (my arithmetic from the vendor's listed add-on prices).
- Mirror's lowest tier ($495) sits at the top of the software mid-tier band ($189-$500) and above almost every self-serve entry plan, so it cannot be justified as software access; it has to be justified by the done-for-you work.

### Gaps
- Peec AI's current official prices and currency: the vendor page showed no numbers to my fetch, and third-party sources disagree ($80/$205/$420 annual vs $95/$245/$495 monthly vs a claimed EUR restructure).
- Semrush AI Visibility Toolkit standalone price could not be confirmed on a Semrush page (two guessed URLs returned 404).
- Evertune's entry price conflicts between sources ($800 vs $3,000); the vendor page as fetched showed $800.
- Knowatoa question quotas, Local Falcon AI engine list, Promptwatch annual and agency prices, HubSpot AEO prompt count were not visible.
- Yext Scout, Bluefish and Daydream pricing is not public; no credible quote-level data found for Yext Scout or Daydream.
- G2 and Capterra listings were not opened directly except through search summaries.

## 2. Free scans, graders and audits as the entry point

### Takeaway
A free one-off check is standard in this category, but it is almost always a visibility or brand-perception score, not a fact-accuracy check. Free trials of 7-14 days without a card are the norm for paid tools.

### Cited Findings
- **HubSpot AEO Grader / AI Search Grader**: free, one-time, runs GPT-5.4 mini, Perplexity and Gemini; scores five dimensions out of 100 (Sentiment up to 40, Presence Quality 20, Brand Recognition 20, Share of Voice 10, Market Competition 10). "No account required", though the full report sits behind a form. Upsell is HubSpot AEO at $50/month. — [HubSpot AEO Grader](https://www.hubspot.com/aeo-grader)
- **Ahrefs free AI Visibility Checker**: shows how a brand appears in ChatGPT, Gemini, Perplexity, Copilot and Google AI Overviews, no signup. — [Ahrefs free AI visibility](https://ahrefs.com/free-ai-visibility)
- **Search Atlas free LLM visibility checker**: covers ChatGPT, Gemini, Perplexity, Copilot, Grok and Google AI; reports mentions, descriptions and competitors recommended instead. — [Search Atlas](https://searchatlas.com/ai-visibility/)
- **AthenaHQ Essential**: permanent free tier, 300 credits (1 credit = 1 AI response), 5 engines. — [AthenaHQ pricing](https://www.athenahq.ai/pricing)
- **Profound Trial**: free, 50 preset prompts daily for 7 days, 3 engines, no exports or history. — [Profound pricing](https://www.tryprofound.com/pricing)
- **Semrush Free plan**: $0, 1 demo project, 10 reports/day, no card. — [Semrush pricing](https://www.semrush.com/pricing/)
- **Local Falcon**: 100 free credits on sign-up, no card. — [Local Falcon pricing](https://www.localfalcon.com/pricing)
- **LLMrefs**: free account, no card (limits not stated). — [LLMrefs pricing](https://llmrefs.com/pricing)
- Free trials without a card: Scrunch 7 days; SE Ranking 14 days; Nightwatch 14 days; BrightLocal 14 days. Other 7-day trials: Rankscale Pro, Goodie Core, LLMrefs, Promptwatch Essential and Professional. — [Scrunch](https://scrunch.com/pricing); [SE Ranking](https://seranking.com/subscription.html); [Nightwatch](https://nightwatch.io/pricing/); [BrightLocal](https://www.brightlocal.com/pricing/); [Rankscale](https://rankscale.ai/pricing); [Goodie](https://higoodie.com/pricing); [Promptwatch](https://promptwatch.com/pricing)
- A September 2026 guide separates free checks into "brand perception" checks (ask the engines about the company) and "website readiness" audits (inspect the site), and says most free tools do only one. — [UD free AI visibility checkers, Sept 29, 2026](https://ud.hk/en/blogs/insight/article/free-ai-visibility-checkers-2026-09-29) (seen via search summary only)
- Goodie's agency plan uses 7-day "pitch workspaces" (10 per month) so agencies can show a prospect their own visibility data; Otterly gives agency partners "pitch workspaces" for prospect audits. — [Goodie pricing](https://higoodie.com/pricing); [Otterly pricing](https://otterly.ai/pricing)

### Inferences
- A free first scan is table stakes, not a differentiator. Mirror's free scan differs only if it reports wrong facts against the business's real details, which none of the free graders above claim to do.
- "Pitch workspace" features show that agencies routinely use a free scan of the prospect as the sales motion, the same motion Mirror uses.

### Gaps
- I did not run any of the free graders, so what they output for a small local business (as opposed to a known brand) is unverified.
- Rankability and Semrush free checkers appeared only in search summaries, not confirmed on vendor pages.

## 3. Small / local business tools versus enterprise, and the cheapest credible option

### Takeaway
Most tools target in-house marketing teams and agencies; only the local-SEO vendors (BrightLocal, Local Falcon, Yext) are built around locations. The cheapest credible paid options a single-location small business could buy are BrightLocal Track ($31-$41/mo, includes Local AI Visibility), Otterly Lite ($25-$29/mo), Rankscale Essentials ($17/mo annual), Local Falcon Starter ($24.99/mo) and HubSpot AEO ($50/mo).

### Cited Findings
- BrightLocal Track at $41/mo monthly or $31/mo annual for one location includes the Local AI Visibility Tracker (ChatGPT, Google AI Mode, Google AI Overviews). — [BrightLocal pricing](https://www.brightlocal.com/pricing/); [BrightLocal Local AI Visibility](https://www.brightlocal.com/local-seo-tools/local-ai-visibility)
- Otterly Lite $29/mo: 15 prompts, 4 engines, 1 workspace, 3 recommendations per week. — [Otterly pricing](https://otterly.ai/pricing)
- Rankscale Essentials $17/mo, yearly billing only. — [Rankscale pricing](https://rankscale.ai/pricing)
- HubSpot AEO $50/mo with no HubSpot subscription required. — [HubSpot AEO Grader](https://www.hubspot.com/aeo-grader)
- Ahrefs custom prompt tracking from $50/mo (2,500 checks). — [Ahrefs pricing](https://ahrefs.com/pricing)
- Enterprise-positioned: Profound (Trial or custom Enterprise only for brands); Evertune Pro "for mid-market brands" at $800/mo; Goodie Pro $999/mo requires a demo; Yext says Scout is its answer "for enterprises"; Daydream cites "growth and content teams from top companies". — [Profound pricing](https://www.tryprofound.com/pricing); [Evertune pricing](https://www.evertune.ai/pricing); [Goodie pricing](https://higoodie.com/pricing); [Yext press release](https://www.yext.com/about/news-media/yext-expands-agentic-capabilities-to-grow-ai-visibility); [Daydream pricing](https://www.withdaydream.com/pricing)
- Yext's Sept 1, 2026 release is titled as growing AI visibility "for enterprise brands and small businesses". — [Finviz copy of release](https://finviz.com/news/387393/yext-expands-agentic-capabilities-to-grow-ai-visibility-for-enterprise-brands-and-small-businesses)
- Rankability (competitor) advises that "most businesses should budget between $79-$149/month" for AI visibility tracking. — [Rankability](https://www.rankability.com/blog/how-much-should-you-pay-for-ai-search-visibility-tracking-tools/)

### Inferences
- A plumber or dentist can get basic AI-visibility monitoring for $17-$50/month, so monitoring alone is worth at most that much to a price-aware buyer. Mirror's $495 entry price is roughly 10-25x the software floor.
- None of the cheap tiers do the work: they report where the business appears and leave the fixing to the customer. That labour gap is where a done-for-you price has to be defended.
- BrightLocal is the most direct software comparison for Mirror's customer type, because it is already sold to local businesses and their agencies and bundles AI visibility at no extra charge.

### Gaps
- No evidence found on how many small local businesses actually buy these tools directly, as opposed to through an agency.
- Birdeye, Whitespark and Semrush Local AI-visibility pricing was searched but not found.

## 4. Agency and white-label plans

### Takeaway
Agency pricing is public at several vendors and usually works out to roughly **$7-$70 per client per month** for prompt-light white-label tracking, or **about $399 per client workspace** at the premium vendors (Profound, Goodie). This is the wholesale cost a competing agency would pay to resell a Mirror-like monitoring report.

### Cited Findings
- **Profound Agency Growth**: self-serve, 400 credits per month per client workspace (vendor page, no price). Reported price $99/mo base + $399/mo per client workspace, 10 pitch workspaces/mo (competitor-published, verified Sept 28, 2026). — [Profound pricing](https://www.tryprofound.com/pricing); [GEO Toolbox](https://geotoolbox.ai/blog/profound-pricing)
- **Goodie Agency Growth**: $275/mo, with client workspaces from $399/mo each. — [Goodie pricing](https://higoodie.com/pricing)
- **Otterly Agency Partner**: no separate price; agencies buy Standard ($189) or Premium ($489) and get 150 or 500 prompts instead of 100 or 400, unlimited workspaces, branded Looker Studio reports, one invoice. — [Otterly pricing](https://otterly.ai/pricing)
- **Rankscale Growth**: $385/mo, 50 brand dashboards, white-label dashboard links, API (about $7.70 per dashboard, my arithmetic). Enterprise $780/mo for 100 dashboards. — [Rankscale pricing](https://rankscale.ai/pricing)
- **SE Ranking Agency Pack**: +$69/mo on top of Core ($129) or Growth ($279), annual billing only; white-label platform and reporting, 30 client seats. — [SE Ranking pricing](https://seranking.com/subscription.html)
- **Nightwatch Agency**: EUR 399/mo, 500 AI prompts, 100 websites; white-label reports reportedly from Professional (EUR 159) upward. — [Nightwatch pricing](https://nightwatch.io/pricing/)
- **Rankability**: Agency $297/mo (300 tracked AI queries), Agency Pro $497/mo (500 queries); unlimited client workspaces and branded reports on all paid plans. — [Rankability](https://www.rankability.com/blog/how-much-should-you-pay-for-ai-search-visibility-tracking-tools/)
- **LLMrefs**: $79/mo covers unlimited projects, seats and domains with client dashboards (500 prompts shared). — [LLMrefs pricing](https://llmrefs.com/pricing)
- **BrightLocal**: white-labelling and an agency lead-generator widget are listed features; plan gating not visible. — [BrightLocal pricing](https://www.brightlocal.com/pricing/)
- **Ayzeo** (vendor claim, via search summary): $149/mo for 3 client projects, extra clients $49/mo; its own pitch says agencies charge **$500-$1,500 per client** for AI-visibility services. This is marketing copy, not independent data. — [Ayzeo agencies page](https://munich2026.piabo.net/agencies)
- Scrunch, AthenaHQ, Writesonic and Promptwatch have agency pages or tabs with no public agency price. — [Scrunch](https://scrunch.com/pricing); [AthenaHQ](https://www.athenahq.ai/pricing); [Writesonic](https://writesonic.com/pricing); [Promptwatch](https://promptwatch.com/pricing)

### Inferences
- An agency could white-label monitoring for a local client at well under $50/month in tool cost, so the tool cost in a $495-$1,995 retainer is a small share; the price is almost entirely labour, expertise and outcome.
- The only third-party hint at what agencies charge end clients ($500-$1,500 per client) lines up with Mirror's lower two tiers, but it is a single vendor's sales claim and should not be relied on alone.

### Gaps
- No independent survey data found on what agencies charge small businesses for GEO or AI-visibility retainers (covered by other research, not this scope).
- Profound's agency price is confirmed only by a competitor's write-up.

## 5. Price movement over the last 12 months

### Takeaway
Dated evidence shows prices becoming more transparent and the bottom of the market getting cheaper and more crowded during 2026, while the best-funded leader (Profound) moved the other way and went back to sales-only for brands in September 2026. I found no dated evidence of broad list-price increases.

### Cited Findings
- Profound: no dollar amounts before June 2026; Starter $99 and Growth $399 published June 11, 2026; both removed from the brand tab by about Sept 17, 2026, days after a $180M Series D at a $1.8B valuation (Sept 15, 2026); only Trial and Enterprise remained on Sept 26-28. Publisher is a competitor. — [GEO Toolbox](https://geotoolbox.ai/blog/profound-pricing)
- Confirmed on the vendor page on 2026-10-12: only Trial and Enterprise are listed for brands. — [Profound pricing](https://www.tryprofound.com/pricing)
- An Aug 2025-era figure for Profound of roughly $3,000-$4,000+ per month per brand is quoted by a competing vendor as a 2025 price. Unverified. — [Brandlight](https://sat.brandlight.ai/articles/what-ai-platform-alerts-on-model-hallucinations-vs-seo)
- Older Profound figures of $499 "Lite" and $1,499 Agency Growth come from a past roundup, not the current page. — [GEO Toolbox](https://geotoolbox.ai/blog/profound-pricing)
- Peec AI: prices were hidden, then made public on Aug 3, 2026 ($80 / $205 / $420 billed annually; add-on models $30 / $70 / $140). Packaging changes since: Grok removed from all plans June 8, 2026; Perplexity moved to Enterprise-only on Sept 21, 2026. — [PricingSaaS Peec](https://pricingsaas.com/companies/peec)
- Otterly: tracker shows no recorded price changes; Lite remains $29 monthly / $25 annual. — [PricingSaaS Otterly](https://pricingsaas.com/companies/otterly)
- HubSpot now sells AEO monitoring at $50/month standalone and bundles it into Marketing Hub Pro and Enterprise. — [HubSpot AEO Grader](https://www.hubspot.com/aeo-grader)
- BrightLocal includes Local AI Visibility at no additional cost on Track, Manage and Grow. — [BrightLocal help](https://help.brightlocal.com/hc/en-us/articles/38792699012882-Which-plans-include-Local-AI-Visibility)
- AthenaHQ lists a permanent free Essential tier (300 credits) alongside the $295 Starter. — [AthenaHQ pricing](https://www.athenahq.ai/pricing)
- LLMrefs labels its $79/mo plan "limited time only". — [LLMrefs pricing](https://llmrefs.com/pricing)
- Scrunch was reportedly acquired by Sitecore in mid-2026 with list prices unchanged at $300/$500 monthly. Seen in a search summary only. — [eClincher](https://www.eclincher.com/articles/profound-alternatives-8-ai-visibility-tools-after-profounds-pricing-change)
- Yext expanded Scout to brand-level AI visibility on Sept 1, 2026. — [Yext press release](https://www.yext.com/about/news-media/yext-expands-agentic-capabilities-to-grow-ai-visibility)

### Inferences
- Large incumbents (HubSpot, Semrush, Ahrefs, SE Ranking, BrightLocal, Yext) are bundling AI visibility into existing subscriptions or selling it for $50-$100/month. Monitoring is being commoditised; pure "we tell you what AI says" is unlikely to hold a premium price.
- Profound's exit from self-serve suggests the leader sees its margin in enterprise contracts and agents that do the work, not in cheap dashboards.
- Engines are being reshuffled between tiers (Peec moving Perplexity to Enterprise, Grok dropped), so "which engines are included" is now a pricing lever.

### Gaps
- No October 2025 baseline price list was found, so year-over-year changes for most vendors cannot be measured; the only tracker histories found were for Peec and Otterly.
- The PricingSaaS page for Profound returned 404; the Profound timeline rests on one competitor article plus my own page read.
- No vendor changelog posts announcing price increases were found.

## 6. Accuracy and hallucination checking

### Takeaway
Profound FactCheck (launched July 14, 2026) is the only productised accuracy check I could confirm, and it works the same way Mirror does: claims are checked against a brand-supplied knowledge base and traced to the source URLs. It is listed as available on all Profound plans, but Profound no longer sells a public self-serve brand plan. No tool was found that fixes wrong facts at the source as a service.

### Cited Findings
- Profound launched FactCheck on July 14, 2026; it extracts the claims AI engines make about a brand, checks each against the brand's own knowledge base, and shows which citation URLs drive inaccurate claims. Profound calls accuracy its third pillar alongside visibility and sentiment. — [Profound newsroom](https://www.tryprofound.com/newsroom/profound-launches-factcheck-to-measure-the-accuracy-of-ai-answers-about-your-brand)
- Each claim is classified "accurate, inaccurate, or not relevant"; subjective statements go to Sentiment; FactCheck requires a Knowledge Base and FactCheck-tagged prompts. The help article says "Available on: all plans". No claim quotas or credit costs are given. — [Profound help: About FactCheck](https://help.tryprofound.com/articles/5793584301-about-factcheck)
- Profound's pricing page does not mention fact checking, accuracy or hallucinations. — [Profound pricing](https://www.tryprofound.com/pricing)
- Trade-press coverage of FactCheck. — [AdExchanger](https://www.adexchanger.com/ai/ai-is-spreading-inaccurate-information-about-brands-this-tool-can-help-fix-that/)
- Evertune publishes guidance on what to do when ChatGPT says something wrong about a brand; this is a blog post, not a confirmed product feature or plan. — [Evertune article](https://www.evertune.ai/resources/insights-on-ai/ai-brand-safety-what-to-do-when-chatgpt-says-something-wrong-about-your-brand)
- None of the other vendor pricing pages read on 2026-10-12 (Otterly, Scrunch, AthenaHQ, Goodie, Rankscale, Writesonic, LLMrefs, Knowatoa, SE Ranking, Surfer, Nightwatch, BrightLocal, Semrush, Ahrefs) listed a fact-accuracy or hallucination check as a plan feature in the text returned; they list visibility, citations, sentiment and recommendations. — e.g. [Otterly](https://otterly.ai/pricing); [Scrunch](https://scrunch.com/pricing); [Writesonic](https://writesonic.com/pricing)
- Third-party claims on error rates (15-52% hallucination rate attributed to Search Engine Land; about one in five brand-related AI answers containing a factual error attributed to Originality.ai) appear in vendor blogs and were not confirmed against the original reports. — [Alhena](https://alhena.ai/blog/monitor-brand-ai-search-ecommerce-guide); [LLM Pulse](https://llmpulse.ai/blog/glossary/ai-hallucination/)

### Inferences
- With Profound's brand plans now Trial or custom Enterprise, fact checking against a client knowledge base is effectively an enterprise-priced capability (or reachable via the reported $399-per-client agency workspace). There is no confirmed sub-$300 self-serve tool that checks facts.
- Accuracy checking plus fixing is the part of Mirror's offer with the least direct software competition and so the strongest basis for pricing above the software band. Visibility monitoring alone is not.
- Profound's launch validates the "fact sheet as source of truth" method and also means a well-funded competitor could push it down-market.

### Gaps
- Feature pages (as opposed to pricing pages) of Scrunch, AthenaHQ, Goodie, Yext Scout, Bluefish and Evertune were not read, so an accuracy feature not mentioned on a pricing page could have been missed. Absence here is "not found", not "does not exist".
- Whether FactCheck is included in Profound's free Trial and Agency Growth in practice, and any usage limits, could not be confirmed.
- No pricing found for any done-for-you "fix wrong facts at the source" service from a software vendor.
