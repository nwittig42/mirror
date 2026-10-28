# What the audit collects today (code inventory, 2026-10-14, branch feat/general-backend)

## Existing to-do generator
- `src/report/build-report.ts:271-330` builds an `actions` array from: wrong facts, failed website checks, competitor-only sources, near misses, missing pages AI searched for, negative/mixed tone, low own-site citation rate, engines that never name the business. Lookup tables `CHECK_ACTION`, `OUTREACH_ASK` (:39-46), `PAGE_FOR_WORD` (:99-106). `plan90` (:411-422) is static text.
- `src/core/fix-list.ts` `fixAdvice`: one-line advice from first 3 cited domains of a finding's check.

## Business profile (`practices`)
- name, slug, website (single URL = "own site"), category (free text), location (free text), logo, plan.
- Local vs online: NO flag. Only proxy is `practices.forecast.businessType` (AI-guessed: home_services, clinic, legal, b2b_software, freemium, ecommerce, other) and `forecast.area`.
- `name_variations` table. Competitors table: name, source (operator|discovered), status. NO competitor website/domain stored.
- `forecast.keywords`: 12-40 search terms with Google volume + CPC (DataForSEO).

## Prompts
- 10 AI-drafted: 5 category (city, per-service, comparison), 3 informational, 2 branded. Fallback 6 (no informational).
- Branded prompts only used for fact-checking; excluded from visibility, sources, search report.
- No user location sent to engines; city is in the question text. DataForSEO = whole US.

## Engines (each prompt × engine × 3 runs; one `checks` row per run)
| Engine | Search | Citations | Search queries |
|---|---|---|---|
| OpenAI gpt-5.1 | model decides | full URLs, only content[0] | yes |
| Anthropic | model decides, max 3 searches | full URLs | yes (≤3) |
| Gemini | model decides | mostly domain root only (path lost) | yes |
| Perplexity sonar-pro | always | full URLs; titles/dates ignored | none |
| Grok (if key) | model decides, web + X | full URLs | yes |
| Google AI Mode (DataForSEO) | always | full URLs | none |
- Google AI Overviews: separate, non-branded only, one search per question, competitors matched only against list known at scan start; organic SERP results discarded.

## Per answer (`checks`)
answer_text, citations (flat URL list, no title/rank/which business it supports), search_queries, mentioned, position (first/top3/mentioned/absent, by order of appearance), competitors_mentioned, named_order, tone (only when named), facts_confirmed.

## Wrong facts (`findings`)
claim, fact, severity (critical/major/minor), status, lastSeenScanId, workStartedAt, note. Points to ONE representative check. NOT stored: judge's "why", how many engines/runs repeated it, which citation supports it. Source bucket (own_site / listing / elsewhere / memory) computed at read time from that one check's citations; "memory" = no citations.
- Bug-ish: prospect setup saves website-drafted facts as `active` (prospect-setup.ts:129-133), so first scans judge against unreviewed facts.

## Website check (own site only, ≤8 pages, no JS rendering)
7 checks: ai_allowed (whole-site robots blocks only), readable_text (homepage length), facts_page (URL/title regex only, content not read), machine_labels (schema types), sitemap (exists only), business_schema, contact_visible. Stores homepageText (8k chars). Not stored: per-page text, schema inventory, robots content, sitemap lastmod.

## Read-time reports
- Sources report: domain-level, 6 kinds (own_site, reviews, social, reference, google, other) via hard-coded domain list. Reddit/YouTube/LinkedIn all "social"; G2/Yelp/BBB all "reviews". `gaps` = domains cited where a competitor was named and not the business, but NOT which competitor.
- Search report: queries per non-branded answer, `addedWords` (words AI added: "price", "reviews", "2026", etc.).

## Gaps (verified)
1. Cited pages are never fetched: can't tell if business/competitor is actually on a cited listicle or directory.
2. No page type for cited URLs (listicle / review profile / directory / thread / video / article / competitor site); no titles.
3. No Google Business Profile, Bing Places, Apple, Yelp, G2 checks.
4. No review counts or ratings anywhere.
5. Which own pages get cited, for which questions: data exists in checks, not reported.
6. Own pages not checked for prices in text, dates/freshness, answer-first, title/URL match to questions.
7. Which competitor owns which source: derivable per answer (co-occurrence), not computed; no competitor domains.
8. No "memory" (search-off) baseline; can't tell if ChatGPT answered from training data.
9. Findings don't record repeat count across engines/runs or the supporting citation.
10. Uneven search-query coverage (Perplexity, Google AI Mode none).
11. Local vs online only inferred.
12. Google organic rankings received but discarded.
13. Website check: path-level robots ignored; no Bing indexing check; ≤8 pages chosen by URL pattern.
14. AI Overviews thin (no discovery, no position, not in plan).
15. Prospect scans judge against unreviewed facts.
