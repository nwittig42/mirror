# SaaS / online-brand practitioner rules for getting recommended by AI assistants (2025-2026)

Scope: what SaaS and online-brand practitioners teach about getting an online product (SaaS tool, student career app, etc.) recommended by ChatGPT, Google AI Overviews/AI Mode, Gemini, Perplexity, Claude, Copilot, and Grok. The goal is "IF [audit condition] THEN [task]" rules, each with a source and an evidence grade.

Evidence grades used below:
- **A**: large primary dataset with a stated method (more than 10k brands, prompts or citations), published by the researcher.
- **B**: practitioner dataset with a partial method, or a single named case study.
- **C**: practitioner opinion or playbook without data, or a vendor guide.
- **D**: secondary or aggregator claim I could not trace to a primary source.

Self-promotion flag: almost every source sells AI-visibility tools or services (Profound, Ahrefs Brand Radar, Peec, Graphite, Foundation, AirOps, MADX, TripleDart, Seer). Each study's conclusions tend to point toward the vendor's product.

---

## Q1. What page templates and rules do practitioners give for pages that get cited (comparison, alternatives, pricing, use-case, integration, docs)?

### Takeaway
"Best X" listicles and comparison pages are the most-cited page types. Owned pages that get cited are the homepage, landing/product pages, and a set of six "bottom-funnel" templates: product, solution/use-case, comparison, alternative, industry, and segment. Those pages need to be fresh, served as plain HTML, indexed by Bing, and answer-first. One caution from conversion data: "vs" pages and listicles drive citations and research visits, but they rarely produce last-click leads. The homepage converts most.

### Cited Findings
- **Comparative listicles are the top cited format.** Profound's data put them at about 32.5% of AI citations, versus blogs/opinion about 9.9%, commercial/store pages about 4.7%, and forums about 3.4%. That analysis covers about 177M sources, plus an industry study of more than 50k prompts. Grade A-/B (vendor deck, partial method). — [Josh Blyskal, Profound, BrightonSEO deck, Apr 2025](https://speakerdeck.com/joshbly/josh-blyskal-profound-we-analyed-10000-000-ai-search-results-dot-dot-dot)
- **"Best X" lists made up 43.8% of all ChatGPT source page types** across 750 top-of-funnel prompts (software, products, agencies). Grade A. — [Glen Allsopp, Ahrefs, Dec 4 2025](https://ahrefs.com/blog/best-lists-research/)
  - Being ranked higher in a list correlated with being recommended more. The cause isn't settled, because shorter lists bias the result.
  - 79.1% of cited lists had been updated in 2025, 26% within the past two months, and 57.1% had been updated since publication.
  - 35% of cited best lists sat on low-authority domains, many of them "questionable".
  - In software, when a publisher was recommended, that publisher's own list appeared in more than a third of those ChatGPT responses. Separately, 67.6% (169/250) of Google "best X software" results featured a list that ranked the publisher first.
  - For software and agencies, landing pages were the most common first-party citation.
- **Ahrefs' rules for self-promotional lists:**
  - Publish them selectively. Ahrefs itself keeps them under 0.5% of its blog, focused on new features or markets.
  - Write about your own product openly, not in a fake third person.
  - Link to the alternatives.
  - Ranking yourself #1 isn't required. One cited company placed itself #7.
  - Refresh lists regularly.
  - Keep landing pages current.
  - Mention awards and analyst recognition.
  - Grade C (opinion built on A data). — [Ahrefs](https://ahrefs.com/blog/best-lists-research/)
- **Self-promotional listicles take about 11% of citations across 232k citations.** ChatGPT cites them least (about 4%), Google AI Mode and Perplexity about 10-11%. Peec found no evidence of algorithmic correction over time. Grade A- (vendor). — [Peec AI research](https://docs.peec.ai/research/self-promotional-listicles); summarized via [Peec blog](https://peec.ai/blog/self-promotional-listicles-analysis-from-232k-citations)
  - **Conflict:** Texta claims self-promo listicles get "65% fewer citations" than neutral third-party content, but its own posts contradict each other. Grade D. — [Texta](https://texta.ai/blog/self-promotional-listicles-analysis-232k-citations)
  - **Freshness caveat:** Peec's docs (as relayed by search results, not fetched) say GPT-5.6 (Aug 2026) shifted ChatGPT retrieval share from listicles toward brand product pages. Listicle shares measured before Aug 2026 may overstate today's ChatGPT. Grade D (not verified). — [Peec docs](https://docs.peec.ai/research/content-types-cited-most-by-engine)
  - **Self-promo can backfire.** Ahrefs ran an experiment titled "Self-Promotional Content Works—Until It Backfires" (Mateusz Makosiewicz, Jul 6 2026), but I could not retrieve its body. — [Ahrefs](https://ahrefs.com/blog/?p=200190)
- **Ross Simmonds' six owned page types are product, solution, comparison, alternative, industry, and segment.** His rules:
  - Keep **alternative pages separate from comparison pages**, because people searching for alternatives may not know the obvious substitute.
  - Build solution pages per use case or team (Asana's marketing and finance pages are his example).
  - Comparison pages are a "quick win".
  - Coined category language wins long, specific prompts.
  - Publishing velocity correlates with citation rate (sample size not given).
  - Source: Foundation + AirOps research covering 380k+ answers, 3M+ citations, 80+ B2B categories, 6 surfaces. Grade B (method partially stated; rules are opinion). — [AirOps, Ross Simmonds, Oct 9 2026](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)
- **Ross Simmonds: write content for your integration partners,** because many of them lack writers. Also publish content about known product gaps and issue a press release when each one is fixed. Grade C. — [AirOps](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)
- **Ethan Smith (Graphite): landing pages, YouTube videos, and Reddit comments are "the three tactics that work".** He calls help-center content possibly the highest-ROI investment, because it covers long, multi-constraint prompts. His example: "Which meeting transcription tool integrates with Looker via Zapier to BigQuery?" AI prompts average 25+ words versus about 6 in Google. Grade C (podcast claims; the full 7-step playbook is paywalled). — [Graphite summary](https://graphite.io/five-percent/the-ultimate-guide-to-aeo-on-lennys-podcast); [Lenny's Podcast, Sep 14 2025](https://www.lennysnewsletter.com/p/the-ultimate-guide-to-aeo-ethan-smith)
- **Josh Blyskal's technical page rules:**
  - Use semantic, descriptive URL slugs.
  - Put the core answer in the meta description.
  - Make sure the page is **indexed by Bing**, because ChatGPT browsing relies on Bing. Unindexed pages don't appear.
  - Serve key content without JavaScript, because AI crawlers don't execute JS.
  - Publish and update often, because engines cite new content "within days".
  - Only about 12% of ChatGPT results overlap with the Google SERP and 26% with Bing. Traffic explains about 5% of citations (r² 0.05) and backlinks about 3.8%.
  - Grade B. — [Blyskal deck](https://speakerdeck.com/joshbly/josh-blyskal-profound-we-analyed-10000-000-ai-search-results-dot-dot-dot)
- **Conversion reality, from TripleDart's Q1 2026 study:** 28 B2B SaaS clients, 65,583 LLM sessions, 11,513 URLs, 82 leads, last-click attribution.
  - The homepage took 31.9% of LLM sessions and 81.7% of measurable leads (0.32% CVR).
  - "Vs" comparison posts: 1,027 sessions, 0 leads. Listicles: 4,831 sessions, 0.04% CVR. Generic blog: 12,135 sessions, 0 leads.
  - Competitor-pricing blog posts converted at 1.50% and long-form deep-dives at 1.47%, but mostly from one client each.
  - The standalone pricing page shows 0 leads in one table and 5.56% (2 of 36 sessions) in another. The study doesn't reconcile the two.
  - Its homepage rule: an H1 that names the product, a one-sentence value proposition, a CTA above the fold, and a machine-extractable summary within the first 200 words.
  - Grade B (agency's own clients; strict last-click undercounts influence). — [TripleDart](https://www.tripledart.com/research/which-pages-do-llms-cite)
- **LLM traffic converts about 6x better than Google traffic, per Webflow's experience** as relayed by Ethan Smith. Grade C (promotional; no data shown). — [Graphite](https://graphite.io/five-percent/the-ultimate-guide-to-aeo-on-lennys-podcast)

### Inferences (draft IF/THEN rules)
- **R1. Missing comparison and alternative pages.** IF an audit shows the brand has no "X vs Y" page for each of its top 3-5 competitors that AI names, and no "[competitor] alternatives" page, THEN:
  - Build one comparison page per competitor and one alternatives page per competitor, as separate pages (Simmonds).
  - Each page needs a one-paragraph verdict at the top, saying who should pick which.
  - Add a criteria table (price, key features, integrations, best-for), with dates.
  - Include honest "where [competitor] is better" sections and links out to the alternatives (Ahrefs transparency rule).
  - Use a descriptive slug like /vs/competitor (Blyskal).
  - Add a "last updated" date and refresh the page quarterly.
  - Grade B.
- **R2. Pages that crawlers can't read.** IF key pages render only through client-side JS, or the domain is missing from Bing, THEN:
  - Server-render the content.
  - Submit the site to Bing Webmaster Tools.
  - Check with a fetch that the HTML contains the copy without running JS.
  - Grade B.
- **R3. Long-tail questions have no answers on the site.** IF buyer prompts in the audit are long and multi-constraint, e.g. "best networking app for first-gen students targeting IB that integrates with LinkedIn", and no page on the site answers them, THEN:
  - Create help-center or docs articles and use-case pages, one per constraint combination: integration, audience segment, and job-to-be-done.
  - Grade C.
- **R4. Expect citations, not leads, from these pages.** IF a client expects leads from vs and listicle pages, THEN reset expectations: those pages buy citations and research visits, not leads. Route CTAs to the homepage or a trial, and track citations alongside sessions. Grade B.
- **R5. Weak homepage.** IF the homepage H1 doesn't name the product category, or there's no plain-language summary in the first 200 words, THEN rewrite it per TripleDart's homepage rule. Grade B.
- **R6. Unclear self-ranking.** IF the brand publishes a "best X" list that ranks itself #1 with no disclosure, THEN:
  - Rewrite it to state the brand's affiliation openly.
  - Include real competitors with links.
  - Keep these lists rare: Ahrefs keeps them under 0.5% of its content.
  - Grade C. **Ethics/risk:** Google is reportedly cracking down on self-promotional lists (vendor claim, unverified).

### Gaps
- No primary-source template from Bernard Huang (Clearscope), Siege Media, Animalz, Omniscient, Directive, or Grow and Convert turned up in this pass. Grow and Convert has no public LLM listicle case study that I found.
- No dataset isolates **pricing pages** (beyond TripleDart's conflicting numbers) or **integration and docs pages** specifically.
- I couldn't retrieve Ethan Smith's exact 7-step playbook (paywalled) or the body of Ahrefs' "backfires" experiment.

---

## Q2. How do practitioners find and win listicle placements and creator/YouTube mentions? Outreach templates?

### Takeaway
Find the lists AI already cites for your category prompts, keep only the ones that name your competitors and have a gap you fill, and pitch the author with something the editor can verify quickly. Fix unlinked mentions first. Practitioners advise against paying for placement. YouTube mentions have the single strongest correlation with AI visibility in Ahrefs' 75k-brand study.

### Cited Findings
- **MADX's listicle-placement process:**
  1. Prompt-test ChatGPT, Perplexity, and AI Overviews with your category's "best" questions, and record the cited articles.
  2. Keep only lists that (a) already rank or get cited, (b) name your direct competitors, and (c) have a real gap you fill, such as a use case or price tier.
  3. Re-check every 1-2 months.
  4. Do unlinked mentions first: ask the author to add a link. MADX calls this "the fastest win".
  5. Contact the author, content lead, or SEO owner, not a contact form.
  6. Pitch the reader benefit: name the gap, then give a one-line summary, pricing, and a screenshot or comparison row the editor can verify. Ask one yes/no question.
  7. Follow up once, after about a week. If the answer is no, ask what would make you a fit later.
  8. Review quarterly that your entry is still accurate.
  - Avoid asking to be ranked first.
  - Measure presence, position (top 2-3), and framing, judged over about a quarter.
  - Grade C (agency playbook, no outcome data). — [Perry Steward, MADX, Sep 2 2026](https://www.madx.digital/learn/get-featured-in-best-software-lists)
- **MADX on paid placement:** "models discount pay-to-play lists", and paid placements on low-authority pages "do little" and can "dent trust". Grade C (opinion, no data). — [MADX](https://www.madx.digital/learn/get-featured-in-best-software-lists)
- **Ahrefs on what earns inclusion on other people's lists:** shipping product improvements and publishing original research are the main drivers. Ahrefs also found 35% of cited lists sit on low-authority, questionable domains. Grade C on A data. — [Ahrefs](https://ahrefs.com/blog/best-lists-research/)
- **Vendor market for listicle placement:** tools like ListBrew and agencies offering outsourced placements (one claims "12 top listicles" for a client) exist. Seer Interactive and AirOps are cited for the claims that brands are "6.5x more likely to be cited via third-party sources" and that listicle inclusion is a key factor. These are secondhand, not verified. Grade D. — [search aggregation; e.g., Position Digital](https://www.position.digital/?p=15656)
- **YouTube mentions show the strongest correlation with AI visibility**: about 0.737 Spearman, and about 0.717 for view-weighted mention impressions. Branded web mentions came in at about 0.66-0.71. A "YouTube mention" means the brand name appears in a video's title, transcript, or description. Page count correlated at about 0.194. Source: 75k brands across ChatGPT, AI Mode, and AI Overviews, Dec 2025. Grade A (correlation, not causation, as Ahrefs says itself). — [Ahrefs](https://ahrefs.com/blog/ai-brand-visibility-correlations)
- **On Google AI surfaces, YouTube appears in 38-47% of answers and Reddit in 39-52%.** Claude cites no Reddit or YouTube. Grade B. — [Foundation/AirOps](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)
- **Ross Simmonds: link AI visibility to product marketing,** so that in-product moments trigger creator partnerships as well as NPS surveys and review requests. Grade C. — [AirOps](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)

### Inferences (draft IF/THEN rules)
- **R7. Absent from cited lists.** IF the audit shows AI cites 3+ "best X" lists for the category and the brand is absent from them, THEN:
  - Build a target sheet: URL, author, last-updated date, competitors named, the gap you fill, and whether the list is cited by which engine.
  - Pitch the top 10 with the MADX structure: gap, reader benefit, verifiable proof, one yes/no question, one follow-up.
  - Re-run the prompts 3-6 weeks after each placement.
  - Grade C.
- **R8. Unlinked mentions.** IF the brand is mentioned on a cited list with no link, or with stale pricing, THEN email the author a correction or link request first. Grade C.
- **R9. Paid placement offers.** IF a list owner asks for payment or affiliate terms, THEN:
  - Treat it as advertising. The FTC endorsement rules require disclosure of material connections (practitioner-implied; not sourced here).
  - Prefer lists with editorial standards.
  - Don't buy placements on low-authority pages.
  - Grade C. **Flag:** this is a pay-to-play/ToS ethics risk.
- **R10. No YouTube presence.** IF the brand has under ~5 YouTube videos mentioning it by name (in title, description, or transcript) for category queries, THEN:
  - (a) Publish demo and tutorial videos that say the brand and category aloud and in the title.
  - (b) Send product access to niche creators who review "best [category] tools". For a student app, that means career-advice and college-productivity creators.
  - Grade B (correlation only).

### Gaps
- No verbatim outreach email template from a named practitioner was found. MADX gives a structure, not a template.
- No data was found on whether AI systems detect or discount paid or affiliate listicles. The MADX claim is unsupported.
- I found no specific creator-outreach playbook from Dave Gerhardt, Chris Walker, or Peep Laja tied to AI visibility.

---

## Q3. What Reddit rules do practitioners give (disclosure, subreddits, answering threads AI cites)?

### Takeaway
Use one real, named account, say who you work for, write genuinely helpful answers in the threads AI already cites, and never use fake accounts, automation, or vote manipulation. Reddit's citation share is volatile: ChatGPT cut Reddit sharply in late 2025, and Claude cites none. So weigh Reddit effort by which engine and surface matter.

### Cited Findings
- **Ethan Smith's Reddit rules:** create one real account, state who you are and where you work, and give genuinely helpful answers. "Five good comments" can meaningfully raise visibility. Avoid automation and fake accounts, because ChatGPT trusts Reddit precisely because the community polices spam. Grade C. — [Graphite](https://graphite.io/five-percent/the-ultimate-guide-to-aeo-on-lennys-podcast)
- **Reddit's share of ChatGPT answers fell from 1 in 5 to 1 in 30 within three weeks.** Claude cites no Reddit, which Simmonds links to Reddit's lawsuit against Anthropic. Google licensed Reddit content in 2024. In some categories (managed databases, CI tools) Reddit outranks review sites, so match tactics to your category's citation mix. Grade B. — [Foundation/AirOps](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)
  - **Supporting coverage:** ChatGPT "drastically cut" Reddit citations in Sept 2025, and Semrush had earlier reported Reddit at 40.1% of LLM citations in mid-2025. Grade D (secondary). — [The Drum](https://www.thedrum.com/news/did-the-brand-rush-to-reddit-kill-the-platform-s-chatgpt-citations)
- **Simmonds/AirOps course playbook:** create a subreddit tied to the brand or industry, run Reddit ads to grow it, and engage regularly. A larger subreddit signals authority. Grade C. — [AirOps University](https://university.airops.com/courses/the-cited-framework/engineer-your-brand-into-llm-memory)
- **Community norms, as relayed by Reddit-marketing guides:**
  - Disclose affiliation. Non-disclosure is treated as deception, and users check post histories.
  - The self-promotion ratio heuristic is 9:1 or 10:1, depending on the guide. It isn't a hard rule.
  - Subreddit rules are stricter than sitewide rules, and mod bans can be permanent.
  - Buying upvotes, asking for votes, using alt accounts, and rapid identical cross-posting all lead to bans.
  - Grade D (third-party guides, not Reddit's own text). — [Redship](https://redship.io/learn/how-to-avoid-getting-banned-marketing-reddit); [Something Inc](https://somethinginc.com/blog/reddit-marketing-without-getting-banned/)

### Inferences (draft IF/THEN rules)
- **R11. Reddit threads are cited and the brand is absent.** IF the audit shows Reddit threads cited by Google AI Overviews/AI Mode or Perplexity for buyer prompts, and the brand is absent or misdescribed in them, THEN:
  - A named team member, with their affiliation in their profile and stated in the comment, answers the question fully, including competitors, and mentions the product only where it fits.
  - Read each subreddit's rules first.
  - Keep a ratio of 9+ non-promotional contributions per brand mention.
  - Never use alt accounts or upvote requests.
  - Grade C. **ToS risk:** undisclosed or sockpuppet posting violates Reddit rules and draws permanent bans.
- **R12. The engine that matters rarely cites Reddit.** IF the target engine is ChatGPT or Claude and Reddit rarely appears in their citations for the category, THEN deprioritize Reddit relative to review sites and listicles. Grade B.

### Gaps
- I didn't retrieve Reddit's official self-promotion policy text from reddithelp.com, so the policy specifics above are secondhand.
- There's no data on whether old, well-upvoted comments outperform new ones, or on the lag between a comment and an AI citation.

---

## Q4. How do practitioners handle the fact that ChatGPT often answers from memory (training data)? What long-term brand-mention tactics do they use?

### Takeaway
The best-evidenced long-term lever is broad off-site brand presence: branded web mentions, YouTube mentions, and review volume. Backlinks, traffic, and page count are weak predictors. Mentions from top news sites alone showed almost no correlation with ChatGPT's memory-based mentions in Seer's test, so PR only helps when it places the brand in the specific sources models read.

### Cited Findings
- **Off-site factors correlate most strongly with AI Overview mentions,** per Ahrefs' study of about 75k brands (DR>40): branded web mentions 0.664, branded anchors 0.527, branded search volume 0.392. All factors were "moderate to very weak" on the Spearman scale. Grade A. — [Ahrefs AI Overview study](https://ahrefs.com/blog/ai-overview-brand-correlation/)
- **For ChatGPT specifically, classic authority metrics were weaker:** branded search 0.352 and DR 0.266, while YouTube mentions came in at about 0.737. Grade A (correlation). — [Ahrefs](https://ahrefs.com/blog/ai-brand-visibility-correlations)
- **Seer Interactive tested news mentions against memory.** It compared presence on 8 news sites with ChatGPT API mentions from training data and found a correlation of about 0.07. Business Insider was about 0.12, possibly reflecting its OpenAI partnership. Partner sites averaged 0.09 versus 0.02 for others. Organic rankings correlated more. Seer also relays that about 46% of queries trigger search, and over 87% of SearchGPT citations match Bing's top results (secondhand). Grade B (small, method thin, Mar 2025). — [Nick Haigler, Seer, Mar 3 2025](https://www.seerinteractive.com/insights/does-being-mentioned-on-top-news-sites-impact-ai-answer-mentions)
- **Ross Simmonds on PR:** pitch stories to the publications LLMs already cite, then verify that answers use them. Brand-owned URLs are cited far less than third-party content. Grade B/C. — [AirOps](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)
- **Review sites take over 15% of citations in ChatGPT, Perplexity, and Claude,** and matter most for "what is the best" prompts.
  - G2 cited in 20% (Claude), 19% (Perplexity), and 15% (ChatGPT); Capterra 15%; TrustRadius 10%.
  - Rules:
    - Ask for a G2 or Capterra review right after a high NPS score on a key product action.
    - Collect reviews year-round, because LLMs weigh both count and recency.
    - Give one owner responsibility across G2, Capterra, and TrustRadius, and report volume and recency monthly.
    - Dilute a single negative source by scaling reviews.
  - Grade B. — [Foundation/AirOps](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)
- **Semrush and Kevin Indig: only 15.2% of 1,094 US categories had a clear brand "owner" in ChatGPT** (Jan-Jun 2026, 50k brands). This suggests most categories are still open. Grade D (relayed by AirOps glossary; primary not fetched). — [AirOps glossary](https://www.airops.com/glossary/llm-visibility)
- **Wikipedia and Wikidata:**
  - Notability needs "significant coverage in reliable sources that are independent of the subject". Funding news, press releases, arranged interviews, and directory listings don't count.
  - Self-editing violates Wikipedia's conflict-of-interest (COI) policy and gets reverted.
  - Wikidata needs independent public references.
  - Fixing a wrong Wikidata fact may matter more than chasing a Wikipedia article.
  - Grade C (PR-vendor guides restating Wikipedia policy). — [MaxAEO](https://maxaeo.ai/blog/?p=792); [Frontline Source Group](https://www.frontlinesourcegroup.com/blog-frontline-source-group-wikidata-ai-search.html)
  - **Unverified claim:** the "Wikipedia = 47.9% of ChatGPT top sources" figure keeps getting repeated without a primary source. Grade D. Blyskal's deck does say ChatGPT leans toward Wikipedia. — [Blyskal](https://speakerdeck.com/joshbly/josh-blyskal-profound-we-analyed-10000-000-ai-search-results-dot-dot-dot)
- **Early-stage brands can win fast** because a mention in a relevant thread can surface in ChatGPT quickly, unlike SEO domain authority. Grade C. — [Graphite](https://graphite.io/five-percent/the-ultimate-guide-to-aeo-on-lennys-podcast)

### Inferences (draft IF/THEN rules)
- **R13. Few branded mentions.** IF branded web mentions on third-party sites are low relative to the competitors AI names, THEN run a 6-12 month mention program aimed at the sources the engines actually cite (from the audit's citation list):
  - Guest data posts.
  - Podcast guesting.
  - Original research that others quote.
  - Integration-partner content.
  - Track the count monthly.
  - Grade A for the correlation, C for the tactic.
- **R14. Thin review profile.** IF the brand has fewer than ~20 recent reviews on G2/Capterra (B2B), or on the App Store/Trustpilot (B2C) where those are cited, THEN set up an in-product review ask triggered by a high NPS score or a success moment, and report review volume and recency monthly. Grade B. **ToS:** G2 and app stores prohibit incentivized or fake reviews without disclosure (not sourced here; check each platform's policy).
- **R15. A negative source gets cited.** IF a negative or competitor page is cited about the brand, THEN:
  - Scale positive third-party content and reviews to dilute it.
  - Publish an honest page about the gap.
  - Issue a press release when the gap is fixed.
  - Grade C.
- **R16. No Wikidata item, or a wrong one.** IF the brand lacks a Wikidata item or it holds wrong facts, and independent coverage exists, THEN fix or create the item with independent references. Don't create or edit a Wikipedia article yourself. Disclose COI on talk pages. Grade C.
- **R17. PR program in place but not cited.** IF a PR plan targets generic top-tier news, THEN redirect it to the publications that appear in the brand's own audit citations. Seer's data shows generic news presence barely moves ChatGPT mentions. Grade B.

### Gaps
- I couldn't retrieve Kevin Indig's own Growth Memo analysis of training data versus retrieval.
- No study quantifies how long it takes for new mentions to enter ChatGPT's parametric memory. The Seer data is based on a 2023 cutoff.
- Nothing specific turned up for LinkedIn, podcasts, Product Hunt, Trustpilot, app-store profiles, or Grok/Copilot. Blyskal notes Copilot leans heavily on Forbes.
- I found no first-party evidence from Chris Walker, Dave Gerhardt, or Peep Laja on founder-led content and AI visibility.

---

## Q5. What do practitioners call myths?

### Takeaway
The best-supported myths are: llms.txt helps AI citations; backlinks, traffic, and page count drive AI visibility; any news coverage feeds ChatGPT; and AI-generated mass content or fake Reddit accounts work. Practitioners disagree about llms.txt and about whether GEO is distinct from SEO.

### Cited Findings
- **llms.txt:**
  - SE Ranking's study of about 300k domains found no measurable effect on citations. Removing the variable even improved its XGBoost model. Only 10.13% of domains have the file. Grade A. — [Search Engine Journal on SE Ranking](https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/); [SE Ranking](https://seranking.com/blog/llms-txt/)
  - Google says llms.txt neither helps nor harms Search. As relayed, John Mueller said "AFAIK none of the AI services have said they're using llms.txt". Grade C (quote not verified at primary). — [MaxAEO](https://maxaeo.ai/blog/does-llms-txt-work/)
  - **Contradiction:** Blyskal's Apr 2025 Profound deck recommended adopting llms.txt. — [Blyskal](https://speakerdeck.com/joshbly/josh-blyskal-profound-we-analyed-10000-000-ai-search-results-dot-dot-dot)
- **"Backlinks and traffic drive AI citations":** traffic explains about 5% of citations and backlinks about 3.8% (Profound), and page count correlates at about 0.194 (Ahrefs). Grade A/B. — [Blyskal](https://speakerdeck.com/joshbly/josh-blyskal-profound-we-analyed-10000-000-ai-search-results-dot-dot-dot); [Ahrefs](https://ahrefs.com/blog/ai-brand-visibility-correlations)
- **"Ranking #1 is what matters":** Ethan Smith says "Being mentioned most often beats ranking first." Grade C. — [Graphite](https://graphite.io/five-percent/the-ultimate-guide-to-aeo-on-lennys-podcast)
- **"AI-generated content works":** Smith says it doesn't. That claim appears in the show notes, without detail. Grade C. — [Lenny's](https://www.lennysnewsletter.com/p/the-ultimate-guide-to-aeo-ethan-smith)
- **"GEO is a new discipline":** Eli Schwartz frames AEO as "just SEO wearing a new hat", and says good marketing is good GEO. Grade C (from a show description). — [Lenny's: Eli Schwartz](https://www.lennysnewsletter.com/p/rethinking-seo-in-the-age-of-ai-eli-schwartz). Simmonds' data that Google surfaces and assistants cite very different sources argues for treating them separately. — [AirOps](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)
- **"Citations equal truthful support":** a Nature Communications study (relayed) found 50-90% of LLM citations don't fully support their claims. Grade D (secondary). — [via search aggregation, AirOps/Topify](https://topify.ai/blog/llm-citation-ai-picks-sources-2)

### Inferences (draft IF/THEN rules)
- **R18. Client asks for llms.txt or backlinks.** IF a client asks for llms.txt or link-building as the main AI fix, THEN say it's low-priority. llms.txt is cheap to add but unproven. Put the effort into third-party mentions, list placements, reviews, and crawlable, fresh bottom-funnel pages. Grade A.
- **R19. Plan to mass-produce content.** IF a plan relies on mass AI-generated pages, THEN reject it. Page count barely correlates with visibility, and practitioners call AI-generated content ineffective. Grade B/C.

### Gaps
- I didn't find explicit myth lists from Kevin Indig, Tim Soulo, Bernard Huang, or Superlines. I also couldn't verify Eli Schwartz's position on llms.txt.
- I didn't verify whether schema or FAQ markup affects AI citations in this pass.
