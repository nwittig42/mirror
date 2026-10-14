# Funnel benchmarks: AI mention → visit → lead → customer → revenue (as of October 2026)

Reading notes for the report writer:
- "PRIMARY" = I opened the original page in this session. "SECONDARY" = the number came from a search summary or a third-party write-up and was NOT checked against the original; verify before publishing.
- Every range in an "Inferences" block is my own construction from the cited numbers, not a published benchmark.
- Two sources could not be opened (HTTP 403 or timeout): the Adobe Digital Insights PDFs, the WordStream 2026 blog, and the Search Engine Land write-up of the Kaiser/Schulze paper. Their numbers below are SECONDARY.

---

## 1. When an AI answer names or cites a business, what share of users click through?

### Takeaway
There is no published "clicks per mention" rate for ChatGPT, Perplexity, Gemini or Claude; the best hard number is Pew's 1% click rate on links inside a Google AI summary, and TollBit's claim that chatbots send ~96% fewer clicks than classic search. Most ChatGPT answers contain no web link at all (6.8% of conversations on average), so a click-based funnel will badly under-count AI influence.

### Cited Findings

Google AI Overviews
- Pew (PRIMARY; 900 US adults, 68,879 Google searches, browsing March 2025, published 22 Jul 2025): users clicked a link inside the AI summary in 1% of visits; clicked a traditional result in 8% of visits with an AI summary vs 15% without; ended the session 26% of the time with a summary vs 16% without. 18% of searches produced an AI summary; 88% of summaries cited 3+ sources. — [Pew Research](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/)
- Seer Interactive (PRIMARY; 53 brands, 5.47M queries, 2.43B organic impressions, Jan 2025–Feb 2026, published 24 Apr 2026): full-year 2025 organic CTR on informational queries was 3.35% with no AI Overview, 2.07% when an AI Overview showed and the brand was cited, 0.94% when it showed and the brand was not cited. Per 1M impressions: ~33,500 / ~20,743 / ~9,445 clicks. — [Seer Interactive](https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update)
- Seer, same study: all-query organic CTR with an AI Overview fell from 3.19% (Jan 2025) to a low of 1.31% (Dec 2025), then rose to 2.36% (Feb 2026); without an AI Overview it was 3.82% in Feb 2026. Seer calls this "leveling off", not recovery. — [Seer Interactive](https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update)
- Seer, same study: brand-cited informational CTR collapsed late in 2025 (2.52% Sept → 1.21% Oct → 0.76% Nov → 0.95% Dec) as cited impressions more than doubled (15.8M → 39.5M) while clicks stayed flat or fell. So "cited" is worth less per impression than the annual average suggests. — [Seer Interactive](https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update)
- Seer caveats (PRIMARY): one account made up 47% of the "not cited" informational impressions; excluding it that CTR rises from 0.94% to ~1.61%. No causation claimed (stronger brands get cited more). Transactional sample is small. — [Seer Interactive](https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update)
- Seer: AI Overviews appeared on 36% of informational, 8% of commercial and 5% of transactional queries in its set; on 76.9% of "near me" queries and 81.3% of "best-of" queries. — [Seer Interactive](https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update)
- Ahrefs (SECONDARY; reported as 300,000 keywords, December 2025 data, published ~Feb 2026): position-one CTR is 58% lower when an AI Overview appears; an earlier Ahrefs study on March 2025 data found 34.5%. — [presenc.ai comparison](https://presenc.ai/research/ai-overviews-ctr-impact-2026); [ppc.land](https://ppc.land/google-touts-billions-of-weekly-ai-search-clicks-as-ctr-data-drops-58/)
- Randomised experiments (SECONDARY): Agarwal and Sen (SSRN, April 2026) found organic clicks fell 38% with AI Overviews and zero-click rose from 54% to 72%; a separate field experiment with 1,065 desktop Chrome users found a 39.8% drop in publisher clicks. — [getairefs roundup](https://getairefs.com/blog/google-ai-overviews-statistics-june-2026/)

Google AI Mode
- UPenn/Northeastern preprint (SECONDARY; 1,100 US Chrome users randomly assigned, dated 18 Aug 2026, not peer reviewed): forcing searches into AI Mode cut publisher click-through by 18.8 percentage points versus current Search. — [TechWyse](https://www.techwyse.com/news/search-seo/google-ai-mode-reduces-publisher-clicks-study-2026)
- SparkToro/Similarweb (SECONDARY; US, Jan–Apr 2026, published June 2026): 68.01% of US Google searches ended without a click; 276 clicks per 1,000 searches reached the open web, down from 374 in the 2024 Datos study; only 0.34% of searches moved into AI Mode. — [Search Engine Land](https://searchengineland.com/google-zero-click-searches-2026-study-479717); [Digital Applied](https://www.digitalapplied.com/blog/sparktoro-zero-click-study-2026-68-percent-seo-analysis)

ChatGPT and other chatbots
- TollBit "State of the AI Bots, Q3 & Q4 2025" (SECONDARY snippet of TollBit's own page; methodology and sample not seen): AI chatbot referrals have 96% lower click-through than traditional search such as Google. TollBit sells bot-monetisation tools to publishers, so it has an interest in showing chatbots send little traffic. — [TollBit](https://tollbit.com/analytics)
- Similarweb (PRIMARY blog, published 3 Sep 2026; US desktop, May 2026): only 6.8% of ChatGPT conversations included web citations at all; 22.6% of Travel answers and 13.5% of Retail answers did. — [Similarweb](https://aisearch.similarweb.com/blog/ai-referral-traffic-by-industry/)
- Similarweb, same page: a ChatGPT linking change on 7 May 2026 coincided with a 36% month-over-month jump in AI referrals to Marketplaces (April → May 2026). — [Similarweb](https://aisearch.similarweb.com/blog/ai-referral-traffic-by-industry/)
- Datos (SECONDARY; July 2026): AI tools were 1.83% of US desktop activity in Q2 2026 vs 10.52% for traditional search. — [Digital Applied](https://www.digitalapplied.com/blog/sparktoro-zero-click-study-2026-68-percent-seo-analysis)
- Share of AI referral clicks by platform, three conflicting panels: First Page Sage 2026 (PRIMARY): ChatGPT 68.4%, Gemini 14.7%, Perplexity 6.9%, Claude 5.3%, Copilot 3.1%, other 1.6% — [First Page Sage](https://firstpagesage.com/seo-blog/ai-impact-on-website-traffic-report/); Statcounter Aug 2026 (SECONDARY): ChatGPT 79.4% — [upGrowth](https://upgrowth.in/ai-traffic-share-report-2026/); Previsible (SECONDARY): 92.4% — [On-Page.ai](https://blog.on-page.ai/chatgpt-lost-20-points-prompt-share/). Differences come from different site panels (B2B clients vs global referrer data).
- Rough analogue only: citation links on English Wikipedia had a 0.29% click-through and 93% of cited URLs were never clicked in a month (2020 paper). Not AI-specific. — [arXiv](https://arxiv.org/pdf/2001.08614)

### Inferences
- Suggested "answer that names the business → tracked website click" rate for the model: low 0.3%, mid 1%, high 3%. Basis: Pew's 1% on AI summary links as the mid; TollBit's "96% lower than search" applied to typical search CTRs gives a few tenths of a percent as the low; the high allows for transactional/local prompts and ChatGPT's May 2026 change that made brand links more prominent. None of these three points is a direct chatbot measurement.
- For Google AI Overviews specifically, a better framing than "citation click rate" is Seer's per-impression table: being cited is worth roughly 2.2x the organic clicks of not being cited on the same results page (2.07% vs 0.94%), or ~1.3x after removing Seer's outlier account (2.07% vs ~1.61%). Use 1.3x–2.2x.
- Because only ~7% of ChatGPT conversations carry any link (up to ~23% in travel), the click step should be applied only to answers that contain a link, or the model should treat clicks as a minority path next to branded search (section 2).

### Gaps
- No study found that reports clicks per ChatGPT, Perplexity, Gemini, Claude or Grok answer that names a business. Searched for clicks per 1,000 prompts and outbound-click share of conversations; nothing returned.
- TollBit's exact chatbot and search click-through percentages were not retrieved, only the "96% lower" headline.
- Authoritas and Semrush click-through studies were not found in this session.
- No Perplexity-, Gemini-, Claude- or Grok-specific click-through figures found.
- Ahrefs' 58% figure and the two randomised experiments were not checked against the originals.

---

## 2. How much AI influence never shows up as a click?

### Takeaway
The one real measurement (Similarweb, June 2026) says people shown a brand in ChatGPT were 2.5x more likely to visit it within seven days, and 55.9% of those visits arrived through branded search rather than an AI referral. A vendor survey comparison puts true AI-driven conversions at roughly 9x what analytics credits.

### Cited Findings
- Similarweb "The Downstream Impact of AI Visibility" (SECONDARY write-up of a study published 21 Jun 2026; US desktop clickstream panel; finance, travel, beauty; brand pairs Amex/Capital One, Skyscanner/Kayak, Sephora/Ulta; panel size not reported): users who saw a brand recommended in ChatGPT were 2.5x more likely to visit that brand's site within 7 days; 55.9% of that downstream traffic came via branded search; AI-influenced visitors viewed 12.0 pages and spent 11.8 minutes per session vs 6.5 pages and 5.6 minutes for others. Similarweb states this is correlation, not causation. — [SEO Handbook summary](https://seohandbook.co.uk/seo-news-updates/similarweb-ai-visibility-downstream-impact/); original cited as [Similarweb](https://www.similarweb.com/corp/the-downstream-impact-of-ai-visibility/) (not opened)
- Graphite with n8n (SECONDARY; vendor, sample size not seen): GA4 last-touch credited AI answer engines with about 1% of conversions, while post-conversion surveys put it near 9%. Graphite is a growth agency selling AI-search work, so treat as self-serving. — [AuthorityTech](https://authoritytech.io/blog/ai-search-broke-attribution-what-replaces-click-tracking-2026)
- Similarweb (PRIMARY): referral counts are a floor, because AI visits that arrive without referrer data are recorded as direct traffic. — [Similarweb](https://aisearch.similarweb.com/blog/ai-referral-traffic-by-industry/)
- Kaiser and Schulze (SECONDARY; Marketing Science, April 2026): the authors suggest people use ChatGPT for research, then check other sources and buy elsewhere, which shifts last-click credit away from ChatGPT. — [INFORMS](https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489); [Digiday](https://digiday.com/marketing/e-commerce-sites-see-low-sales-from-chatgpt-traffic-new-study-finds/)

### Inferences
- "Dark" multiplier on tracked AI referral visits: low 2x, mid 3x, high 9x. Basis: if 55.9% of downstream visits come through branded search, total influenced visits are at least ~2.3x the non-branded-search remainder (and that remainder also includes direct visits, so tracked AI referrals are smaller still); the Graphite survey gap gives ~9x as an upper bound.
- The Similarweb brands are large household names. For a small local business the pattern may differ (people may call or use maps instead of searching the name); there is no data either way.

### Gaps
- No controlled experiment isolating AI no-click influence on branded search was found.
- The Similarweb report does not give the split between direct visits and visible AI referrals, the panel size, or per-industry lift.
- Widely repeated figures such as "34% higher direct traffic from AI citations" trace to aggregator pages with no primary source; excluded.
- Nothing found for small or local businesses.

---

## 3. How does AI-referred traffic convert compared with organic search?

### Takeaway
Studies disagree by business type: for lead-generation, B2B and sign-up sites AI visitors convert roughly 1.5x–5x better than organic (with outlier claims up to 23x), while the largest e-commerce dataset found ChatGPT converting about 13% worse than organic through mid-2025. Adobe's retail data shows this flipped during 2025–2026, with AI visits converting 42–54% better than other traffic by spring 2026.

### Cited Findings

| Study | Date | Sample | Result | Status |
|---|---|---|---|---|
| First Page Sage | Published 25 Aug 2026; data Jan 2023–Jul 2026 | 218 client sites, 12 industries, 3.4B sessions | Visitor→lead: ChatGPT 4.7%, Perplexity 4.1%, Claude 3.9%, Gemini 2.8%, Copilot 2.4%, Google organic 1.9%. Lead→customer: ChatGPT 21.3%, Perplexity 19.8%, Claude 22.6%, Gemini 16.4%, Copilot 15.1%, Google organic 13.7% | PRIMARY |
| Kaiser and Schulze, Marketing Science | SSRN Oct 2025; journal Apr 2026 | 973 e-commerce sites, ~$20B revenue, 12 months, >50,000 ChatGPT transactions vs 164M others | ChatGPT converted below every channel except paid social; organic ~13% higher than ChatGPT; affiliate 86% higher. ChatGPT ~0.2% of sessions. Conversion rose over time but order values fell | SECONDARY |
| Adobe Digital Insights | March 2026 | US retail sites (Adobe Analytics; sample not seen) | AI traffic converted 42% better than non-AI; revenue per visit 37% higher. A year earlier AI traffic converted 38% worse and non-AI visits were worth 128% more | SECONDARY |
| Adobe Digital Insights | May 2026 | US retail sites | AI traffic converted 54% better than non-AI | PRIMARY for the Similarweb page quoting it |
| Adobe Digital Insights | Published 19 Aug 2026 | US retail sites | 60% higher conversion, 53% more revenue per visit | SECONDARY, single source |
| Microsoft Clarity | 6 Nov 2025 | 1,200+ publisher/news sites (1,277 domains), one month | Sign-up rate: AI 1.66%, search 0.15%, direct 0.13%, social 0.46%. Subscription: AI 1.34% vs search 0.55% | SECONDARY |
| Semrush | June 2025 | Not seen | Average AI-search visitor worth ~4.4x an organic visitor; premium concentrated in research-heavy categories, weaker for impulse e-commerce | SECONDARY |
| Seer Interactive case study | 2025 | One B2B site | ChatGPT 15.9% vs Google organic 1.76% | SECONDARY |
| Ahrefs (own site) | Published 18 Nov 2025 | One site, no volume given | AI search ~0.5% of visits but ~12.1% of sign-ups, ~23x organic | PRIMARY |
| Buffer (own site) | 2025 | One site, no volume given | AI traffic 20.15% vs organic 7.06% | PRIMARY for the Ahrefs page quoting it |
| 94-site e-commerce analysis | Full-year 2025 | 94 e-commerce sites | ChatGPT 1.81% vs non-branded organic 1.39% (+31%) | SECONDARY, original not identified |

Sources: [First Page Sage](https://firstpagesage.com/seo-blog/ai-impact-on-website-traffic-report/); [INFORMS / Marketing Science](https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489) and [Search Engine Land](https://searchengineland.com/llms-google-referral-conversion-study-463747); Adobe March 2026 via [Decrypt](https://decrypt.co/364733/ai-traffic-us-retailers-jumps-q1-agentic-shoppers-outspend-humans) and [Digital Commerce 360](https://www.digitalcommerce360.com/2026/04/23/ecommerce-trends-ai-key-conversion-metric/); Adobe May 2026 via [Similarweb](https://aisearch.similarweb.com/blog/ai-referral-traffic-by-industry/); Adobe August 2026 via [Webscale newsletter](https://ai.webscale.com/newsletter/issue-02); Clarity via [ppc.land](https://ppc.land/ai-traffic-converts-at-3x-higher-rates-than-traditional-channels/); Semrush via [Marshal](https://www.runmarshal.com/field-notes/ai-search-traffic-is-4x-more-valuable-than-organic); Seer case study via [SerpClix](https://serpclix.com/blog/chatgpt-referral-traffic-converts-higher-low-volume); [Ahrefs](https://ahrefs.com/blog/chat-gpt-traffic); 94-site figure via [Relevant Audience](https://www.relevantaudience.com/seo/why-chatgpt-traffic-converts-worse-than-google-search/).

- Self-interest flags: First Page Sage, Seer, Semrush, Ahrefs and Graphite all sell AI-search or SEO services or tools. Single-site figures (Ahrefs 23x, Seer 15.9%, Buffer) are anecdotes about software companies whose buyers are heavy AI users, not benchmarks.
- Conflict within Adobe coverage (SECONDARY): Digital Commerce 360 says AI visitors converted at "almost half the rate" a year earlier, while Decrypt and Fibre2Fashion say 38% worse. — [Digital Commerce 360](https://www.digitalcommerce360.com/2026/04/23/ecommerce-trends-ai-key-conversion-metric/); [Fibre2Fashion](https://www.fibre2fashion.com/news/retail-industry/us-retailers-see-surge-in-ai-traffic-adobe-309790-newsdetails.htm?amp=true)

Why the studies differ
- Period: the academic e-commerce data ends around mid-2025; Adobe shows retail AI conversion going from below to above other traffic between March 2025 and March 2026.
- Business model: sign-up and lead conversions (Clarity, Ahrefs, First Page Sage) versus purchases (Kaiser/Schulze, Adobe).
- Comparison base: "all non-AI traffic" (Adobe) versus "organic search" (others); organic usually converts better than the all-traffic average, so Adobe's multiplier overstates the gap against organic.
- Attribution: last-click undercounts AI when people research in ChatGPT and buy later through another channel.

### Inferences
- Suggested multiplier on the business's organic visit→lead rate for AI-referred visitors: lead-gen, local and professional services low 1.0x, mid 2.0x, high 3.0x (First Page Sage ChatGPT 4.7% vs 1.9% = 2.5x; Gemini 2.8% vs 1.9% = 1.5x). E-commerce low 0.9x, mid 1.3x, high 1.6x (Kaiser/Schulze below organic; 94-site +31%; Adobe +42% to +60% vs all traffic). B2B SaaS low 1.5x, mid 2.5x, high 5x (First Page Sage 2.5x, Semrush 4.4x; exclude 23x single-site claims).
- Suggested multiplier on lead→customer for AI-sourced leads: low 1.0x, mid 1.3x, high 1.6x (First Page Sage: 21.3% vs 13.7% = 1.55x for ChatGPT; 15.1% vs 13.7% = 1.1x for Copilot). This rests on a single vendor panel.

### Gaps
- Adobe's original PDFs timed out; conversion numbers by industry (travel, financial services) were not retrieved.
- The Kaiser/Schulze paper and Search Engine Land article were not opened (403); figures come from abstract snippets and press coverage.
- Semrush's 4.4x study and Seer's case study were not opened; sample sizes unknown.
- No conversion comparison found for local services, clinics, dental, legal or restaurants specifically.

---

## 4. What share of website traffic comes from AI assistants, by industry, and how fast is it growing?

### Takeaway
Estimates range from about 0.2–0.5% of sessions (broad datasets) to 6.24% (First Page Sage's client panel in Q2 2026); for a typical small business 0.5–3% is the defensible range, with local services at the bottom. Growth is slowing but still roughly doubling year over year.

### Cited Findings

Share of sessions by industry, First Page Sage (PRIMARY; 218 client sites, 3.4B sessions, published 25 Aug 2026, "2026" figures):

| Industry | AI share of sessions | Change in organic sessions vs counterfactual |
|---|---|---|
| B2B SaaS | 11.8% | -29.4% |
| Professional Services | 9.4% | -27.8% |
| Financial Services | 8.1% | -26.1% |
| Healthcare | 6.7% | -38.2% |
| Education | 6.2% | -41.8% |
| Legal Services | 5.9% | -22.7% |
| Media & Publishing | 4.8% | -47.3% |
| Manufacturing | 4.1% | -18.3% |
| Travel & Hospitality | 3.6% | -34.6% |
| Ecommerce & Retail | 2.3% | -11.6% |
| Real Estate | 1.9% | -9.2% |
| Local Services | 1.4% | -6.8% |

— [First Page Sage](https://firstpagesage.com/seo-blog/ai-impact-on-website-traffic-report/)

- First Page Sage, same page: AI share of all sessions by quarter: Q1 2024 0.44%, Q4 2024 1.29%, Q2 2025 2.48%, Q4 2025 4.07%, Q1 2026 5.13%, Q2 2026 6.24%. Total AI referral traffic grew 96% year over year, down from 286% the year before. Platform growth 2025→2026: ChatGPT +75%, Gemini +194%, Perplexity +88%, Claude +191%, Copilot +196%. — [First Page Sage](https://firstpagesage.com/seo-blog/ai-impact-on-website-traffic-report/)
- Flag: First Page Sage is an SEO/AI-optimisation agency; its panel is its own clients (skewed to B2B and to sites actively optimised for AI), and its organic-loss figures are measured against a projected counterfactual, not actual declines. Expect its shares to be several times higher than the general web.
- Kaiser and Schulze (SECONDARY; 973 e-commerce sites, 12 months to ~mid-2025): ChatGPT was ~0.2% of sessions, about 200x smaller than Google organic. — [INFORMS](https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489)
- Ahrefs (PRIMARY; published 18 Nov 2025): ChatGPT holds ~0.24% of traffic across Google and major search engines; share roughly tripled Jan–Sept 2025; AI search is ~0.5% of Ahrefs' own visits; ChatGPT penetration 0.97% in Finance vs 0.03% in Autos. — [Ahrefs](https://ahrefs.com/blog/chat-gpt-traffic)
- Microsoft Clarity (SECONDARY; Nov 2025, 1,200+ publisher sites): AI referrals grew 155.6% over eight months but stayed under 1% of traffic. — [ppc.land](https://ppc.land/ai-traffic-converts-at-3x-higher-rates-than-traditional-channels/)
- Similarweb 2026 Generative AI Landscape (PRIMARY blog, published 3 Sep 2026; worldwide desktop + mobile web, Jun 2025–May 2026): AI platforms sent an average of 770.7M referral visits per month, +117.4% year over year. Average monthly AI referrals by industry: Marketplaces 46.8M (+237.3%), News 44.5M (+115.6%), Travel 44.5M (+115.6%; the identical News/Travel figures look like an extraction duplicate, verify), Finance 19.1M (+236.5%), Consumer Electronics 17.1M (+215.4%), Fashion +278.2%, Beauty 2.0M (+312.5%). Similarweb says AI referrals are "a low single-digit percentage" of most sites' traffic. — [Similarweb](https://aisearch.similarweb.com/blog/ai-referral-traffic-by-industry/)
- Adobe Digital Insights (SECONDARY; US, Q1 2026): AI visit share growth year over year: Retail +393%, Travel +233%, Financial Services +158%, Media/Entertainment +84%, Tech/Software +63%. Tech/Software has the highest AI visit share, about 2x Media/Entertainment and 4x Retail. May 2026: Travel +194%, Retail +138%, Financial Services +105%. — [Adobe Q2 report PDF](https://business.adobe.com/resources/sdk/.2026-q2-ai-traffic-report/q2-2026-adi-ai-sourced-traffic-insights.pdf); [Adobe Q3 report PDF](https://business.adobe.com/resources/sdk/.q3-ai-traffic-trends-report/q3-2026-ai-sourced-traffic-insights.pdf) (neither opened; figures from search summary)
- Adobe via Similarweb (PRIMARY for the quoting page): AI traffic to US retail sites rose 1,324% from October 2024 to May 2026; holiday 2025 growth was 693% retail, 539% travel, 266% financial services. — [Similarweb](https://aisearch.similarweb.com/blog/ai-referral-traffic-by-industry/)
- GMBapi Q2 2026 (SECONDARY): US Google Business Profile calls down 11.9% and website clicks down 12.5% year over year; direction requests up 21.1%. — [Trulove Webworks](https://trulovewebworks.com/google-business-profile-clicks-down-local-seo/)

### Inferences
- Default AI share of sessions for the model, mid-2026: local services 0.3% / 1% / 2%; e-commerce 0.2% / 1% / 2.5%; clinics, dental and legal 0.5% / 2% / 6%; B2B SaaS and professional services 1% / 4% / 12%. Lows come from the broad datasets (Ahrefs, Kaiser/Schulze, Clarity), highs from First Page Sage.
- Growth default: 2x per year (range 1.6x–2.4x), from First Page Sage +96%, Similarweb +117% and the deceleration both report.

### Gaps
- No neutral, large-panel dataset gives AI share of sessions by industry for 2026; First Page Sage is the only by-industry table and it is a vendor client panel.
- Adobe's absolute AI share percentages were not retrieved.
- Nothing specific to restaurants, dental or aesthetic clinics.

---

## 5. Standard visit → lead and lead → customer rates by industry

### Takeaway
Paid-search click→lead rates (LocaliQ 2026) run 5–12% for local and medical categories; organic site-wide visitor→lead rates (First Page Sage) are much lower at 1–3%, with legal an outlier at 7.4%. About 42–46% of phone leads convert on the call (Invoca), and e-commerce visit→order sits around 2–3%.

### Cited Findings

Click → lead on paid search, WordStream by LocaliQ 2026 (PRIMARY; page updated 1 Jun 2026; "thousands" of US campaigns, sample and period not stated on the page; secondary coverage says April 2025–March 2026 and 13,000+ campaigns; a lead = call, chat, form or email after an ad click):

| Industry | Conversion rate | Cost per lead | CTR | CPC |
|---|---|---|---|---|
| All industries | 8.18% | $66.69 | 6.64% | $5.42 |
| Home & Home Improvement | 8.05% | $90.92 | 6.47% | $8.33 |
| Physicians & Surgeons | 12.43% | $40.04 | 6.61% | $4.76 |
| Dentists & Dental Services | 10.67% | $72.97 | 5.66% | $8.00 |
| Beauty & Personal Care | 10.35% | $39.25 | 6.75% | $4.62 |
| Personal Services | 12.34% | $54.60 | 7.16% | $7.17 |
| Health & Fitness | 6.94% | $67.36 | 5.81% | $6.17 |
| Attorneys & Legal Services | 5.55% | $131.63 | 5.87% | $9.87 |
| Restaurants & Food | 8.05% | $30.57 | 6.83% | $2.05 |
| Automotive Repair, Service & Parts | 15.51% | $29.96 | 5.56% | $4.35 |
| Animals & Pets | 16.22% | $31.50 | 7.49% | $4.06 |
| Business Services | 4.85% | $93.69 | 6.10% | $5.87 |
| Real Estate | 3.70% | $102.51 | 7.61% | $3.22 |
| Finance & Insurance | 2.64% | $74.44 | 9.83% | $3.39 |
| Education & Instruction | 13.14% | $77.48 | 7.56% | $4.81 |
| Apparel, Fashion & Jewelry | 4.50% | $97.51 | 6.64% | $4.44 |
| Shopping, Collectibles & Gifts | 4.01% | $49.40 | 8.28% | $4.14 |
| Furniture | 2.99% | $106.70 | 6.57% | $3.97 |
| Travel | 5.83% | $44.70 | 9.32% | $2.14 |

— [LocaliQ](https://localiq.com/blog/search-advertising-benchmarks/). Note: these are ad clicks landing on purpose-built pages with buying intent, so they are an upper bound for organic or AI-referred visits. Home & Home Improvement and Restaurants & Food showing the identical 8.05% may be an extraction error; verify.

Site-wide visitor → lead, First Page Sage (PRIMARY; client data Jan 2022–Aug 2025, updated 18 Sep 2025; sample size not stated): Legal Services 7.4%, HVAC Services 3.1%, Staffing 2.9%, Higher Education 2.8%, Real Estate 2.7%, Manufacturing 2.2%, Addiction Treatment 2.1%, Financial Services 1.9%, Construction 1.9%, Solar 1.8%, IT & Managed Services 1.5%, B2B SaaS 1.1%, Software Development 1.1%. — [First Page Sage](https://firstpagesage.com/reports/b2b-conversion-rates-by-industry-fc/)

- First Page Sage 2026 AI report (PRIMARY): across its 218-site panel Google organic visitor→lead is 1.9% and lead→customer is 13.7% (lead = marketing-qualified lead). — [First Page Sage](https://firstpagesage.com/seo-blog/ai-impact-on-website-traffic-report/)
- Invoca 2026 (SECONDARY; 70M+ calls): 42% of phone leads convert during the call; Healthcare 45%, Home Services 45%. Invoca 2025 edition (60M+ calls): overall 37%, Home Services 46%, Healthcare 40%, and 61% of callers reach a person. Invoca sells call tracking. — [Invoca](https://www.invoca.com/blog/lead-conversion-rate-benchmarks); [Supply House Times](https://www.supplyht.com/articles/106612-home-services-call-performance-report-46-lead-conversion-rate-segment-benchmarks)
- Home services lead→paying customer (SECONDARY; vendor blog, methodology not seen): average ~7.8% across lead types; plumbing 12–16%; roofing 3–7%; phone leads 46%. — [EstateHub](https://www.estatehub.io/articles/2026-benchmarks-lead-conversion-rates-home-services)
- Ruler Analytics 2026 (SECONDARY; 5M+ conversions, 13 industries): 56% of legal conversions and 53% of professional-services conversions happen by phone. Older Ruler data (2021): legal 4.5% overall site conversion, split 3.4% forms and 1.1% calls. — [Ruler Analytics](https://www.ruleranalytics.com/blog/insight/conversion-rate-by-industry/)
- B2B SaaS close rates (SECONDARY; aggregator blogs, weak): 15–20% average close rate for SaaS/technology, 22–28% for inbound leads; ~20% lead-to-close for B2B overall. — [Grade My Close](https://www.grademyclose.com/blog/average-close-rate-by-industry); [Prospeo](https://www.prospeo.io/s/sales-conversion-rate)
- E-commerce visit→order (SECONDARY): Shopify rolling 12-month figures as reported by third parties: food and beverage 6.22%, beauty and personal care 4.94%, fashion and apparel 3.06%, home and furniture 1.41%, luxury and jewellery 0.94%. — [EightX](https://eightx.co/blog/average-conversion-rate-by-ecommerce-vertical-2026)
- E-commerce blended (SECONDARY): IRP Commerce June 2026 conversion 2.03% (1.85% in June 2025); Dynamic Yield rolling 12-month 2.66%; Littledata platform-wide 1.4%; Shopify established stores 2.5–3.0%. — [Speed Commerce](https://www.speedcommerce.com/insights/ecommerce-benchmarks-conversion-rates-by-industry-over-by-year/); [Daymark](https://www.usedaymark.io/blog/what-is-a-good-conversion-rate)

### Inferences
Suggested defaults (organic or AI-referred visit, not paid ads). Visit→lead mids are set between the First Page Sage site-wide rate and roughly half the LocaliQ paid rate; where neither exists the row is marked "weak".

| Business type | Visit → lead (low / mid / high) | Lead → customer (low / mid / high) | Basis |
|---|---|---|---|
| Local home services | 2% / 4% / 8% | 8% / 25% / 45% | FPS HVAC 3.1%; LocaliQ 8.05%; EstateHub 7.8% all-lead; Invoca 45% phone |
| Medical and aesthetic clinics | 2% / 5% / 12% | 15% / 30% / 45% | LocaliQ physicians 12.43%, beauty 10.35%; Invoca healthcare 45%. Weak on lead→customer |
| Dental | 2% / 5% / 10% | 15% / 30% / 45% | LocaliQ 10.67%; Invoca healthcare 45%. Weak |
| Legal | 2% / 5% / 7.5% | 5% / 14% / 22% | FPS 7.4%; LocaliQ 5.55%; FPS panel lead→customer 13.7–21.3%. Weak on close rate |
| Restaurants | 3% / 6% / 8% (order, booking or call) | 50% / 70% / 90% | LocaliQ 8.05%. Close rate is an assumption with no source |
| E-commerce | 1% / 2.5% / 5% (visit → order directly) | not applicable | IRP 2.03%, Dynamic Yield 2.66%, Shopify vertical figures |
| B2B SaaS | 0.7% / 1.1% / 2.5% | 10% / 14% / 22% | FPS 1.1%; FPS organic 13.7%, ChatGPT 21.3% |

### Gaps
- No lead→customer benchmark found for dental, aesthetic clinics, legal or restaurants from a primary dataset. Those rows lean on Invoca's phone-conversion rate and First Page Sage's cross-industry rate.
- Unbounce, HubSpot and CallRail benchmark reports were not found or opened in this session.
- Ruler Analytics' current by-industry conversion rates were not retrieved, only the phone share.
- WordStream's own 2026 blog returned 403; the table comes from the LocaliQ copy of the same report.
- No restaurant visit→booking or visit→order benchmark other than the paid-search rate.

---

## 6. Default order values, first-year values and lifetime values by industry

### Takeaway
I found no primary-source dataset for customer value by industry; every figure below is from a vendor blog with unstated methodology, so these should be shown as editable placeholders, not benchmarks.

### Cited Findings
- Med spa (SECONDARY; vendor): ~$425 average transaction per visit; ~$8,700 lifetime value for a retained client over three years. — [SchedulingKit](https://schedulingkit.com/statistics/med-spa-statistics)
- Med spa (SECONDARY; vendor): $2,800–$8,400 over a 2–3 year lifespan. — [Adwave](https://adwave.com/resources/customer-lifetime-value-small-business)
- Dental (SECONDARY; vendor): $2,000–$6,000 per patient, from ~$200 per visit over 5–10 years; another guide gives $2,000–$8,400. — [Adwave](https://adwave.com/resources/customer-lifetime-value-small-business); [Session](https://session.care/playbooks/customer-lifetime-value)
- HVAC (SECONDARY; vendor): $15,340 per residential customer over 7–10 years; $1,200–$3,500 for service-only customers; ~$47,200 for maintenance-plan customers. The top figure looks inflated and comes from a lead-generation vendor. — [PipelineOn](https://pipelineon.com/blog/hvac-customer-lifetime-value/)
- Customer acquisition cost for context (SECONDARY): home services (HVAC/plumbing) $300–$700; law firms $900–$1,200. — [Your Growth Partner](https://yourgrowthpartner.io/blog/customer-acquisition-cost-benchmarks/)
- E-commerce order value (SECONDARY): IRP Commerce June 2026 average order value $170.90; median by category ~$48 food and beverage, ~$58 beauty, ~$85 fashion, ~$285 luxury; DTC Shopify median $85–$95. — [Speed Commerce](https://www.speedcommerce.com/insights/ecommerce-benchmarks-conversion-rates-by-industry-over-by-year/); [knowledgelib](https://knowledgelib.io/business/industry-benchmarks/ecommerce-industry-benchmarks-2026/2026); [Daymark](https://www.usedaymark.io/blog/what-is-a-good-conversion-rate)
- Cost per lead as a floor on what a lead is worth to advertisers (PRIMARY; LocaliQ 2026): legal $131.63, home improvement $90.92, dental $72.97, physicians $40.04, beauty $39.25, restaurants $30.57, business services $93.69. — [LocaliQ](https://localiq.com/blog/search-advertising-benchmarks/)
- Cross-industry (SECONDARY): median lifetime-value-to-acquisition-cost ratio ~3.4, top quartile ~5.6; revenue-based and margin-based lifetime value differ by 2–3x. — [Digital Applied](https://www.digitalapplied.com/blog/customer-lifetime-value-benchmarks-2026-industry-data)
- Kaiser and Schulze (SECONDARY): average order values from ChatGPT referrals declined over the study period, so do not assume AI-referred orders are larger. — [INFORMS](https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489)

### Inferences
- Placeholder defaults (first-year value / lifetime value), to be overridden by the business: dental $600 / $4,000; med spa $1,200 / $5,000; HVAC or plumbing $500 / $2,500 (service-only range; ignore the $15k claim unless the business sells installs and plans); e-commerce $90 per order (range $50–$170). First-year figures are my rough division of the cited lifetime ranges, not published numbers.
- A market-priced alternative that IS sourced: value each lead at the LocaliQ cost per lead for the category (what businesses already pay Google for an equivalent lead). This avoids needing customer value at all and is the most defensible default.

### Gaps
- No usable figure found for: legal case value, plumbing, restaurants (average ticket or visit frequency), B2B SaaS contract value, or first-year value in any category.
- No primary source (trade association survey, public filing, large platform dataset) was found for any category.
- Margin versus revenue basis is unstated in every source.

---

## 7. How does position or prominence of a mention change clicks or contacts?

### Takeaway
No study measures click or contact rate by position within an AI answer (first named, one of several, cited as source only). The only prominence evidence is indirect: being cited in a Google AI Overview roughly doubles organic clicks versus not being cited, and ChatGPT's May 2026 change that made brand links more visible produced a large jump in referrals.

### Cited Findings
- Seer Interactive (PRIMARY; 53 brands, 2025): on informational queries with an AI Overview, cited brands had 2.07% organic CTR vs 0.94% for brands not cited (about 2.2x; ~1.3x after removing one outlier account). For paid ads: 15.74% cited vs 11.19% not cited. — [Seer Interactive](https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update)
- Similarweb (PRIMARY): a ChatGPT linking update on 7 May 2026 coincided with a 36% month-over-month rise in AI referrals to Marketplaces. — [Similarweb](https://aisearch.similarweb.com/blog/ai-referral-traffic-by-industry/)
- Similarweb (SECONDARY; exact source page not confirmed): after the May 2026 change, ChatGPT referrals rose roughly 150–158% week over week and about 60% of that traffic landed on brand homepages. — [SEO Francisco](https://seofrancisco.com/insights/chatgpt-referral-traffic-clicky-future/)
- Pew (PRIMARY): 88% of Google AI summaries cited three or more sources and the combined click rate on all of them was 1% of visits, so each individual cited source receives a fraction of 1%. — [Pew Research](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/)
- AirOps (SECONDARY; 16,851 queries): this is about getting cited, not clicked: pages ranking first in the underlying search were cited by ChatGPT 58.4% of the time vs 14.2% for position 10. — [Search Engine Land](https://searchengineland.com/chatgpt-citations-ranking-precision-length-study-474538)
- Similarweb downstream study (SECONDARY): being the recommended brand (versus a head-to-head rival) is associated with 2.5x the likelihood of a visit within 7 days. — [SEO Handbook](https://seohandbook.co.uk/seo-news-updates/similarweb-ai-visibility-downstream-impact/)

### Inferences
- If a position weighting is needed, it has to be an assumption. A defensible stand-in is to split the answer's total click rate across named businesses with a classic search-style decay (first named gets the largest share), and to treat "cited as a source but not named" as worth clicks only, with no branded-search effect. Label this as an assumption in the product.
- "Linked brand name" versus "named without a link" probably matters more than order: only ~7% of ChatGPT conversations contain links, and the May 2026 link change moved referral volume sharply.

### Gaps
- No published data on click or contact rate by mention position in ChatGPT, Gemini, Perplexity, Claude or Grok answers.
- No data on single recommendation versus list of five.
- The 150–158% week-over-week figure was not traced to the original Similarweb page.

---

## 8. Phone calls, map taps and bookings for local businesses

### Takeaway
No study measures calls, map taps or bookings that originate from an AI answer. The nearest usable benchmarks are Google Business Profile action rates (calls roughly 1.5–8% of profile views, directions 3–8%, website clicks 4–7%) and Invoca's finding that about 42–46% of phone leads convert on the call.

### Cited Findings
- SmartSites (SECONDARY; 1,882 locations, 2026): a median Google Business Profile gets about 637 views, 51 direction requests, 35 website clicks and 11 calls per month, which works out to 8.0% directions, 5.5% website clicks and 1.7% calls per view. — [SmartSites](https://www.smartsites.com/blog/seo-benchmarks-1160-websites/)
- WebFX (SECONDARY; 2026, vendor, methodology not seen): typical rates per profile viewer are 4–7% website clicks, 5–8% calls, 3–5% direction requests; service businesses can reach 10–15% click-to-call. — [WebFX](https://www.webfx.com/blog/seo/google-business-profile-benchmarks/)
- BrightLocal 2026 as cited by Searchlab (SECONDARY): average profile gets 20 website clicks, 16 direction requests and 10 calls per month. — [Searchlab](https://searchlab.nl/en/statistics/google-business-profile-statistics-2026)
- Birdeye 2026 (SECONDARY; vendor): share of profile actions: website visits ~47%, direction requests ~38%, calls ~15%. — [Birdeye](https://birdeye.com/blog/state-of-google-business-profiles/)
- These sources conflict on the call rate (1.7% of views at SmartSites vs 5–8% at WebFX); likely different mixes of business types and different definitions of a "view".
- GMBapi Q2 2026 (SECONDARY): US profile calls down 11.9% and website clicks down 12.5% year over year, direction requests up 21.1%. — [Trulove Webworks](https://trulovewebworks.com/google-business-profile-clicks-down-local-seo/)
- Invoca 2026 (SECONDARY; 70M+ calls): 42% of phone leads convert on the call; home services 45%, healthcare 45%. 2025 edition: 61% of callers reach a person. — [Invoca](https://www.invoca.com/blog/lead-conversion-rate-benchmarks); [Supply House Times](https://www.supplyht.com/articles/106612-home-services-call-performance-report-46-lead-conversion-rate-segment-benchmarks)
- Ruler Analytics 2026 (SECONDARY): 56% of legal and 53% of professional-services conversions happen by phone. — [Ruler Analytics](https://www.ruleranalytics.com/blog/insight/conversion-rate-by-industry/)
- LocaliQ (PRIMARY): its lead definition already bundles calls, chats, forms and emails, so the click→lead rates in section 5 include phone leads. — [LocaliQ](https://localiq.com/blog/search-advertising-benchmarks/)
- Seer (PRIMARY): Google AI Overviews appeared on 76.9% of "near me" queries in its set, so local intent is heavily exposed to AI answers. — [Seer Interactive](https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update)

### Inferences
- For local businesses, model an off-site contact path alongside website clicks: of people who see the business named with a phone number or address, assume a direct action rate (call, directions or booking) of low 1%, mid 3%, high 8%, borrowed from Google Business Profile action rates per view. This is a proxy: a profile view is a person already looking at that one business, which is closer to a single-business AI recommendation than to a list of five.
- Split of local actions if needed: roughly 45% website, 35–40% directions, 15–20% calls (Birdeye; SmartSites gives 36% / 53% / 11%).
- Apply Invoca's 42–46% to calls to get customers or booked jobs, discounted by the ~61% answer rate if using raw call counts.
- Lead mix default for legal and professional services: over half of leads by phone (Ruler).

### Gaps
- No data on calls, directions or bookings triggered directly from ChatGPT, Gemini, Perplexity or Google AI Mode answers.
- No data on how often AI answers include a phone number, address or booking link for local queries.
- CallRail benchmarks were not found.
- No booking-platform data (for example dental or med spa online booking rates) found.
