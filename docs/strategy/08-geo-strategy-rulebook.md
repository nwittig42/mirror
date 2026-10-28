# Doc 8: The GEO Strategy Rulebook
*How the product picks each business's to-do list from its audit data. Internal. Replaces the hard-coded action list in `src/report/build-report.ts` and the static `plan90`.*

Research inputs: `research_notes/GEO strategy rules from practitioners/*`, `research_notes/GEO strategy playbooks/*`, `reports/GEO strategy playbooks.md`. Audit ground truth: `research_notes/GEO strategy rules from practitioners/audit_inventory.md` (2026-10-14).

---

## 1. How to read this

**What this is.** A list of rules. Each rule says: "if the scan shows *this*, put *this task* on the business's Strategy page." The rules choose the tasks. An AI then writes the business-specific parts: the exact paragraph to add, the outreach email, the page outline. The rules never invent a task the data doesn't support.

**The Strategy page has three sections, in this order:**
1. **Fix first**: things that block every other task (AI can't read the site), or wrong facts that cost money right now (says you're closed, wrong phone number, a false lawsuit).
2. **Fix wrong facts**: everything else AI gets wrong about the business.
3. **Get recommended more**: the work that gets the business named in more answers.

**Task life cycle.** The list is rebuilt after every scan. New tasks appear. A task the scan shows is solved closes by itself. Ticked tasks stay ticked. Statuses: **To do → In progress → Done (waiting for re-check) → Confirmed.**

**Evidence grades** (used on every rule):

| Grade | Meaning |
|---|---|
| **A** | Large primary dataset (10k+ brands/locations, 1M+ citations), a controlled test, or official engine documentation |
| **B** | Smaller study, a single named case study, or a structured expert survey (e.g. Whitespark's 47 experts) |
| **C** | One practitioner's or agency's opinion or playbook, without data |
| **D** | Unverified or second-hand only. **No rule in this book fires on D evidence alone.** |

**Every number is from a vendor that sells GEO, SEO or listings tools unless marked (non-vendor).** Almost all of it is correlation, not cause. No tactic here has an independent before/after study on live engines ([playbooks report](../../reports/GEO%20strategy%20playbooks.md)). So we sell re-measurement, not rankings.

---

## 2. Rule format and shared terms

Every rule has exactly these fields:

| Field | What it holds |
|---|---|
| **ID** | Section letter + number (B1, F3, P2, S4, L5, O3, M1) |
| **Applies to** | `local`, `online` or `both` |
| **Trigger** | The exact condition, in real audit fields. `[Today]` = works on data we collect now. `[Today, approx.]` = works now with a heuristic; a gap makes it exact. `NEEDS: gap #n` = can't fire until that gap is closed (Section 8). |
| **Title** | Template with `{placeholders}` filled from scan data |
| **Steps** | Numbered steps an owner can follow |
| **AI writes** | What the wording AI generates for this task |
| **Priority** | What raises or lowers it (feeds the formula in Section 4) |
| **Done when / re-check** | What the next scan must show to auto-close; when to look |
| **Evidence** | Grade + sources |

### Shared terms used in triggers

All field names are from `audit_inventory.md`.

| Term | Definition |
|---|---|
| **buyer run** | A `checks` row with `prompt_kind != 'branded'` |
| **namesake run** | A `checks` row whose `tone_reason` starts with `"Different business:"` (the scan's namesake veto) |
| **cell** | One (`prompt_id`, `engine`) pair. Each cell has 3 runs. |
| **lost cell** | A buyer cell where, in ≥2 of 3 runs, `mentioned=false`, `named_order` is non-empty, and the run is not a namesake run. A single run never counts: lists repeat <1% of the time ([SparkToro via SEL](https://searchengineland.com/ai-recommendation-lists-rarely-repeat-study-468076)), and repeat-run overlap is only 20-33% ([BrightLocal](https://www.brightlocal.com/research/local-ai-visibility-study/)) |
| **rivals(cell)** | Competitors in `named_order` across the lost runs of a cell |
| **own domain** | Domain of `practices.website` |
| **lost URL set** | All `citations` from lost cells, de-duplicated. Weight per URL = distinct prompts × distinct engines citing it |
| **memory run** | A run on `openai`, `anthropic`, `gemini` or `grok` with empty `search_queries` and empty `citations` (proxy for "answered without searching"; exact once gap 8 is closed) |
| **open finding** | `findings` row with `status='open'` and `lastSeenScanId` = this scan. Its `citations` come from its one representative check (gap 9) |
| **fact category** | `facts.category` ∈ identity, providers, services, not_offered, pricing, logistics, compliance |
| **site** | `scans.websiteCheck`: `checks[id].status`, `pages[]` (url, title; ≤8 pages), `homepageText` (8k chars) |
| **addedWords** | Search report words AI added to its searches ("price", "reviews", "2026", "vs") |
| **market** | `local` or `online`. Until gap 11 is closed: `forecast.businessType` ∈ {home_services, clinic, legal} → local; {b2b_software, freemium, ecommerce} → online; `other` → operator must set it before L/O rules fire |
| **page type (today)** | URL heuristic until gaps 1-2 are closed. **listicle**: path matches `/(best|top)[-_/]|\d+-best|-vs-|alternatives/`. **thread**: `reddit.com/r/*/comments`, `quora.com`. **video**: `youtube.com/watch`, `youtu.be`. **review profile**: sources-report kind `reviews` (yelp, g2, capterra, getapp, trustpilot, tripadvisor, healthgrades, bbb…). **directory**: domain in the vertical seed list (L7/S4). **competitor page**: domain's main label fuzzy-matches a competitor name via `nameKey`. **reference**: kind `reference`. **article**: anything else of kind `other`. Gemini citations are mostly domain-only, so Gemini can only feed domain-level rules. |

---

## 3. The rules

### B. Blockers (crawl, robots, rendering, indexing)

A blocker stops every other task from working on the affected engines. All B rules go in **Fix first** when failing, except B4.

#### B1 · Let AI search bots read the site
- **Applies to:** both
- **Trigger:** `[Today]` `site.checks.ai_allowed.status != 'pass'` (whole-site robots block). Path-level blocks of key pages: `NEEDS: gap 13`.
- **Title:** "Unblock {blocked_bots} in robots.txt: {engines} can't read {own_domain}"
- **Steps:** 1. Open `{own_domain}/robots.txt`. 2. Allow OAI-SearchBot, Googlebot, Bingbot, PerplexityBot, ClaudeBot / Claude-SearchBot. 3. Check the CDN/firewall (e.g. Cloudflare bot blocking) isn't blocking them too. 4. Decide on GPTBot and Google-Extended separately (training only; see M4).
- **AI writes:** The exact robots.txt lines to paste, and a 3-line note for the web person.
- **Priority:** Override → Fix first, rank 1.
- **Done when / re-check:** Website check passes on re-fetch (same day). Then the own domain should appear in ChatGPT citations within ~1 day of the change.
- **Evidence:** A (non-vendor, official). Blocking OAI-SearchBot removes a site from ChatGPT search answers; changes take ~24h ([OpenAI bots](https://developers.openai.com/api/docs/bots)). GPTBot/Google-Extended are training-only and don't remove live citations (same; [Google](https://developers.google.com/search/docs/appearance/ai-features)).

#### B2 · Put key facts in the raw HTML
- **Applies to:** both (highest risk: online single-page sites)
- **Trigger:** `[Today]` `site.checks.readable_text.status != 'pass'` (homepage text too short without JavaScript). Per-page check: `NEEDS: gap 6`.
- **Title:** "Make {own_domain} readable without JavaScript: ChatGPT, Claude and Perplexity see {n_chars} characters"
- **Steps:** 1. Open the page with "view source" (not the browser view). 2. If prices, services, hours or the business description aren't in the source, ask the web person to server-render or pre-render those pages. 3. Re-test with view-source.
- **AI writes:** A plain note to the web person naming the platform (from the HTML generator tag) and the specific missing facts.
- **Priority:** Override → Fix first. Raise when the business has `pricing` or `services` facts that aren't in `homepageText`.
- **Done when / re-check:** `readable_text` passes on the next scan.
- **Evidence:** B. GPTBot, ClaudeBot and PerplexityBot download JS but don't run it; only Googlebot and AppleBot render ([Vercel server logs](https://vercel.com/blog/the-rise-of-the-ai-crawler)). Serve key content without JS ([Blyskal deck](https://speakerdeck.com/joshbly/josh-blyskal-profound-we-analyed-10000-000-ai-search-results-dot-dot-dot)).

#### B3 · Get indexed in Bing, Google and Brave
- **Applies to:** both
- **Trigger:** `NEEDS: gap 13` (Bing/Brave index check) and `gap 12` (Google organic). Fires when a `site:{own_domain}` search returns 0 results on Bing, Google or Brave, or key pages carry `noindex`/`nosnippet`.
- **Title:** "Get {own_domain} into {missing_index}: it feeds {engines}"
- **Steps:** 1. Verify the site in Bing Webmaster Tools and submit the sitemap. 2. Turn on IndexNow. 3. Verify in Google Search Console and request indexing of key pages. 4. Remove `noindex`/`nosnippet` from pages meant to be cited.
- **AI writes:** A checklist with the exact sitemap URL and the key pages to submit.
- **Priority:** Override → Fix first if the business is in no index; otherwise normal priority with Effort S.
- **Done when / re-check:** `site:` returns results on the next scan. Bing pickup via IndexNow is fastest.
- **Evidence:** A/B. Google requires indexing + snippet eligibility, nothing else ([Google, non-vendor](https://developers.google.com/search/docs/appearance/ai-features)). Copilot runs on Bing and Bing's AI Performance report shows grounding queries ([SEL](https://searchengineland.com/bing-webmaster-tools-testing-new-ai-performance-report-468039)). Claude appears to search through Brave ([TechCrunch, non-vendor](https://techcrunch.com/2025/03/21/anthropic-appears-to-be-using-brave-to-power-web-searches-for-its-claude-chatbot/)). Whether ChatGPT still relies on Bing is disputed (Seer 87% Bing match vs Profound Bing alignment falling 26%→8%) ([engine notes](../../research_notes/GEO%20strategy%20playbooks/engine_source_selection.md)).

#### B4 · Publish a sitemap with true dates
- **Applies to:** both
- **Trigger:** `[Today]` `site.checks.sitemap.status != 'pass'`. Accurate `lastmod`: `NEEDS: gap 6`.
- **Title:** "Publish a sitemap for {own_domain} so engines find page updates faster"
- **Steps:** 1. Turn on the platform's sitemap (most builders have a toggle). 2. Make sure `lastmod` changes only when content changes. 3. Submit it in Bing and Google (B3).
- **AI writes:** Platform-specific instructions (Wix/Squarespace/WordPress/Webflow).
- **Priority:** Low. Effort S. Never in Fix first.
- **Done when / re-check:** `sitemap` passes on the next scan.
- **Evidence:** B. Accurate `lastmod` and IndexNow speed up pickup ([MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/)). Hygiene, not a lever.

---

### F. Wrong facts

**How a finding is routed.** Every open finding gets exactly one root-cause rule (F1-F6), picked in this order: F5 → F1 → F2 → F3 → F6 → F4. Severity rules F7-F9 and the price rule F10 are added on top and change the section and priority. **On prospect scans, F rules only fire for facts the owner has reviewed** (gap 15), except F7-F9.

Universal steps for every F task (from the fix playbook): find the source, fix the source, state the correct fact once on the business's own site, speed up recrawl, log engine feedback as "record only", re-test on schedule ([fact correction notes](../../research_notes/GEO%20strategy%20playbooks/fact_correction.md)). No engine has a business-facts correction form with a ticket or outcome ([OpenAI](https://help.openai.com/en/articles/20001057); [Claude Help](https://support.claude.com/en/articles/8525154-claude-is-providing-incorrect-or-misleading-responses); [MarTech](https://martech.org/time-to-check-your-phone-numbers-in-ai-overviews)).

#### F1 · Wrong fact read from the business's own site
- **Applies to:** both
- **Trigger:** `[Today]` open finding whose `citations` include a URL on the own domain (`fixAdvice.onOwnSite = true`).
- **Title:** "Change "{claim}" on {own_url}: {engine} read it there"
- **Steps:** 1. Open `{own_url}` and find the old wording. 2. Replace it with `{fact}`. 3. Search the site for other pages that still say the old thing; update or redirect them. 4. If the page is old (an old price list, expired promo), redirect it to the current page.
- **AI writes:** The exact replacement sentence(s), in the page's voice, and a list of other own pages that likely carry the same old fact.
- **Priority:** Severity × repeat count (gap 9). Effort S. This is the fastest fix type.
- **Done when / re-check:** The correct fact appears in ≥2 of 3 runs of the triggering prompt on two consecutive scans. First look at day 4 (median for a fact swap on an already-cited page); escalate day 30.
- **Evidence:** B. Fact swap on a cited page: median 4 days, 6% unchanged at day 45; date-only changes did nothing ([MaxAEO, 312 edits](https://maxaeo.ai/blog/how-long-ai-updates-answers/)).

#### F2 · Wrong fact read from a listing or profile
- **Applies to:** both
- **Trigger:** `[Today]` open finding whose `citations` include a domain of kind `reviews` or `google`, or in the listing seed list (Google Maps, Yelp, Bing Places, Apple, Facebook, BBB, MapQuest, G2, Capterra, Crunchbase, LinkedIn, Healthgrades, Avvo…), and no own-domain URL.
- **Title:** "Fix "{claim}" on your {listing_domain} profile: {engine} quotes it"
- **Steps:** 1. Log in to (or claim) the `{listing_domain}` profile. 2. Change the field to `{fact}`. 3. Make the same fact identical on GBP, website and the other main listings. 4. If you can't edit it, use the site's "suggest an edit" and keep the confirmation.
- **AI writes:** Which field to change, the exact new value, and a correction request if the listing can't be self-edited.
- **Priority:** Severity × repeat count. Effort S.
- **Done when / re-check:** Same 2-of-3 rule. First look day 9 (AIO median); listings can be faster for Perplexity (day 2).
- **Evidence:** A/B. Listings are 42% of local AI citations and 48.7% of ChatGPT's ([Yext, 6.8M citations](https://www.yext.com/blog/ai-citations-86-percent-of-sources-are-brand-managed)). Sterling Sky saw ChatGPT Search cite an outdated directory listing for a wrong answer ([Sterling Sky](https://www.sterlingsky.ca/is-chatgpt-search-the-future-or-just-overhyped/)).

#### F3 · Wrong fact read from a third-party article or list
- **Applies to:** both
- **Trigger:** `[Today]` open finding whose `citations` include only domains of kind `other` or `reference` (not own, not listing).
- **Title:** "Ask {domain} to correct "{claim}": {engine} cites {page_title_or_url}"
- **Steps:** 1. Open the page and confirm it says the wrong thing. 2. Find the author or editor (byline, contact page, LinkedIn). 3. Send the correction email with proof. 4. Publish the correct fact plainly on your own site (FAQ line or facts page). 5. Follow up once after a week.
- **AI writes:** A short correction email (what's wrong, the right fact, a link proving it, one yes/no ask) and the FAQ line for the own site.
- **Priority:** Severity × repeat count × number of engines citing the page. Effort M (needs a third party).
- **Done when / re-check:** Same 2-of-3 rule. Expect slow: first look day 14, second day 33, re-diagnose day 45.
- **Evidence:** B. Claims contradicted by third-party sites took a median 33 days and 41% never changed within 45 days ([MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/)). No documented success rate for publisher corrections ([fact notes](../../research_notes/GEO%20strategy%20playbooks/fact_correction.md)).

#### F4 · Wrong fact with no source (model memory or guess)
- **Applies to:** both
- **Trigger:** `[Today, approx.]` open finding whose `citations` are empty. Confirming it's memory (still wrong with search off): `NEEDS: gap 8`.
- **Title:** "AI says "{claim}" without a source: put the right answer where it can find it"
- **Steps:** 1. Add a one-line FAQ answer on your site: the question as people ask it, then `{fact}`. 2. Make the same fact match on GBP/main listings (local) or G2/LinkedIn/Crunchbase (online). 3. Send feedback in `{engine}` (thumbs-down + correct fact). This only creates a record. 4. Expect search-on answers to change in weeks; answers from memory change only with a new model.
- **AI writes:** The FAQ question and answer, phrased like the triggering prompt; the feedback text.
- **Priority:** Severity × repeat count. Lower than F1-F3 because the fix is indirect.
- **Done when / re-check:** Same 2-of-3 rule on search-on runs. Memory runs are reported but never block "Confirmed". Re-check monthly.
- **Evidence:** A/B. Only 14.4% of ChatGPT responses triggered a search ([Ahrefs, 66.6M responses](https://ahrefs.com/blog/query-fan-out-chatgpt/)); Semrush says 34.5% ([Semrush](https://www.semrush.com/blog/chatgpt-search-insights/)). Memory refreshes over months ([MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/)).

#### F5 · Confused with a same-named business
- **Applies to:** both
- **Trigger:** `[Today]` ≥1 namesake run on a branded prompt in this scan, or an open finding from a check that is a namesake run.
- **Title:** "AI mixes you up with {other_entity}: make clear you're the {category} in {location}"
- **Steps:** 1. Add an About/FAQ line: "Is {name} the same as {other}? No. {name} is a {category} in {location}, founded {year}." 2. Use "{name} {city}" (local) or "{name} {category}" (online) in your page titles and listing names where natural. 3. Make name, city and category identical on GBP, LinkedIn, Crunchbase. 4. Add Organization/LocalBusiness schema with `sameAs` links to your real profiles (cheap hygiene, no proven lift). 5. If you meet notability, fix or create the Wikidata item (M2).
- **AI writes:** The disambiguation FAQ line; a list of profiles to align; the schema block.
- **Priority:** High when the namesake's facts include closure, legal or negative tone (escalate to F7/F9). Effort M.
- **Done when / re-check:** No namesake runs on branded prompts on two consecutive scans. Re-check monthly; expect weeks to months.
- **Evidence:** C. All guidance is practitioner-level; no case study ([Parse](https://www.parse.gl/blog/entity-disambiguation-ai); [Pixelmojo](https://www.pixelmojo.io/blogs/brand-disambiguation-ai-entity-confusion)). Real harm documented: Anna Mae's Bakery was called closing because Google confused it with a same-named bakery ([PinMeTo](https://www.pinmeto.com/news/google-ai-overview-false-closure-location-accuracy-2026/)).

#### F6 · AI says you offer something you don't
- **Applies to:** both
- **Trigger:** `[Today, approx.]` open finding with fact category `not_offered` or `services` (online: also integrations/features claims) whose `citations` don't include an own-domain page stating it. Clean detection of "category guess": `NEEDS: gap 9` (judge's reason).
- **Title:** "AI thinks you offer {claimed_service}: say clearly what you do and don't do"
- **Steps:** 1. Add a "What we do / what we don't do" section to your services page (online: an integrations page that lists real integrations). 2. Add an FAQ line phrased like the question that triggered it. 3. Ask any cited comparison page to correct it (F3 email).
- **AI writes:** The "we don't offer" sentence(s) in a natural voice, and the FAQ entry.
- **Priority:** Severity × repeat count. Effort S.
- **Done when / re-check:** Same 2-of-3 rule. First look day 8 (new Q&A section median).
- **Evidence:** B. A new Q&A section showed up in a median 8 days ([MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/)). Integrations claims are wrong 10.6% of the time, products/services 8.6% ([Searchable, 32,556 facts](https://www.searchable.com/data/ai-brand-misinformation-report)).

#### F7 · Severity override: "permanently closed" or "closing"
- **Applies to:** both (mostly local)
- **Trigger:** `[Today]` open finding whose `claim` matches `/closed|closing|out of business|shut(ting)? down|no longer operat/i`.
- **Title:** "URGENT: {engine} says you're closed. Here's how to fight it"
- **Steps:** 1. Confirm GBP shows Open; if Maps flags it, use "reopened". 2. Post "We're open" on your homepage, GBP and social. 3. Fix any duplicate or old listing. 4. Send AI Overview feedback and post in the GBP Help Community (record only). 5. Check F5 (namesake). 6. Log screenshots, dates and lost sales. 7. If sales are hit: contact local press.
- **AI writes:** The "We're open" homepage banner and GBP post; the Help Community post; a harm-log template; a short press pitch if escalated.
- **Priority:** Override → Fix first, rank 2 (after B1).
- **Done when / re-check:** No run says closed on two consecutive scans. Re-check every scan; cases have run for weeks.
- **Evidence:** B (non-vendor news). Viridian Bookshop saw the error weeks after filing Google's form, with a sales drop ([Cleveland Magazine](https://clevelandmagazine.com/articles/willoughby-bookstore-confronts-google-ai-error-claiming-it-was-permanently-closed/)); every false-closure case found was fixed only after press coverage ([fact notes](../../research_notes/GEO%20strategy%20playbooks/fact_correction.md)).

#### F8 · Severity override: wrong phone, address or hours
- **Applies to:** both (mostly local)
- **Trigger:** `[Today]` open finding with fact category `logistics` whose claim or fact label mentions phone, address, hours or booking.
- **Title:** "Fix the wrong {field} AI gives customers: {engine} says {claim}"
- **Steps:** 1. Fix GBP first. 2. Then Bing Places, Apple Business Connect, Yelp, Facebook. 3. Make the website's phone/address/hours plain text and identical. 4. Route any remaining source through F1-F3.
- **AI writes:** A per-listing checklist with the exact value to enter.
- **Priority:** Override → Fix first when the claim is a phone number or address; hours stay in Fix wrong facts with a ×1.5 boost.
- **Done when / re-check:** Same 2-of-3 rule. First look day 4-9.
- **Evidence:** B. Wrong and scam phone numbers have appeared in AI Overviews ([MarTech, non-vendor](https://martech.org/time-to-check-your-phone-numbers-in-ai-overviews)). Profile data was ~68% accurate on ChatGPT/Perplexity vs 100% on Gemini ([SOCi, ~350k locations](https://soci.ai/news/in-ai-driven-discovery-few-brands-are-chosen-most-disappear/)).

#### F9 · Severity override: credentials or legal/reputation claims
- **Applies to:** both
- **Trigger:** `[Today]` open finding with fact category `providers` or `compliance`, or claim matches `/lawsuit|sued|attorney general|fraud|scam|unlicensed|malpractice|license/i`.
- **Title:** "AI says "{claim}" about {name}: correct it and keep a record"
- **Steps:** 1. Credentials: make provider pages state title and license plainly; fix board/directory profiles (L7). 2. Legal claims: screenshot every answer with date, engine and prompt; ask the cited publisher to clarify; log lost business. 3. For a named person (founder, provider), use OpenAI's Privacy Portal. 4. Only for false crime/lawsuit/fraud claims causing measurable loss: talk to a lawyer.
- **AI writes:** Provider credential line; a publisher clarification email; the harm log; the Privacy Portal request text.
- **Priority:** Override → Fix first for legal claims and wrong credential level; others in Fix wrong facts with ×1.5.
- **Done when / re-check:** Same 2-of-3 rule; re-check every scan.
- **Evidence:** B (non-vendor court/news). Wolf River Electric is suing over a false AI Overview lawsuit claim ([Minnesota Lawyer](https://minnlawyer.com/2025/06/13/wolf-river-electric-google-ai-defamation-lawsuit/)); Walters v. OpenAI lost ([Cleary Gottlieb](https://www.clearygottlieb.com/news-and-insights/publication-listing/georgia-court-dismisses-defamation-lawsuit-against-openai-over-chatgpt-output)). Privacy Portal is for personal data only ([OpenAI](https://help.openai.com/en/articles/20001057)).

#### F10 · Price modifier: wrong price
- **Applies to:** both
- **Trigger:** `[Today]` open finding with fact category `pricing`. Attached to whichever F1-F6 rule owns the finding.
- **Title:** "Fix the price AI quotes: {engine} says {claim}, it's {fact}"
- **Steps (added to the root-cause steps):** 1. Put the current price in plain text on the page that answers the question (P1/O1). 2. Redirect or noindex old price pages and expired promos. 3. Update price fields on G2/Capterra or listings. 4. Email authors of cited lists with old prices.
- **AI writes:** The price sentence ("Starting at $X"), and the redirect list from old URLs found in citations.
- **Priority:** ×1.5 on the owning rule's score.
- **Done when / re-check:** Owning rule's schedule.
- **Evidence:** B. Pricing is the most error-prone fact: 13.5% wrong (16.1% US) ([Searchable](https://www.searchable.com/data/ai-brand-misinformation-report)). "Price not mentioned" was a gatekeeper factor in a controlled test (A, [arXiv 2605.25517](https://arxiv.org/pdf/2605.25517), academic).

---

### P. Own-site pages

#### P1 · Put prices in plain text
- **Applies to:** both
- **Trigger:** `[Today, approx.]` (any of) `addedWords` contains price/cost/pricing; an F10 finding exists; ≥2 lost cells whose prompt contains price/cost/cheap/affordable. AND no currency amount (`/[$£€]\s?\d/`) in `homepageText` or any `site.pages` title. Per-page price check: `NEEDS: gap 6`.
- **Title:** "Show your prices on {target_page}: AI searched "{query}" in {n} answers"
- **Steps:** 1. Add "Starting at $X" or a range for each main service/plan. 2. Put it in text near the top, not in an image or booking widget. 3. Add the date it was last checked.
- **AI writes:** The price block, built only from `pricing` facts (never invented). If the business has no price facts, the task asks the owner for them instead.
- **Priority:** Cells affected. Effort S.
- **Done when / re-check:** Website check finds the price on the page; next-scan `search_queries` for price prompts cite the own page. First look day 8-16.
- **Evidence:** A. "Price not mentioned" had odds ratios >100 in all six models (~252k trials) ([arXiv 2605.25517](https://arxiv.org/pdf/2605.25517), academic). Limit: post-retrieval test.

#### P2 · Put the answer in the first third of the page
- **Applies to:** both
- **Trigger:** `NEEDS: gap 6`. An own page cited in or meant for a lost cell has the prompt's key facts (service, place, price, who it's for) only after the first 30% of its text.
- **Title:** "Move the answer to the top of {page_url}: it's {pct}% down the page"
- **Steps:** 1. Write a 2-3 sentence opening that answers the question directly. 2. Use a plain definition ("X is a … that …"). 3. Keep the details below.
- **AI writes:** The new opening paragraph, using the business's facts.
- **Priority:** Cells affected. Effort S.
- **Done when / re-check:** Page re-check passes; own page cited for the prompt. First look day 16.
- **Evidence:** B. 44.2% of ChatGPT citations come from the first 30% of a page; cited passages ~2x more definitional ([Indig via SEL](https://searchengineland.com/chatgpt-citations-content-study-469483)). Formatting-only changes had no effect in a controlled test ([arXiv 2605.25517](https://arxiv.org/pdf/2605.25517)).

#### P3 · Match a page title and URL to the question
- **Applies to:** both
- **Trigger:** `[Today, approx.]` a lost-cell cluster (prompts sharing a service/topic) where no `site.pages` title or URL shares the cluster's main terms (service + place for local; category + audience for online). Uses `search_queries` terms where available. Exact similarity across all pages: `NEEDS: gap 6`.
- **Title:** "Retitle {page_url} to match "{prompt}""
- **Steps:** 1. Change the page title to mirror how people ask. 2. Use a plain 4-7 word URL slug (redirect the old one). 3. If no page fits, see P6/L6/O3.
- **AI writes:** New title, H1 and slug options.
- **Priority:** Cells affected. Effort S.
- **Done when / re-check:** Title updated in website check; own page cited for the cluster. First look day 16.
- **Evidence:** B. Prompt-to-title similarity 0.602 for cited vs 0.484 for non-cited pages; natural-language slugs cited 89.78% vs 81.11% ([Ahrefs, 1.4M prompts](https://ahrefs.com/blog/why-chatgpt-cites-pages/)).

#### P4 · Make the meta description state the answer
- **Applies to:** both
- **Trigger:** `NEEDS: gap 6`. A target page's meta description is missing or doesn't contain the price/service/place facts.
- **Title:** "Rewrite the search snippet for {page_url} so it gives the answer"
- **Steps:** 1. Write ≤155 characters that state the answer (what, where, price). 2. Paste into the page's SEO settings.
- **AI writes:** Two meta description options.
- **Priority:** Low. Effort S. Grade C weight.
- **Done when / re-check:** Website check reads the new description.
- **Evidence:** C. "Spoil your content in your meta description"; engines read a short snippet before citing ([Blyskal deck](https://speakerdeck.com/techseoconnect/josh-blyskal-we-analyzed-250000-000-ai-search-responses-heres-what-we-found)).

#### P5 · Add an honest comparison section
- **Applies to:** both (online version per competitor is O2)
- **Trigger:** `[Today]` `addedWords` contains vs/versus/compare/alternative OR ≥2 lost cells on comparison prompts; AND no `site.pages` title/URL contains vs/compare/alternatives. Suppressed if the business set "no comparison content".
- **Title:** "Add a "how to choose a {category} in {location}" comparison: AI compared options in {n} answers"
- **Steps:** 1. Write a short page or section: who you're best for, who you're not, key specs, prices. 2. Name real alternatives fairly. 3. Date it.
- **AI writes:** Page outline and a draft comparison table using only the business's facts; competitor rows left for the owner to verify.
- **Priority:** Cells × dominance. Effort M.
- **Done when / re-check:** Page exists; own page cited for comparison prompts. First look day 16.
- **Evidence:** A. "No comparisons" significantly cut citation in a controlled test ([arXiv 2605.25517](https://arxiv.org/pdf/2605.25517)). Self-published comparison share in ChatGPT fell after a 2026 model change ([Lily Ray](https://x.com/lilyraynyc/article/2090256147441746150)).

#### P6 · One page per service
- **Applies to:** both
- **Trigger:** `[Today, approx.]` a `services` fact (or service named in a lost category prompt) with ≥2 lost cells, and no `site.pages` title/URL containing that service. Full page list: `NEEDS: gap 13` (≤8 pages chosen by URL pattern).
- **Title:** "Create a page for {service}: {rivals} are named for it in {n} answers"
- **Steps:** 1. Title = service (+ city if local). 2. Opening answers what it is, price, who does it, how long. 3. Real customer questions below. 4. Link it from the services menu.
- **AI writes:** Full page outline and opening paragraph from the fact sheet; FAQ questions taken from the lost prompts and `search_queries`.
- **Priority:** Cells × dominance × keyword value. Effort M.
- **Done when / re-check:** Page found by website check; own page cited for that service's prompts. First look day 16.
- **Evidence:** B. "Dedicated page for each service" is #2 of the AI visibility factors (score 170) ([Whitespark, 47 experts](https://whitespark.ca/local-search-ranking-factors/)). Semantic relevance was the strongest predictor ([Search Atlas, 104,855 citations](https://searchatlas.com/blog/how-llms-rank-local-business/)).

#### P7 · Keep money pages dated and current
- **Applies to:** both
- **Trigger:** `NEEDS: gap 6`. A cited or target page shows a visible date >6 months old (or `lastmod` >6 months) AND (`addedWords` contains the current year OR the page carries prices).
- **Title:** "Update {page_url}: last updated {date}, and AI searches for "{year}""
- **Steps:** 1. Re-check prices, staff, offers. 2. Change what's out of date. 3. Update the visible "Last updated" date only when content changed.
- **AI writes:** A list of what on the page looks stale (old year, old prices) and the replacement text.
- **Priority:** Raise for online and for ChatGPT/Perplexity cells; lower for AIO-only. Effort S. Recurs quarterly.
- **Done when / re-check:** New date and changed content detected. Re-arms after 90 days.
- **Evidence:** A/B. "Recent vs old timestamp" was a gatekeeper (OR >100); no date was roughly neutral ([arXiv 2605.25517](https://arxiv.org/pdf/2605.25517)). AI-cited URLs ~25.7% fresher than organic; AIO the least fresh ([Ahrefs, 17M citations](https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/?pp=env)). Conflict: Ahrefs' 1.4M-prompt study found a ~500-day median age for cited pages ([Ahrefs](https://ahrefs.com/blog/why-chatgpt-cites-pages/)). Date-only bumps did nothing ([MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/)).

#### P8 · Remove contradictory facts across pages
- **Applies to:** both
- **Trigger:** `NEEDS: gap 6`. Two own pages state different values for the same fact (price, hours, address, plan limits).
- **Title:** "{page_a} and {page_b} disagree on {fact_label}: pick one"
- **Steps:** 1. Confirm the right value. 2. Fix or redirect the wrong page.
- **AI writes:** The conflicting sentences side by side with the fix.
- **Priority:** Effort S. ×1.5 if the fact is pricing or logistics.
- **Done when / re-check:** No conflict on next website check.
- **Evidence:** A. "Internal contradictions" significantly reduced citation ([arXiv 2605.25517](https://arxiv.org/pdf/2605.25517)).

#### P9 · Make your page the one AI cites when it names you
- **Applies to:** both
- **Trigger:** `[Today]` (computed from existing `checks`, closes gap 5) ≥3 buyer runs across ≥2 prompts with `mentioned=true` and no own-domain URL in `citations`, on engines that cite (not memory runs).
- **Title:** "AI names you on "{prompt}" but quotes {top_cited_domain}, not your site"
- **Steps:** 1. Pick the own page that should answer this prompt (or create it via P6). 2. Apply P1-P3 to it. 3. Make sure what that page says matches what the cited third-party says.
- **AI writes:** Which page to strengthen and the specific facts the cited third-party page has that yours lacks (once gap 1 is closed).
- **Priority:** Runs affected. Effort M. Lower than lost-cell rules (the business is already named).
- **Done when / re-check:** Own domain cited in ≥1 of 3 runs for that prompt on 2 consecutive scans.
- **Evidence:** B. Assistants linked to the brand in only 28% of answers that mentioned it ([Ahrefs](https://ahrefs.com/blog/ai-citations-vs-impressions-study/)).

#### P10 · Cover what AI searched for (router)
- **Applies to:** both
- **Trigger:** `[Today]` a word in `addedWords` (seen in ≥2 cells) with no matching own page title/URL and no other rule claiming it.
- **Routing:** price/cost → P1/O1. vs/compare/alternatives → P5/O2. year → P7. reviews/rated → L5/O4. hours/open/book/near/location → P11 (and L1 for local). Anything else ("insurance", "parking", "free trial") → a P10 task.
- **Title:** "Answer "{word}" on your site: AI added it to its searches in {n} answers"
- **Steps:** 1. Add a short section or FAQ answering it with a real fact. 2. Don't make a separate page per phrase.
- **AI writes:** The FAQ question/answer, or asks the owner for the missing fact.
- **Priority:** Cells. Effort S.
- **Done when / re-check:** Word found on an own page; first look day 8.
- **Evidence:** B/C. ChatGPT fan-outs add "2026" 22.9%, "official" 13.1%, "price" 8.9% of the time ([Ahrefs](https://ahrefs.com/blog/query-fan-out-chatgpt/)). Don't build a page per fan-out phrase ([Superlines](https://superlines.io/articles/90-day-geo-plan-ai-search-visibility)).

#### P11 · A plain "who we are" summary and contact facts
- **Applies to:** both
- **Trigger:** `[Today]` any of: `site.checks.facts_page` fails; `site.checks.contact_visible` fails; the first 200 words of `homepageText` lack the category term or (local) the city.
- **Title:** "Say plainly what {name} is, where, and for whom, at the top of your homepage"
- **Steps:** 1. Homepage: one sentence "{name} is a {category} in {location} for {audience}." 2. Phone, address, hours in text (local) or contact + pricing link (online). 3. An About/facts page with the fact-sheet basics. 4. Optional hygiene: Organization/LocalBusiness schema matching the text.
- **AI writes:** The summary sentence, the About-page facts block, and the schema block.
- **Priority:** Effort S. Grade B.
- **Done when / re-check:** Website check passes all three conditions.
- **Evidence:** B. Homepage took 81.7% of measurable LLM leads; rule: H1 names the product, summary in the first 200 words ([TripleDart, 28 clients](https://www.tripledart.com/research/which-pages-do-llms-cite)). Schema gave no lift (−4.6% AIO) in a quasi-experiment ([Ahrefs](https://ahrefs.com/blog/schema-ai-citations/)).

---

### S. Cited third-party sources, by page type

These rules turn the **lost URL set** into outreach. One task per URL (or per domain for Gemini-only citations). Rank URLs by weight; show the top ones. Every S task names the page, the engines citing it, and the rivals named.

#### S1 · Get onto a cited "best of" list
- **Applies to:** both (local: "best {service} in {city}"; online: "best {category} tools")
- **Trigger:** `[Today, approx.]` URL in the lost URL set with page type = listicle, cited in ≥2 lost cells. Confirming the list names rivals and not the business: `NEEDS: gap 1`. Today, competitor co-occurrence in the same answers is used as a proxy (gap 7).
- **Title:** "Get onto {page_title} ({domain}): cited in {n} answers on {engines}, names {rivals}"
- **Steps:** 1. Check the list really omits you and when it was last updated. 2. Find the author or editor (byline/LinkedIn), not a contact form. 3. Send the pitch: the gap you fill, one-line summary, price, one proof point the editor can check. 4. One follow-up after a week. 5. Don't ask to be #1; don't pay without a clear "sponsored" label.
- **AI writes:** The pitch email (subject, 4-6 sentences, one yes/no ask) and the follow-up, using the list's own wording and the business's differentiator from the fact sheet.
- **Priority:** URL weight × dominance × value. Effort M. Boost ×1.2 if updated in the last ~2 months ("live" list, once gap 1 gives dates).
- **Done when / re-check:** Once gap 1 is closed: the fetched page names the business. Then the affected cells. Re-check placement in AI answers days 7-21. Re-arms 4-6 weeks after Done if the page still omits the business.
- **Evidence:** A/B. "Best X" lists were 43.8% of ChatGPT source page types; 35% sat on low-authority domains; higher list position ↔ more recommendations ([Ahrefs, 750 prompts](https://ahrefs.com/blog/best-lists-research/)). Best-of lists are the #1 local AI factor ([Whitespark](https://whitespark.ca/local-search-ranking-factors/)). Pitch method: C ([MADX](https://www.madx.digital/learn/get-featured-in-best-software-lists)). Listicle share in ChatGPT roughly halved after GPT-5.6 ([Lily Ray](https://x.com/lilyraynyc/article/2090256147441746150)).

#### S2 · Fix a list you're already on (link, position, old details)
- **Applies to:** both
- **Trigger:** `NEEDS: gap 1`. A cited listicle names the business but with no link, old prices/facts, or below position 3 while rivals sit above.
- **Title:** "Update your entry on {page_title}: {issue}"
- **Steps:** 1. Email the author with the correction or link request. 2. Offer a fresh fact (new service, award, review score).
- **AI writes:** A 3-sentence update request.
- **Priority:** Effort S. Boost: MADX calls unlinked mentions "the fastest win" (C).
- **Done when / re-check:** Fetched page shows the link/new details. Re-check day 14.
- **Evidence:** C ([MADX](https://www.madx.digital/learn/get-featured-in-best-software-lists)); position effect B ([Ahrefs](https://ahrefs.com/blog/best-lists-research/)).

#### S3 · Claim and complete a cited review profile
- **Applies to:** both (vertical lists in L3/L5/O4)
- **Trigger:** `[Today]` domain of kind `reviews` in the lost URL set (or in `sources.gaps`), cited in ≥2 lost cells. Whether a profile exists: `NEEDS: gap 3`.
- **Title:** "Claim and complete your {domain} profile: AI cites it in {n} answers where {rivals} win"
- **Steps:** 1. Search {domain} for your business; claim it or create it. 2. Fill every field to match your fact sheet (services, prices, hours, photos). 3. Start asking every customer for reviews there too (L5/O4 rules).
- **AI writes:** Field-by-field profile copy from the fact sheet.
- **Priority:** Cells × dominance. Effort S.
- **Done when / re-check:** Profile live (gap 3) and the domain stops appearing in lost cells / starts naming the business. Re-check day 9-14.
- **Evidence:** B. Authority and diversity of review sites are #5 and #11 AI factors ([Whitespark](https://whitespark.ca/local-search-ranking-factors/)). G2 cited in 15-20% of answers in ChatGPT/Perplexity/Claude ([Foundation/AirOps](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)).

#### S4 · Get listed on a cited industry directory
- **Applies to:** both
- **Trigger:** `[Today, approx.]` domain in the lost URL set matching the vertical seed list (dental: toprateddentist.com, webmd.com, vitals.com, healthgrades.com; legal: superlawyers.com, findlaw.com, avvo.com; general: mapquest.com, bbb.org; B2B services: clutch.co), cited in ≥2 lost cells. Seed list grows from what scans see.
- **Title:** "List {name} on {domain}: AI uses it for {category} questions in {n} answers"
- **Steps:** 1. Create or claim the listing. 2. Match name, address, phone, categories and services exactly to the website. 3. Add credentials and services in full.
- **AI writes:** The listing copy and category choices.
- **Priority:** Cells. Effort S-M.
- **Done when / re-check:** Listing found (gap 1/3); domain no longer only in lost cells. Re-check day 14.
- **Evidence:** B. ChatGPT drew dentistry answers from ten dental directories; Superlawyers/FindLaw heavily used for legal ([BrightLocal test](https://brightlocal.com/blog/ai-search-using-listings-sources)). Healthcare listings = 52.6% of citations ([Yext](https://www.yext.com/research/articles/ai-citations-user-locations-query-context/)). Pick directories the audit shows, not bulk citation services ([playbooks report](../../reports/GEO%20strategy%20playbooks.md)).

#### S5 · Answer a cited Reddit or forum thread, openly
- **Applies to:** both (lower priority for local)
- **Trigger:** `[Today]` thread URL (reddit.com/r/*/comments, quora.com) in the lost URL set, cited by `google` (AI Mode), AIO or `perplexity` in ≥1 lost cell, or by any engine in ≥2. If only `openai`/`anthropic` cite it: ×0.5.
- **Title:** "Reply in "{thread_title}" (r/{sub}): {engines} cite it and name {rivals}"
- **Steps:** 1. Read the subreddit rules. 2. Reply from one real, named account; say who you are in the reply. 3. Answer the question fully, including when a competitor fits better. 4. Mention your business only where it fits. 5. Never use extra accounts or ask for upvotes.
- **AI writes:** A draft reply that opens with the disclosure ("I run {name}, so I'm biased…"), answers the actual question, and is short. The owner edits it before posting.
- **Priority:** Cells × engine fit. Effort M.
- **Done when / re-check:** Task marked Done by owner; thread re-checked for whether it's still cited. No auto-close on AI change (Reddit citation share is volatile). Re-arms after 6 weeks if still cited and the business absent.
- **Evidence:** C. Ethan Smith: one real disclosed account, helpful answers ([Graphite](https://graphite.io/five-percent/the-ultimate-guide-to-aeo-on-lennys-podcast)). ChatGPT's Reddit citations fell 86% in days in Aug 2026; AI Mode −31%, AIO −11% ([Semrush](https://www.semrush.com/blog/reddits-citations-in-chatgpt-fall/)). Claude cites no Reddit ([Foundation/AirOps](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)). Local forums ~2% of citations ([Yext](https://www.yext.com/blog/ai-citations-86-percent-of-sources-are-brand-managed)).

#### S6 · Make a video for a topic where AI cites YouTube
- **Applies to:** both
- **Trigger:** `[Today]` youtube.com/youtu.be URL in the lost URL set, cited by `google`, AIO or `perplexity` in ≥2 lost cells.
- **Title:** "Make a video answering "{prompt}": AI cites {video_title} for it on {engines}"
- **Steps:** 1. Record a 2-5 minute explainer, how-to or comparison. 2. Say the business name and category out loud; put them in the title and description. 3. Upload with an accurate transcript/captions.
- **AI writes:** Video title, description, and a talking-points script.
- **Priority:** Cells. Effort M-L. ×0.3 if the only citing engine is `openai`.
- **Done when / re-check:** Owner marks Done with the video URL; re-check whether the video is cited in 2-3 weeks.
- **Evidence:** A (correlation). YouTube mentions correlate ~0.737 with AI visibility ([Ahrefs, 75k brands](https://ahrefs.com/blog/ai-brand-visibility-correlations)); YouTube is 6.35% of AIO citations vs 0.04% of ChatGPT's ([Blyskal](https://speakerdeck.com/techseoconnect/josh-blyskal-we-analyzed-250000-000-ai-search-responses-heres-what-we-found)). Conflict: Peec lists YouTube in Gemini's top 5 while another report says Gemini barely cites it ([engine notes](../../research_notes/GEO%20strategy%20playbooks/engine_source_selection.md)).

#### S7 · Pitch a cited news or trade publication
- **Applies to:** both
- **Trigger:** `[Today, approx.]` URL of page type article (not listicle/profile/thread/video/competitor) in the lost URL set, cited in ≥2 lost cells. Telling news apart from blogs: `NEEDS: gap 2`.
- **Title:** "Pitch {domain}: AI cites their piece "{page_title}" in {n} answers"
- **Steps:** 1. Read the cited piece and the writer's recent work. 2. Pitch a specific story or expert quote (a local angle, data, a new service). 3. Plan one pitch a month; coverage fades in weeks.
- **AI writes:** The pitch email and 2 story angles from the fact sheet.
- **Priority:** Cells. Effort L. Recurring.
- **Done when / re-check:** Owner marks Done; re-check the outlet's citations in 2-4 weeks. Re-arms every 4-6 weeks.
- **Evidence:** B/C. Citation half-life 3.4 weeks in ChatGPT, 5.8 in Perplexity ([Scrunch](https://scrunch.com/blog/half-life-of-ai-citations)). Pitch the publications LLMs already cite ([Simmonds](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)); generic top-tier news barely moved ChatGPT memory mentions (~0.07) ([Seer](https://www.seerinteractive.com/insights/does-being-mentioned-on-top-news-sites-impact-ai-answer-mentions)).

#### S8 · A competitor's own page is being cited: answer it on your site
- **Applies to:** both
- **Trigger:** `[Today, approx.]` URL in the lost URL set whose domain matches a competitor (fuzzy `nameKey` on the domain label today; exact once competitor domains are stored, gap 7).
- **Title:** "{rival}'s page "{page_title}" wins "{prompt}": build your own answer"
- **Steps:** 1. Don't contact them. 2. Look at what their page states (price, specs, comparison). 3. Make sure your matching page states the same kinds of facts, honestly (P1, P5, P6; online O2).
- **AI writes:** A gap list: facts on their page type that your page lacks (needs gap 1 for content), then the page outline.
- **Priority:** Cells × dominance. Effort M.
- **Done when / re-check:** Own page cited for that prompt, or the business named. First look day 16.
- **Evidence:** C ([playbooks report](../../reports/GEO%20strategy%20playbooks.md)). SaaS: tool's own site cited only 11.6% of the time when ChatGPT recommends it ([DerivateX](https://derivatex.agency/report/b2b-saas-ai-citation-study/)).

#### S9 · Respond to the source behind a caveat
- **Applies to:** both
- **Trigger:** `[Today]` ≥2 buyer runs with `mentioned=true` and `tone` ∈ {negative, mixed}. The caveat text comes from `tone_reason`; candidate sources from those runs' `citations`.
- **Title:** "AI adds a warning when it names you: "{tone_reason}""
- **Steps:** 1. Find where it comes from (a review, an old article, a thread). 2. If it's a review: reply calmly and factually. 3. If it's outdated: ask the source to update (F3 email) and say what changed on your site. 4. If it's fair: fix the thing, then say so publicly.
- **AI writes:** The review reply or update request; a short "what changed" paragraph.
- **Priority:** Runs × engines. Effort M.
- **Done when / re-check:** Tone neutral/positive in ≥2 of 3 runs on 2 consecutive scans.
- **Evidence:** C. Dilute a negative source with positive third-party content; publish an honest page about the gap ([Simmonds](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)). Owner replies show a small positive correlation ([Search Atlas](https://searchatlas.com/blog/how-llms-rank-local-business/)). "Being mentioned wrongly is not a win" ([SBO.sg](https://sbo.sg/business/marketing/geo-monitoring-tools-agencies-ai-visibility/)).

---

### L. Local businesses only

#### L1 · Complete the Google Business Profile
- **Applies to:** local
- **Trigger:** `NEEDS: gap 3`. GBP missing, unverified, or missing primary category, services, hours, description or photos. Fallback today (shown once, as a "setup check"): local business AND lost cells on `google` (AI Mode)/`gemini`/AIO ≥ 50% of their category cells.
- **Title:** "Finish your Google Profile: Gemini and Google AI Mode use it even when they don't link it"
- **Steps:** 1. Set the right primary category and secondary ones. 2. Add every service, with prices where possible. 3. Hours, description, booking link, photos. 4. Skip daily posts; they aren't an AI lever.
- **AI writes:** Category suggestions, the description, the services list from the fact sheet.
- **Priority:** Weighted by Google-surface cells. Effort S.
- **Done when / re-check:** GBP fields complete (gap 3). Re-check Google-surface cells at day 9.
- **Evidence:** A/B. GBP ~28.6% of local citations, mostly AI Mode/AIO ([BrightLocal, ~200k prompts](https://www.brightlocal.com/research/local-ai-visibility-study/)); Gemini 100% profile accuracy via Maps ([SOCi](https://soci.ai/news/in-ai-driven-discovery-few-brands-are-chosen-most-disappear/)); Local Pack businesses recommended 3.5x more ([Insites, 10k businesses](https://natlawreview.com/press-releases/new-study-10000-local-businesses-reveals-what-ai-actually-uses-decide-who)). Shaw: GBP-only data "a zero for ChatGPT… a 3 for AI Mode & Gemini" (C). No GBP field is in Whitespark's AI top 20 ([Whitespark](https://whitespark.ca/local-search-ranking-factors/)). Post frequency neutral-to-negative ([Search Atlas](https://searchatlas.com/blog/how-llms-rank-local-business/)).

#### L2 · Claim Bing Places and Apple Business Connect
- **Applies to:** local
- **Trigger:** `NEEDS: gap 3`. Listing missing or unclaimed.
- **Title:** "Claim {name} on Bing Places and Apple Business Connect"
- **Steps:** 1. Claim each (Bing can import from GBP). 2. Copy the exact GBP details.
- **AI writes:** Step-by-step with the values to paste.
- **Priority:** Low-medium. Effort S. Grade C.
- **Done when / re-check:** Listing found (gap 3).
- **Evidence:** C. Copilot runs on Bing ([SEL](https://searchengineland.com/bing-webmaster-tools-testing-new-ai-performance-report-468039)); no study measures Bing Places or Apple impact on AI answers ([offsite notes](../../research_notes/GEO%20strategy%20playbooks/offsite_tactics.md)).

#### L3 · Yelp profile for Perplexity
- **Applies to:** local
- **Trigger:** `[Today]` yelp.com in the lost URL set (≥1 lost cell), OR ≥50% of `perplexity` category cells lost.
- **Title:** "Complete your Yelp page: Perplexity uses Yelp data and cites it in {n} answers"
- **Steps:** 1. Claim the page. 2. Fill services, hours, photos, amenities to match the fact sheet. 3. Include Yelp in the review program (L5) without asking for reviews in ways Yelp forbids.
- **AI writes:** Profile copy.
- **Priority:** Weight Perplexity cells ×1.5; ChatGPT cells ×0.5. Effort S.
- **Done when / re-check:** yelp.com no longer in lost cells / business named on Perplexity. Re-check day 2-7.
- **Evidence:** A/B. Perplexity licenses Yelp data ([Maginative, non-vendor](https://www.maginative.com/article/perplexity-enhances-ai-search-engine-with-direct-yelp-data-integration/)); Yelp ~9.5% of local citations ([BrightLocal](https://www.brightlocal.com/research/local-ai-visibility-study/)); Gemini never cited Yelp directly ([BrightLocal test](https://brightlocal.com/blog/ai-search-using-listings-sources)).

#### L4 · Make name, address and phone identical everywhere
- **Applies to:** local
- **Trigger:** `NEEDS: gap 3` (fetch GBP, Bing, Apple, Yelp, Facebook). Fires when any of them differs from `practices` + fact sheet. Today, mismatches surface only reactively through F8.
- **Title:** "Your {field} differs on {listings}: make them match"
- **Steps:** 1. Choose the one correct format. 2. Update each listing. 3. Remove duplicates.
- **AI writes:** A table of listing → current value → correct value.
- **Priority:** Low-medium baseline. Effort S-M.
- **Done when / re-check:** All fetched listings match.
- **Evidence:** B. Baseline, not a growth lever: NAP consistency #31 and directory count #40 in AI factors ([Whitespark](https://whitespark.ca/local-search-ranking-factors/)); but listings are 42% of local citations ([Yext](https://www.yext.com/blog/ai-citations-86-percent-of-sources-are-brand-managed)).

#### L5 · Run a steady, rule-following review program
- **Applies to:** local
- **Trigger:** `NEEDS: gap 4`. Google review count < 50% of the median count of rivals named first in lost local cells, OR rating < 4.0. Thresholds are product choices from the averages below, not published cut-offs. Fallback today: `addedWords` contains reviews/rated AND ≥2 lost cells.
- **Title:** "{name} has {count} reviews; the businesses AI names have about {rival_median}"
- **Steps:** 1. Ask every customer, with no screening: no "were you happy?" step first. 2. Send one direct review link by text/email within a day. 3. Never offer anything for a review, never write or AI-write reviews. 4. Reply to every review, factually (health: never confirm someone is a patient). 5. Add the 1-2 review sites AI cites for your vertical (S3).
- **AI writes:** The SMS/email ask (neutral wording, no sentiment steer), reply templates for 5-star, mixed and 1-star reviews.
- **Priority:** Gap ratio. Effort M. Recurring monthly.
- **Done when / re-check:** Never auto-closes; shows monthly progress (count, rating, months active). Becomes Confirmed when count ≥ rival median.
- **Evidence:** A/B. Visible businesses averaged 133 Google reviews vs 11 for invisible ([Insites](https://natlawreview.com/press-releases/new-study-10000-local-businesses-reveals-what-ai-actually-uses-decide-who)); recommended locations averaged 4.3/4.1/3.9 stars on ChatGPT/Perplexity/Gemini ([SOCi](https://soci.ai/news/in-ai-driven-discovery-few-brands-are-chosen-most-disappear/)). FTC rule bans fake, AI-written and sentiment-conditioned reviews, ~$51k per violation ([WSGR](https://www.wsgrdataadvisor.com/2024/08/ftc-issues-final-rule-banning-fake-and-misleading-consumer-reviews-and-testimonials/)); review gating killed by the Fashion Nova settlement ([Near Media](https://nearmedia.co/ftc-drops-a-4-2-review-abuse-fine/)). The "150-review threshold" is D; never use it.

#### L6 · Real service × area pages
- **Applies to:** local
- **Trigger:** `[Today, approx.]` ≥2 lost cells on category prompts naming a place (from `practices.location` / `forecast.area`) AND no `site.pages` title/URL containing both the service and that place.
- **Title:** "Create a {service} in {area} page: {rivals} are named in {n} answers"
- **Steps:** 1. Only for places you really serve. 2. Each page needs facts unique to that place (address or travel area, local team, local prices, local customer story). 3. No copy-paste pages with the city swapped.
- **AI writes:** Outline and opening paragraph; flags any section where it has no real local fact and asks the owner instead of inventing one.
- **Priority:** Cells × keyword value. Effort M. Max 2 open at once.
- **Done when / re-check:** Page found; own page cited for that place's prompts. First look day 16.
- **Evidence:** B. City/neighborhood relevance #6 AI factor ([Whitespark](https://whitespark.ca/local-search-ranking-factors/)); dedicated pages per area recommended ([iPullRank](https://ipullrank.com/local-ai-search-data)). ChatGPT invents local facts, so never auto-write them ([Sterling Sky](https://www.sterlingsky.ca/using-chat-gpt-for-local-content/)). Suburb-level prompts often name nobody ([Zarla](https://www.zarla.com/guides/does-chatgpt-recommend-local-businesses)).

#### L7 · Credential chain for regulated businesses
- **Applies to:** local (businessType clinic or legal)
- **Trigger:** `[Today, approx.]` businessType ∈ {clinic, legal} AND (an open `providers` finding, OR a credential directory from the S4 seed list appears in any citation this scan). Profile presence/accuracy: `NEEDS: gap 3`.
- **Title:** "Make {provider}'s credentials match on {directories}"
- **Steps:** 1. List each provider's exact name, title and license. 2. Update state board, Healthgrades/Vitals (health) or Avvo/Super Lawyers/FindLaw (legal) to match. 3. State credentials on each provider's page.
- **AI writes:** The credential line per provider and the directory checklist.
- **Priority:** Effort M. ×1.5 if an F9 finding exists.
- **Done when / re-check:** No `providers` findings for 2 scans; directories match (gap 3).
- **Evidence:** B. Healthcare is the most listing-dependent vertical (52.6%) ([Yext](https://www.yext.com/research/articles/ai-citations-user-locations-query-context/)); legal answers lean on Super Lawyers/FindLaw ([BrightLocal test](https://brightlocal.com/blog/ai-search-using-listings-sources)).

#### L8 · Local "best of" lists Google ranks but AI hasn't cited yet
- **Applies to:** local
- **Trigger:** `NEEDS: gap 12`. A listicle ranks top 10 in Google organic for "best {service} in {city}" (from the AIO SERP we already fetch) and omits the business. Complements S1, which only sees lists AI already cited.
- **Title:** "Get onto {page_title}: it ranks #{rank} on Google for "{query}""
- **Steps / AI writes / Done when:** Same as S1.
- **Priority:** As S1 × 0.7 (not yet cited by AI).
- **Evidence:** B/C. Shaw's method: search "best [keyword] in [city]" and work to get included ([via Uberall](https://uberall.com/en-us/resources/local-beat/master-local-seo-whitespark)); ChatGPT citations come mostly from its search channel ([Ahrefs](https://ahrefs.com/blog/why-chatgpt-cites-pages/)).

---

### O. Online / SaaS only

Listicle outreach for online businesses is **S1/S2**; Reddit is **S5**. They aren't repeated here.

#### O1 · A public pricing page with real numbers
- **Applies to:** online
- **Trigger:** `[Today]` (an F10 finding OR `addedWords` contains price/pricing/free/plan OR ≥2 lost cells on price prompts) AND no `site.pages` URL matching `/pricing|/plans/`, or that page has no currency amount (gap 6 for full text).
- **Title:** "Publish plan prices on /pricing: AI searched "{query}" and {rivals} show theirs"
- **Steps:** 1. Plans, prices, limits in plain HTML text. 2. Answer "Is there a free plan / trial?" in one line. 3. Redirect or noindex old pricing URLs. 4. Same numbers on G2/Capterra.
- **AI writes:** Pricing table copy from `pricing` facts and the free-plan FAQ line.
- **Priority:** ×1.5 if F10 open. Effort M.
- **Done when / re-check:** Price found on /pricing; price prompts cite it. First look day 4-11.
- **Evidence:** A. Price-not-mentioned gatekeeper ([arXiv 2605.25517](https://arxiv.org/pdf/2605.25517)); pricing 13.5% error rate ([Searchable](https://www.searchable.com/data/ai-brand-misinformation-report)). Conversion data on pricing pages conflicts ([TripleDart](https://www.tripledart.com/research/which-pages-do-llms-cite)).

#### O2 · "{name} vs {rival}" and "{rival} alternatives" pages
- **Applies to:** online
- **Trigger:** `[Today]` a rival in `rivals(cell)` for ≥2 lost cells (or the scan's top competitor) AND no `site.pages` URL/title containing that rival's name. Suppressed if the business set "no comparison content".
- **Title:** "Create "{name} vs {rival}": {rival} is named in {n} answers you're missing"
- **Steps:** 1. Verdict paragraph at the top: who should pick which. 2. Dated criteria table (price, features, integrations, best for). 3. An honest "where {rival} is better" section. 4. A separate "{rival} alternatives" page that links out fairly. 5. Slug /vs/{rival}. Refresh quarterly.
- **AI writes:** Verdict paragraph and table skeleton from the fact sheet; competitor cells marked "verify" (we don't store competitor facts).
- **Priority:** Cells × dominance. Effort M. Max 2 open at once.
- **Done when / re-check:** Page exists and is cited for comparison prompts, or the business is named against that rival. First look day 16.
- **Evidence:** B/C. Keep alternative pages separate from comparison pages ([Simmonds](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)); "no comparisons" cut citations ([arXiv 2605.25517](https://arxiv.org/pdf/2605.25517)). Vs pages bring citations, not leads: 1,027 sessions, 0 leads ([TripleDart](https://www.tripledart.com/research/which-pages-do-llms-cite)).

#### O3 · Integration and use-case pages for long questions
- **Applies to:** online
- **Trigger:** `[Today, approx.]` ≥2 lost cells whose prompt names an audience ("for {audience}"), an integration ("with/integrates {tool}") or ≥15 words, AND no `site.pages` title/URL containing that audience or tool.
- **Title:** "Create a page for {audience_or_integration}: AI names {rivals} for "{prompt}""
- **Steps:** 1. One page per real audience or integration. 2. First paragraph says who it's for and what it does for them. 3. Or a help-center article for the exact multi-part question.
- **AI writes:** Page outline and first paragraph; help article draft.
- **Priority:** Cells. Effort M.
- **Done when / re-check:** Page exists and is cited. First look day 16.
- **Evidence:** C. Help-center content as possibly highest-ROI; AI prompts average 25+ words ([Graphite/Ethan Smith](https://graphite.io/five-percent/the-ultimate-guide-to-aeo-on-lennys-podcast); [Reforge](https://www.reforge.com/blog/aeo-playbook)). Solution pages per use case ([Simmonds](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)).

#### O4 · G2 / Capterra / GetApp profile and review asks
- **Applies to:** online (B2C: App Store/Trustpilot where cited)
- **Trigger:** `[Today]` g2.com, capterra.com, getapp.com or trustradius.com in the lost URL set (≥1 lost cell). Profile/review count: `NEEDS: gaps 3-4`.
- **Title:** "Build your {platform} profile: AI cites it in {n} answers where {rivals} are named"
- **Steps:** 1. Claim and complete the profile and category. 2. Ask for a review right after a success moment (not tied to a high score only; no incentive tied to sentiment). 3. One owner reports count and recency monthly.
- **AI writes:** Profile copy; the in-product review ask.
- **Priority:** Cells. Effort M. Recurring.
- **Done when / re-check:** Profile live; platform no longer only in lost cells.
- **Evidence:** B. G2 cited 15-20% in ChatGPT/Perplexity/Claude ([Foundation/AirOps](https://www.airops.com/blog/b2b-ai-discovery-playbook-lessons-ross-simmonds)); GetApp ahead of G2 in one study ([Hall](https://usehall.com/guides/review-platform-ai-citation-analysis)). Conflict: review sites 0.9% of citations in another ([DerivateX](https://derivatex.agency/report/b2b-saas-ai-citation-study/)). Review count alone is weak, R² ~0.009 ([G2](https://learn.g2.com/do-more-g2-reviews-mean-more-ai-visibility)).

#### O5 · Get creators to review the product
- **Applies to:** online
- **Trigger:** `NEEDS: gaps 1-2`. YouTube videos cited in lost cells are third-party reviews or "best X tools" videos naming rivals.
- **Title:** "Offer {creator} access: their video "{video_title}" is cited and names {rivals}"
- **Steps:** 1. Find creators who review your category. 2. Offer free access; any paid deal must be disclosed in the video.
- **AI writes:** The creator outreach message.
- **Priority:** Cells. Effort L.
- **Done when / re-check:** Owner marks Done; re-check video citations in 2-3 weeks.
- **Evidence:** A (correlation) for YouTube mentions ([Ahrefs](https://ahrefs.com/blog/ai-brand-visibility-correlations)); creator seeding tactic C ([saas notes](../../research_notes/GEO%20strategy%20rules%20from%20practitioners/saas_practitioners.md)).

#### O6 · Keep owned profiles consistent (LinkedIn, Crunchbase, Product Hunt, app stores)
- **Applies to:** online
- **Trigger:** `[Today, approx.]` linkedin.com, crunchbase.com, producthunt.com, apps.apple.com or play.google.com cited in branded or buyer answers this scan. Field accuracy: `NEEDS: gap 1`.
- **Title:** "Rewrite your {platform} description: AI quotes it about {name}"
- **Steps:** 1. Same one-sentence description as the homepage (P11). 2. Same category, pricing model, founding facts.
- **AI writes:** Profile descriptions per platform.
- **Priority:** Low-medium. Effort S.
- **Done when / re-check:** Profile matches fact sheet (gap 1).
- **Evidence:** C. AI cites owned profiles; rewrite them as brand copy ([Reforge](https://www.reforge.com/blog/aeo-playbook)). Crunchbase/LinkedIn named as knowledge bases engines use ([Everything PR](https://everything-pr.com/how-to-correct-ai-misinformation-about-your-company)).

---

### M. Memory and long-term brand mentions

For answers an engine gives **without searching**. These change only when a new model ships, so they never block other work and never auto-reopen.

#### M1 · Build mentions on the sites engines read
- **Applies to:** both (weighted to online; local answers search more)
- **Trigger:** `[Today, approx.]` business absent in ≥50% of memory runs for category prompts while a rival is named in them. Exact search-off baseline: `NEEDS: gap 8`.
- **Title:** "ChatGPT names {rivals} from memory, not you: a 6-12 month mention plan"
- **Steps:** 1. Take the top domains from the lost URL set. 2. Each month aim for one mention there: a guest piece, a podcast, an expert quote, original data (M3). 3. Track mentions monthly.
- **AI writes:** A 3-month target list (domains from this scan) with one angle per domain.
- **Priority:** Low score but always kept under "Later" when triggered. Effort L.
- **Done when / re-check:** Business named in ≥30% of memory runs (product choice). Re-check monthly.
- **Evidence:** A (correlation). Branded web mentions correlate 0.664 with AIO visibility vs 0.218 for backlinks ([Ahrefs, 75k brands](https://ahrefs.com/blog/ai-overview-brand-correlation/)); 6 in 7 ChatGPT answers didn't search ([Ahrefs](https://ahrefs.com/blog/query-fan-out-chatgpt/)). Forcing search shifts measured visibility ~20 points ([Graphite](https://graphite.io/five-percent/research/do-not-force-search-prompt-tracking)).

#### M2 · Wikidata item (and Wikipedia only through the proper process)
- **Applies to:** both
- **Trigger:** `[Today]` wikipedia.org or wikidata.org cited in any branded or lost run, OR an F5 namesake exists. Notability is an owner question, asked in the task.
- **Title:** "Create or fix {name}'s Wikidata entry (only if independent coverage exists)"
- **Steps:** 1. Check you have independent press coverage. 2. Create/fix the Wikidata item with location, founding date, website and sources. 3. Never edit or pay someone to edit your Wikipedia article; propose changes on the talk page with disclosure.
- **AI writes:** Wikidata property list with sources; a disclosed talk-page request if needed.
- **Priority:** Low. Effort M.
- **Done when / re-check:** Owner marks Done. No auto-close.
- **Evidence:** C. Fixing Wikidata may matter more than chasing Wikipedia ([Frontline](https://www.frontlinesourcegroup.com/blog-frontline-source-group-wikidata-ai-search.html)); COI and paid-editing rules ([Wikipedia COI](https://en.wikipedia.org/wiki/Wikipedia:Conflict_of_interest); [Paid disclosure](https://en.wikipedia.org/wiki/Wikipedia:Paid-contribution_disclosure)). "Wikidata = 2.7x citations" is unsupported (D).

#### M3 · Publish one piece of original data
- **Applies to:** both (mostly online)
- **Trigger:** `[Today]` ≥3 lost cells on informational prompts across ≥2 engines AND no own-domain citation on any informational prompt.
- **Title:** "Publish a "{topic} benchmark" others can quote"
- **Steps:** 1. Pick data only you have (pricing trends, customer survey, usage stats). 2. Publish it as a "which is best / what it costs" benchmark with a date. 3. Send it to the domains in M1.
- **AI writes:** Three data-piece ideas from the business's facts and an outline.
- **Priority:** Low. Effort L.
- **Done when / re-check:** Owner marks Done; own page cited on informational prompts within 30 days.
- **Evidence:** B/C. First-party research earns 3.3x more citations; benchmark format dominates (snippet only) ([Growth Memo](https://www.growth-memo.com/p/why-most-original-data-never-gets)). Fabricated stats raise reuse but hurt accuracy ([arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)).

#### M4 · Don't block training crawlers if memory matters
- **Applies to:** both
- **Trigger:** `NEEDS: gap 13` (store robots.txt). robots.txt blocks GPTBot or Google-Extended AND M1 fires.
- **Title:** "You block {bots}: future models learn less about {name}"
- **Steps:** 1. Decide deliberately: blocking stops training use, not live answers. 2. If memory visibility matters, allow them.
- **AI writes:** The robots.txt change and a one-paragraph trade-off note.
- **Priority:** Low. Effort S.
- **Done when / re-check:** robots.txt re-check.
- **Evidence:** A (official). GPTBot governs training only ([OpenAI](https://developers.openai.com/api/docs/bots)); Google-Extended limits training/grounding in other Google systems ([Google](https://developers.google.com/search/docs/appearance/ai-features)).

---

## 4. Priority formula

### Score (for everything not overridden)

```
score = 100 × Reach × Spread × Dominance × Value × Grade ÷ Effort
```

| Input | Formula | Notes |
|---|---|---|
| **Reach** | `0.3 + 0.7 × min(cells / 6, 1)` | `cells` = distinct lost cells the task addresses (S: cells citing the URL; F: runs repeating the finding, needs gap 9, today = 1) |
| **Spread** | `0.3 + 0.7 × engines_affected / engines_in_scan` | Engines weighted equally (product choice until we have outcome data) |
| **Dominance** | `0.5 + 0.5 × top_rival_share` | `top_rival_share` = share of the task's cells where the single most frequent rival is in the top 3 of `named_order` |
| **Value** | mean over affected prompts: category 1.0, informational 0.6, branded 0.8; ×1.25 if the prompt matches a `forecast.keywords` term in the top third by volume × CPC | |
| **Grade** | A 1.0 · B 0.8 · C 0.6 · D never generated | Fallback heuristic triggers `[Today, approx.]` get ×0.8 |
| **Effort** | S = 1 (under an hour, owner alone) · M = 2 (a day, or needs the web person) · L = 4 (weeks, or needs a third party) | Recurring tasks use effort per attempt |

Rule modifiers stated in each rule (e.g. F10 ×1.5, Reddit only on ChatGPT ×0.5) multiply the score.

### Overrides (applied before the score)

1. **Fix first, fixed order:** B1 fail → F7 → F8 (phone/address) → F9 (legal, credential level) → any finding with `severity='critical'` → B2 fail → B3 (no index at all). Max 5 shown; if more, the rest go to the top of "Fix wrong facts".
2. **Dependencies:** while B1 or B2 is open, P/S/L/O tasks for the engines it blocks are shown as "after {B-task}" and lose 50% score.
3. **Business constraints:** owner settings "no comparison content" (suppresses P5, O2) and "no paid placements" (S1 never suggests paid lists) ([LLM Pulse](https://llmpulse.ai/help-center/recommendations)).
4. **Market:** L rules never show for online; O rules never for local. Unset market → neither, plus a one-line prompt to set it.
5. **In progress always visible** and never pushed to "Later".
6. **Recurring outreach** (S1, S5, S7, O4, L5) re-arms 4-6 weeks after Done if the source still omits the business, matching citation half-lives ([Scrunch](https://scrunch.com/blog/half-life-of-ai-citations)).

### How many show at once

- **Visible:** at most **10** tasks across all three sections (Fix first counts against it).
- Within "Get recommended more": max **2 per rule ID**, max **3 outreach tasks** (S, L5, O4, O5) at once, and at least **1 own-site (P/L6/O1-O3) task** when one qualifies.
- Everything else goes under **"Later"**, sorted by score.
- Agencies' re-measure horizon is 3-4 weeks, so a visible task stays visible for at least 3 scans unless closed ([Superlines](https://superlines.io/articles/90-day-geo-plan-ai-search-visibility)).

### Thin data: fewer tasks, never generic ones

- A cell-based task needs **≥2 lost cells** (each ≥2 of 3 runs). One run never creates a task.
- If the scan has **<6 buyer prompts, <3 engines answering, or `coverage` is partial**: cap visible at **5**.
- A rule whose trigger isn't met is never shown, even if the list is short. If fewer than 3 tasks qualify, show "That's everything this scan supports. Next scan: {date}."
- "Setup check" fallbacks (L1 today) appear at most once and are labelled as such.
- Thin data producing a short list or none is the documented best practice ([LLM Pulse](https://llmpulse.ai/help-center/recommendations)).

---

## 5. Re-check schedule

**Confirmation rule for every task:** the fixed state shows in **≥2 of 3 runs on two consecutive checks** → Confirmed ([MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/)). A "Done" task that hasn't confirmed by its give-up day goes back to **In progress** with "Not picked up yet: {likely reason}" and a re-diagnosis.

### By engine (median days until a page edit shows up)

| Engine | Median days | Never by day 45 | Source |
|---|---|---|---|
| Perplexity | 2 | 9% | MaxAEO (B, SaaS pages only) |
| Claude | 7 | 15% | MaxAEO |
| Copilot (not scanned) | 8 | 17% | MaxAEO |
| Google AI Overviews / AI Mode | 9 (AIO) | 16% | MaxAEO |
| ChatGPT (search) | 11 | 20% | MaxAEO |
| Gemini | 13 | 24% | MaxAEO |
| Grok | no data | — | — |
| Any engine, from memory | next model release (months) | — | [MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/) |

### By fix type

| Fix type | Rules | First check | Expect | Escalate | Re-diagnose / give up |
|---|---|---|---|---|---|
| robots.txt unblock | B1, M4 | same day (re-fetch) | ChatGPT ~24h ([OpenAI](https://developers.openai.com/api/docs/bots)); Google days to months ([Google](https://developers.google.com/search/docs/appearance/ai-features)) | — | day 30 |
| Fact swap on an already-cited own page | F1, F10, P8 | day 4 | median 4 days | day 30 | day 45 |
| New Q&A / FAQ section | F4, F6, P10 | day 8 | median 8 days | day 30 | day 45 |
| New page or rewrite / new URL | P1-P7, P11, L6, O1-O3, S8 | day 16 | median 16 days; 22% unchanged at 45 | day 30 | day 45 |
| Third-party correction (article, list) | F3, S2 | day 14 | median 33 days; 41% never by 45 | day 33 | day 45 |
| Listing / profile edit | F2, F8, L1-L4, L7, S3, S4, O4, O6 | day 7 | days; AIO ~9-day median | day 30 | day 45 |
| Closure / legal | F7, F9 | every scan | weeks in documented cases | day 14 (press) | none: stays open |
| Namesake | F5, M2 | day 14 | weeks to months | day 45 | day 90 |
| New list placement / press / video | S1, S5-S7, L8, O5 | day 7 | Perplexity 1-7, ChatGPT 3-14, AIO 14-21 days (C, [AuthorityTech](https://authoritytech.io/blog/earned-media-ai-citation-timeline-2026)) | — | re-arm at 4-6 weeks |
| Reviews program | L5, O4 | monthly | no timing data | — | never closes |
| Memory | M1, M3 | monthly | model release cycle | — | never reopens |

Fact-swap, Q&A, rewrite and third-party figures: [MaxAEO, 312 edits](https://maxaeo.ai/blog/how-long-ai-updates-answers/). Escalate at day 30 and re-diagnose at day 45 follows the fact-correction playbook ([fact notes](../../research_notes/GEO%20strategy%20playbooks/fact_correction.md)).

---

## 6. Never-do list

The product never generates these tasks, and the AI writer refuses to draft them.

| Never | Why | Source |
|---|---|---|
| **llms.txt as a visibility lever** | 97% of llms.txt files got zero requests; no effect on citations across ~300k domains. Google says no AI text files are needed. | [SEJ/Ahrefs](https://www.searchenginejournal.com/97-of-llms-txt-files-got-no-requests-ahrefs-data-shows/579478/); [SEJ/SE Ranking](https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/); [Google](https://developers.google.com/search/docs/appearance/ai-features) |
| **Schema as magic** | Adding JSON-LD gave −4.6% on AIO and no significant change elsewhere; Google says no special schema is needed. Hygiene only (P11, F5). | [Ahrefs](https://ahrefs.com/blog/schema-ai-citations/); [Insites](https://natlawreview.com/press-releases/new-study-10000-local-businesses-reveals-what-ai-actually-uses-decide-who) |
| **"Rewrite for the LLM" / stat-stuffing** | The "+40%" GEO result didn't replicate (3 of 54 tests significant); body rewriting cut retrieval ~9% in SAGEO Arena. | [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1) |
| **Mass AI-generated pages** | Page count correlates ~0.19; practitioners call AI-generated content ineffective; sites with mass "best X"/"alternatives" pages saw 30-50% visibility drops. | [Ahrefs](https://ahrefs.com/blog/ai-brand-visibility-correlations); [Lenny's/Ethan Smith](https://www.lennysnewsletter.com/p/the-ultimate-guide-to-aeo-ethan-smith); [seo-day.de/Lily Ray](https://www.seo-day.de/news/article/self-promotional-content-worksuntil-it-backfires-ai-seo?lang=en) |
| **Doorway pages (city-swapped copies)** | Google spam-policy risk; AI also invents local facts. L6 requires real local facts. | [local notes](../../research_notes/GEO%20strategy%20rules%20from%20practitioners/local_practitioners.md); [Sterling Sky](https://www.sterlingsky.ca/using-chat-gpt-for-local-content/) |
| **Fake, AI-written, gated or sentiment-incentivised reviews** | FTC rule (Oct 2024), ~$51k per violation; gating prohibited by Google and targeted by the FTC. | [WSGR](https://www.wsgrdataadvisor.com/2024/08/ftc-issues-final-rule-banning-fake-and-misleading-consumer-reviews-and-testimonials/); [Near Media](https://nearmedia.co/ftc-drops-a-4-2-review-abuse-fine/) |
| **Scripted review wording ("mention the service and city")** | No measured evidence it helps; scripted wording risks looking fake. | [local notes R12](../../research_notes/GEO%20strategy%20rules%20from%20practitioners/local_practitioners.md) |
| **Undisclosed Reddit/forum posting, alt accounts, vote buying** | Breaks Reddit rules, permanent bans, FTC endorsement exposure; the community policing is why engines trust Reddit. | [Graphite](https://graphite.io/five-percent/the-ultimate-guide-to-aeo-on-lennys-podcast); [offsite notes](../../research_notes/GEO%20strategy%20playbooks/offsite_tactics.md) |
| **Paid or undisclosed Wikipedia edits** | Violates Wikimedia terms and COI guideline; gets reverted. | [Wikipedia paid disclosure](https://en.wikipedia.org/wiki/Wikipedia:Paid-contribution_disclosure); [COI](https://en.wikipedia.org/wiki/Wikipedia:Conflict_of_interest) |
| **Self-serving "we're #1" lists** | ~69% of the time the cited self-promotional list's brand was left out of the recommendation; 43% of answers citing such pages never named the product; treated as spam by Google/Microsoft per Lily Ray. | [seo-day.de](https://www.seo-day.de/news/article/self-promotional-content-worksuntil-it-backfires-ai-seo?lang=en); [Ahrefs experiment](https://ahrefs.com/blog/self-promotional-content-ai-seo-experiment/) |
| **Undisclosed paid list placements** | No evidence engines reward them; disclosure required. | [MADX](https://www.madx.digital/learn/get-featured-in-best-software-lists); [playbooks report](../../reports/GEO%20strategy%20playbooks.md) |
| **Date bumps without real edits** | Changing only the date did nothing. | [MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/) |
| **Daily GBP posts "for AI"** | Post frequency neutral-to-negative; a Whitespark myth. | [Search Atlas](https://searchatlas.com/blog/how-llms-rank-local-business/); [Whitespark](https://whitespark.ca/local-search-ranking-factors/) |
| **Promising a rank or a date** | Lists repeat <1% of the time; sell trend, not rank. | [SparkToro via SEL](https://searchengineland.com/ai-recommendation-lists-rarely-repeat-study-468076) |

---

## 7. Existing `build-report.ts` actions → new rules

| Existing action (`build-report.ts`) | Verdict | New rule(s) | Note |
|---|---|---|---|
| "Fix your price everywhere it appears" (`priceWrong`) | Replace | F10 on top of F1-F6; P1/O1 | Price now attaches to the root-cause task |
| "Correct the wrong facts at their source" (`otherWrong`) | Replace | F1-F9 | One task per finding, routed by source; replaces `fixAdvice` one-liner |
| `CHECK_ACTION.ai_allowed` "Let AI assistants read your site" | Keep | B1 | Add path-level check (gap 13) |
| `CHECK_ACTION.readable_text` | Keep | B2 | |
| `CHECK_ACTION.facts_page` "Add a plain facts page" | Replace | P11 | Check is URL regex only; P11 also checks the homepage summary |
| `CHECK_ACTION.contact_visible` | Replace | P11 (online), P11 + L4 (local) | |
| `CHECK_ACTION.sitemap` | Keep, demote | B4 | Low priority |
| `CHECK_ACTION.machine_labels` "Label your prices and FAQs for machines" | **Drop** | (step inside P11) | Schema showed no causal lift |
| `CHECK_ACTION.business_schema` | **Drop** | (step inside P11, F5) | Same |
| "Get featured on {domains}" (`sources.gaps`) | Replace | S1-S8, L3, O4 | One task per URL by page type, naming rivals |
| `OUTREACH_ASK` table | Replace | "AI writes" of S/L/O rules | |
| "Turn your closest calls into wins" (`closestWins`) | **Drop** | becomes Dominance/Reach input | Rank is unstable; not a task by itself |
| "Add {page}" (`pagesWanted` / `PAGE_FOR_WORD`) | Replace | P10 router → P1, P5, P7, P11, L5, O1, O2 | |
| "Answer the complaint AI repeats" (negative/mixed tone) | Keep (reworded) | S9 | Now names the caveat text and source |
| "Make your site a source AI quotes" (`ownSiteRate < 0.2`) | Replace | P9 | Per prompt, not one site-wide rate |
| "Get named on {tools}" (silent engines) | **Drop** | engine routing inside L1 (Google), L3 (Perplexity), B3 (Copilot/Claude via Bing/Brave), M1 (memory) | A task must say what to do, not which engine |
| `plan90` static text | **Drop** | Strategy page itself | |
| `fixAdvice` in `src/core/fix-list.ts` | Replace | F1-F4 routing | Keep its own-site detection as the F1 test |

---

## 8. Data gaps: what to build, in order

Value: high = 3, med = 2, low = 1. Effort: S = 1, M = 2, L = 4. Ordered by value ÷ effort, ties broken by number of rules unblocked.

| # | Gap (from audit_inventory) | Rules it blocks or weakens | Minimum build | Effort | Value | V÷E |
|---|---|---|---|---|---|---|
| 11 | Local vs online only inferred | All L and O rules; M1 weighting | Add `practices.market` enum (`local`/`online`), prefill from `forecast.businessType`, operator confirms in admin | S | high | 3.0 |
| 9 | Findings lack repeat count and supporting citation | F1-F10 (Reach, routing), Section 4 | On each finding, store `seenIn[]` = (engine, run, check_id) for every check repeating it, union of their `citations`, and the judge's one-line `why` | S | high | 3.0 |
| 7 | Which competitor owns which source; no competitor domains | S1-S8 (Dominance), S8 exact, O2 | Compute per URL: rivals named in answers citing it (co-occurrence, already derivable). Add `competitors.domain` (prefill by searching "{name} {city}" once) | S | high | 3.0 |
| 5 | Own pages cited for which questions not reported | P9, P3, P2 target selection | Compute from `checks`: own-domain URL → prompts, engines, runs. Store on the scan | S | high | 3.0 |
| 15 | Prospect scans judge against unreviewed facts | All F rules on prospects | Save website-drafted facts as `draft`; F rules skip `draft` facts except F7-F9 | S | high | 3.0 |
| 12 | Google organic results discarded | L8, B3 (Google), P3 | Keep top-20 organic URLs + titles from the AIO SERP call already made | S | med | 2.0 |
| 1 | Cited pages never fetched | S1, S2, S3, S4, S7, S8, F3, O5, O6, L8 | Fetch each unique cited URL once per scan (cache 14 days): store HTTP status, title, visible/updated date, whether the business (any name variation) and each competitor are named, the business's list position, and whether it links to the own domain | M | high | 1.5 |
| 2 | No page type for cited URLs | S1-S8, O5 precision | Classify each fetched URL into listicle / review profile / directory / thread / video / article / competitor page / reference: URL rules first, LLM on title + first 2k chars as fallback. S once gap 1 exists | M (S after #1) | high | 1.5 |
| 6 | Own pages not checked for prices, dates, answer-first, title match | P1, P2, P3, P4, P7, P8, O1 | Store per-page text for checked pages; extract price regex, visible date + sitemap `lastmod`, meta description, first-30% term match against the target prompt, title similarity | M | high | 1.5 |
| 13 | Path-level robots ignored; no Bing check; ≤8 pages by URL pattern | B1 (paths), B3, M4, P6 | Store raw robots.txt and evaluate per bot per key page; `site:` check on Bing (and Brave); read `noindex`/`nosnippet`; choose pages = own pages cited + pages matching services/prompts (up to 20) | M | high | 1.5 |
| 3 | No GBP / Bing Places / Apple / Yelp / G2 checks | L1, L2, L3, L4, L7, S3, S4, O4 | Google Places lookup by name + address (status, categories, hours, phone, website); Yelp lookup; G2/Capterra by URL fetch. Bing/Apple: presence only | L | high | 0.75 |
| 4 | No review counts or ratings | L5, O4, S3 | Comes with gap 3: rating + review count for the business and each rival named first in lost local cells | M (with #3) | high | 1.5 (after #3) |
| 8 | No memory (search-off) baseline | M1, F4 (diagnosis), M4 | One extra run per category prompt on OpenAI and Anthropic with web search disabled; store `searchMode` on the check | S-M | med | 1.0-2.0 |
| 14 | AI Overviews thin | S1/S6 (AIO weighting), L1 | Store AIO cited URLs into the lost URL set, business position, and new names (competitor discovery) | M | med | 1.0 |
| 10 | No search queries from Perplexity / AI Mode | P10, P3 | Can't get from those APIs; infer from cited page titles once gap 1 exists | L | low | 0.25 |

Gap 4 is listed at 1.5 only once gap 3 exists; standing alone it inherits gap 3's L effort.

---

## 9. Where the research contradicts the operating manual (Doc 04)

1. **"ChatGPT looks at Bing + its own crawler."** Disputed: Profound reports ChatGPT's Bing alignment falling 26%→8% while Google rose 12%→33%, and 6 in 7 ChatGPT answers don't search at all ([engine notes](../../research_notes/GEO%20strategy%20playbooks/engine_source_selection.md); [Ahrefs](https://ahrefs.com/blog/query-fan-out-chatgpt/)). Bing stays a cheap step (B3), not the ChatGPT pathway.
2. **"Yelp first… 3.4× local AI citation dominance."** No source in the notes supports 3.4×. Yelp is ~9.5% of local citations; Perplexity licenses Yelp, Gemini never cited it directly ([BrightLocal](https://www.brightlocal.com/research/local-ai-visibility-study/); [BrightLocal test](https://brightlocal.com/blog/ai-search-using-listings-sources)). Yelp is engine-specific (L3); GBP leads for Google surfaces (L1).
3. **"GBP Q&A seeded with 5 real questions."** Google removed public GBP Q&A from ~Dec 2025 in favour of Ask Maps ([PPC Land](https://ppc.land/google-quietly-kills-q-a-for-an-ai-button-most-wont-use/)).
4. **"Statistics lifted citation odds ~41%."** Lab-only and not replicated (C-SEO Bench: 3 of 54 significant); rewriting for the LLM can cut retrieval ([arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)).
5. **FAQPage schema one-click + Chunk Engineer as part of the content formula.** Formatting changes had no effect in a controlled test; schema gave −4.6% on AIO ([arXiv 2605.25517](https://arxiv.org/pdf/2605.25517); [Ahrefs](https://ahrefs.com/blog/schema-ai-citations/)). Keep FAQ *content*, drop format work as a lever.
6. **"Ask happy patients to mention the treatment and injector by name."** Asking only happy customers is review gating (Google policy, FTC target), and scripted wording has no measured benefit ([Near Media](https://nearmedia.co/ftc-drops-a-4-2-review-abuse-fine/); local notes R8, R12). L5 asks everyone with neutral wording.
7. **"Own treatment pages supplied ~60% of citations in the medical vertical."** Yext's healthcare data shows listings at 52.6%, the most listing-dependent vertical ([Yext](https://www.yext.com/research/articles/ai-citations-user-locations-query-context/)). The notes don't contain the 60% study.
8. **"Listings block = highest ROI in the engagement."** Whitespark's experts put best-of lists #1 and NAP consistency #31 / directory count #40; listings are a baseline, not the growth lever ([Whitespark](https://whitespark.ca/local-search-ranking-factors/)). Notes disagree on weight: listings are still 42% of local citations ([Yext](https://www.yext.com/blog/ai-citations-86-percent-of-sources-are-brand-managed)).
9. **"Re-run the triggering prompt 2 weeks post-fix."** One check isn't enough: medians range 2-13 days by engine, 16% of edits never show by day 45, and confirmation needs 2-of-3 runs on two consecutive checks ([MaxAEO](https://maxaeo.ai/blog/how-long-ai-updates-answers/)). See Section 5.
10. **"Pay-to-play directories cited by engines: present cost as a line item."** No evidence either way on paid lists; MADX says models discount them; any paid placement must be disclosed ([MADX](https://www.madx.digital/learn/get-featured-in-best-software-lists)). Allowed only when the owner opts in, always disclosed.
11. **"Bing Places: it's always unclaimed."** No study measures Bing Places' effect on AI answers; keep it as a cheap C-grade step (L2), not a core lever.
