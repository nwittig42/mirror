# Mirror AI Visibility Audit report: build handoff

This folder is everything needed to build the Mirror audit report into a codebase. The report shows a local business how AI assistants (ChatGPT, Claude, Gemini, Grok and Perplexity) talk about it, and what to fix.

It is written for Claude Code (or any developer). Start with **section 1** below, then build page by page using **section 5**.

---

## 1. How to use this folder

Paste this into Claude Code from the root of your app, with this folder copied into the repo:

> Read `mirror-audit-report/HANDOFF.md` and build the audit report into this codebase. Use `src/types.ts` as the data model, `src/scoring.ts` for all derived values, and `src/tokens.ts` or `src/tokens.css` for every color and font. Render all three variants (master, visibility, factcheck) from `data/sample-audit.json`. The files in `reference/design-source/` are the approved designs: match their layout, spacing and copy. Each page is a fixed US Letter sheet and has to export to PDF. Run `src/scoring.test.ts` first and keep it passing.

### What's in the folder

| Path | What it is |
|---|---|
| `HANDOFF.md` | This spec. |
| `src/types.ts` | TypeScript data model. One `AuditReport` object feeds all 3 variants. |
| `src/scoring.ts` | Pure functions: score maths, color bands, sort orders, headlines, page lists per variant. |
| `src/scoring.test.ts` | 13 sanity checks against the sample data (`npx tsx src/scoring.test.ts`). All pass. |
| `src/tokens.ts` / `src/tokens.css` | Design tokens: colors, fonts, type sizes, radii, page size. Same values in both files. |
| `data/sample-audit.json` | Full Glow MedSpa sample that matches `types.ts`. |
| `reference/design-source/*.dc.html` | The approved design, one file per page (21 pages). See section 8 to read them. |
| `reference/design-source/canvas.json` | Which page belongs to which variant, in order. |
| `tsconfig.json` | Only for type-checking this folder. |

**Stack:** nothing here is tied to a framework. The designs are plain HTML plus inline styles, so they translate directly to React/JSX, Vue or server-rendered HTML. Recommended approach: one component per page, a shared `<ReportPage>` wrapper, and PDFs made by printing the rendered route in headless Chromium (see section 9).

---

## 2. The three report variants

All three come from the same `AuditReport` data. Only the page list changes (`variantPages` in `scoring.ts`).

| Variant | Id | Pages | What it covers | What it leaves out |
|---|---|---|---|---|
| **Master report** | `master` | 12 | Everything. | Nothing. |
| **Visibility snapshot** | `visibility` | 5 | How often AI names you, where you rank, who beats you, tone, where AI looks. | All true/false fact checking, the website check and the method page. |
| **Fact check** | `factcheck` | 4 | What AI says about the business and whether it's true, where the errors come from, how to fix them. | Rankings, competitors, question grid, tone. |

### Page manifest

| # | Page id | Design file | Sections on the page |
|---|---|---|---|
| **Master** | | | |
| 1 | `cover` | `Main.dc.html` | Logo, business, 5 tool badges, 10 / 3× / 150 stats, overall score ring, "Inside" cards |
| 2 | `summary` | `P02-Summary.dc.html` | Verdict, 3 score rings, red-amber-green scale with markers, you vs top competitor rings, top 3 fixes, "What this means" |
| 3 | `score_and_tools` | `P03-Score.dc.html` | Score-build donut + 4 component rows; 5 tool cards (ring, waffle, band) |
| 4 | `competitors` | `P04-Competitors.dc.html` | Column-chart leaderboard, "gap to first" stat, question × tool heatmap |
| 5 | `wins_and_tone` | `P05-Wins-Tone.dc.html` | Closest wins with position tracks; tone donut; best and worst quotes |
| 6 | `sources` | `P06-Sources.dc.html` | Source-type donut, own-site ring, most-cited sites, outreach list |
| 7 | `searches` | `P07-Searches.dc.html` | Search bars with tool chips, word bubbles, "pages AI is looking for" |
| 8 | `wrong_facts` | `P08-Wrong-Facts.dc.html` | Accuracy ring + severity counts, "AI said → the truth" cards |
| 9 | `website_check` | `P09-Website.dc.html` | Segmented pass/warn/fail ring, checklist rows |
| 10 | `action_plan` | `P10-Plan.dc.html` | Effort × impact matrix, 6 action rows with meters |
| 11 | `method` | `P11-Method.dc.html` | 5 × 10 × 3 = 150 flow diagram, 4 method steps, glossary |
| 12 | `next_step` | `P12-Next.dc.html` | 90-day timeline, 2 phase cards, day-90 re-check, call to action |
| **Visibility snapshot** | | | |
| 1 | `v_cover` | `V01-Cover.dc.html` | Same as the master cover, but with the visibility ring and 5 / 3× / 75 stats |
| 2 | `v_summary` | `V02-Summary.dc.html` | Verdict, 3 rings (visibility, % of answers naming you, tools naming you), vs competitor, mini leaderboard, top 3 visibility moves |
| 3 | `v_tools_tone` | `V03-Tools.dc.html` | 5 tool cards; tone donut + quotes |
| 4 | `v_questions_wins` | `V04-Questions.dc.html` | Heatmap; compact closest-win rows |
| 5 | `v_sources_next` | `V05-Sources-Next.dc.html` | Source donut, search-word chips, outreach cards, call to action |
| **Fact check** | | | |
| 1 | `f_cover` | `F01-Cover.dc.html` | Cover with accuracy ring, 10 checked / 7 right / 3 wrong stats |
| 2 | `f_true_false` | `F02-TrueFalse.dc.html` | Verdict, big accuracy ring, 10-segment true/false strip, every fact with a TRUE/FALSE tag, mistakes by tool |
| 3 | `f_wrong_facts` | `F03-Wrong-Facts.dc.html` | False-fact cards with where AI read it and a one-line fix |
| 4 | `f_fix` | `F04-Fix.dc.html` | Website check (compact), fact-fix list, call to action |

Page footers show `<variant section name>` on the left and `N / total` on the right. Compute the total from the variant's page list; don't hard-code it.

---

## 3. Data model in one paragraph

`AuditReport` (see `types.ts`) stores **raw results only**: the business, the scan settings, scores and their 4 components, per-tool named counts, the leaderboard, 5 buyer questions with one grid cell per tool, closest wins, tone counts, 2 quotes, sources, searches, every fact checked (true and false), website checks, actions in priority order, the 90-day plan and contact details. Anything you see as a percentage, color, rank, sort order or headline is **derived** in `scoring.ts`. That keeps the three variants consistent.

Counting rules the numbers depend on:

- **Buyer answers** = `buyerQuestionCount × runsPerQuestion × tools.length`. Sample: 5 × 3 × 5 = **75**. Visibility uses only these.
- **Branded answers** (questions that include the business name) are **excluded from visibility** and used only for fact accuracy. Sample: another 75.
- The cover line reads "10 questions · each asked 3 times": buyer plus branded questions.
- `toolResults[].named` has to add up to the client's leaderboard count. The test checks this.

---

## 4. Rules that apply everywhere

### Scores and color bands

| Kind of number | Red (`bad`) | Amber (`warn`) | Green (`good`) | Function |
|---|---|---|---|---|
| 0–100 scores (overall, visibility, accuracy, sub-scores, competitor) | 0–39 "Needs work" | 40–69 "Fair" | 70–100 "Strong" | `scoreBand` |
| "Named in X% of answers" rates (tool cards, V02 tile) | under 20% "Weak" | 20–39% "Fair" | 40%+ "Strong" | `rateBand` |

- Every score is drawn as a **ring** (SVG circle, `stroke-dasharray` from `ringDash`, rotated −90°, butt caps) with the number in the middle and a band pill underneath.
- **Overall score** = 70% visibility + 30% fact accuracy (`computeOverall` in `src/core/scoring.ts`); visibility alone when no facts were checked; 0 when AI never names the business; capped at 70 while a serious wrong fact from the latest scan is open. Component weights shown on P03 are 41 / 17 / 12 / 30 (or 59 / 23 / 18 with no fact check). The line under the score (`scores.overall.explanation`) spells out the maths.
- **Visibility** = the first three components rescaled to 0–100.
- **Points shown per component** come from `componentPoints` (largest-remainder rounding), so they always add up to the overall score. Sample: 5 + 6 + 15 + 8 = 34.
- **Overall range** ("Ranged 30–39 across 3 runs") comes from `scores.overall.min`/`max`.

### Color jobs (never mix them)

- **Blue `--client`** means "you" in every comparison: leaderboard bar, your ring next to a competitor, waffle dots, the position-track dot.
- **Gray `--competitor`** means everyone else.
- **Red / amber / green are status only**: score bands, TRUE/FALSE, pass/warn/fail, missing/partial/have, severity, and effort/impact. Status color always comes with an icon (✓ ✕ !) or a text label, never color alone.
- **Effort:** low = green, medium = amber, high = red. **Impact:** high = green, medium = amber, low = gray (`effortColor`, `impactColor`).
- **Severity:** critical = solid red with white text, major = amber, minor = gray.
- **AI tool badges** are colored two-letter monograms (`toolMeta`). They are *not* the vendors' logos. Only use real logos if you have the rights to them.
- **Source types** use the categorical colors in `sourceColor`. They were checked for color-blind separation, so keep them in this order.
- **Eyebrow pills** follow the story arc (`stageColor`): blue "Where you stand" → violet "Who's beating you" → red "What AI gets wrong" → green "What to fix".

### Sort orders

- Tools: most-named first. Mark the top one "Best" and the bottom one "Weakest" only when they differ.
- Leaderboard: by count, descending.
- Wrong facts: **price errors first**, then critical → major → minor.
- Website checks: fail → warn → pass (P09, F04). P09 draws the ring in pass → warn → fail order.
- Actions: stored priority order. Master shows the first 6; each snapshot filters by `track` (`actionsFor`).

### Copy rules

- Readers are business owners. Use plain English, and never write "SEO" or "GEO".
- Every chart has a one-line takeaway above it in bold 16px. Where a template exists, take it from `headlines()`. The search headline is written per client.
- "What this means" notes: a light blue box with an info icon and 1–3 sentences.
- Tone is calm and specific, not alarmist.

### Empty states (required)

Each of these lists has to render cleanly when it's empty, with a dashed or green box and a plain message. The takeaway line has to change too.

| List | Pages | Empty message |
|---|---|---|
| `closestWins` | P05, V04 | "No near misses this time. You didn't place 2nd or 3rd on any question." |
| `sources.competitorWinSites` | P06 | "No competitor-only sources found. When competitors won, AI cited the same sites it cites for you." |
| `searches.queries` | P07 | "No searches recorded. The assistants answered from what they already knew." (hide the words and pages sections) |
| wrong facts | P08, F03 | Green box with a check: "No wrong facts found. Every fact we checked … was correct." Severity counts show 0, and the accuracy ring shows the real score. |

The design files show each empty state through a `showEmpty` tweak. In code, drive them from the data.

---

## 5. Page-by-page build notes

Measurements are CSS px at 96 dpi. Every page is **816 × 1056** with padding `44 64 36` (covers use `56 64 0`). Pages have a header (logo, "Mirror", variant label on the left; "Business · date" on the right, 1px bottom rule) and a footer (section name on the left, `N / total` on the right, 1px top rule). The content in between is a flex column with 16–22px gaps.

**Cover (`cover`, `v_cover`, `f_cover`)**
- 40px Mirror logo tile and a variant pill in the top right.
- Stage pill, then the business name in 84px Newsreader, then website · location · scan date.
- Master and visibility show a panel with 5 tool badges (52px tiles) and 3 stat chips. The fact check cover shows 3 stat cards (checked / right / wrong).
- A score ring on the right: overall for master, visibility for the snapshot, accuracy for the fact check.
- An "Inside" row of story-arc cards.
- A 14px color strip along the bottom edge: the 5 tool colors, or a 70/30 green/red split on the fact check cover.

**Summary (`summary`)**
- Verdict from `headlines().verdict` in 29px serif; the client count is shown in red text.
- 3 ring tiles (124px ring, 14px stroke) on the band's soft background.
- The scale bar: a 40/30/30 red/amber/green track with arrow labels for each score. If two scores are within about 8 points, put one label above the bar and one below.
- The competitor card: two 92px rings. The top-3 fixes card: numbered tiles with effort and impact chips.

**Score and tools (`score_and_tools`, `v_tools_tone`)**
- A 200px donut via `conicDonut` with the component colors (blue, violet, teal, orange). Each component's earned points form one slice; the unearned rest is `#E9EEF4`. The center shows "34 of 100 points".
- Each component row: color square, name and definition, "X of W pts", a sub-score band pill and a mini bar.
- Tool cards in a 5-column grid, each with:
  - badge and name
  - an 84px ring showing % named, colored by `rateBand`
  - "n of 15 answers"
  - a 5×3 waffle of 10px dots (blue = named you)
  - a band pill
  - a "Best" (green) or "Weakest" (red) ribbon; the card border matches.

**Competitors (`competitors`, `v_questions_wins`)**
- Vertical columns (height ∝ count, minimum 36px): client blue, others gray, rank chip inside each column top, count above, name below.
- "Gap to first place" stat = top count − client count; add "passing #N takes K more".
- Heatmap: a question column plus one column per tool. Each cell shows `firstNamed` and a line about you:
  - you were first (`clientRank === 1`): solid green `#16A34A`, white text, "You ★ / First · n of 3 runs"
  - you appeared: `#FDE68A`, "You #r · n/3"
  - left out: `#FEE2E2`, "You: left out"
  - Include a legend.

**Wins and tone (`wins_and_tone`)**
- Each closest-win row has a position track with 5 slots:
  - #1 green
  - slots between #1 and you: gray
  - your slot: blue "You"
  - slots after you: empty outlined.
- Tone donut via `conicDonut` (green / gray / amber / red) with the count in the center and a legend with counts.
- Quote cards: green-soft for the best quote, amber-soft for the worst. Quote text in italic serif, with the tool and question underneath.

**Sources (`sources`, `v_sources_next`)**
- 176px source donut and legend.
- The own-site % as a red ring on a red-soft card (colored by `rateBand`).
- Most-cited sites: numbered rows with a type-color square.
- Outreach list: 2px violet border and a target icon, one row per site with its "ask".

**Searches (`searches`)**
- Searches drawn as pill-shaped search bars with a magnifier icon and tool chips.
- Words drawn as bubbles in fixed spots (sizes 124 / 104 / 88 / 84, categorical colors), ranked by position in `addedWords`.
- Pages-wanted rows tinted by status: missing = red ✕, partial = amber !, have = green ✓.

**Wrong facts (`wrong_facts`, `f_wrong_facts`)**
- Each card has:
  - a severity pill, plus a "$ Price" outline pill when relevant
  - the topic, and "Said by" with the tool badge
  - "AI said" (red-soft box, ✕) → arrow → "The truth" (green-soft box, ✓, bold)
  - "Where AI read it" domain chips, or "Not shown" when `sources` is empty
  - on F03 only, a "Fix:" line.

**True or false (`f_true_false`)**
- 150px accuracy ring.
- A 10-segment strip with one cell per fact (green ✓ / red ✕).
- A 2-column list of every fact with TRUE/FALSE pills; false facts show "AI said X. Truth: Y."
- A "Mistakes by AI tool" row via `mistakesByTool`: green "No mistakes" or red "n wrong".

**Website check (`website_check`, `f_fix`)**
- Segmented ring with one slice per check and "n/5 passed" in the center.
- Rows on the status soft color, each with a status icon circle, the label, the why, a "Fix:" line when not passing, and a solid status pill.

**Action plan (`action_plan`)**
- A 236 × 186 2×2 matrix: quick wins green-tint, big projects amber-tint, easy extras and later gray.
- Numbered dots placed by effort and impact; nudge sideways when two dots overlap.
- Dot colors: quick wins green, other top-3 actions blue, the rest gray.
- Each action row: number tile, title, why, "Fixes: …", and effort and impact meters (3 pips each, colored by `effortColor` / `impactColor`).

**Method (`method`)**
- The flow: tools × questions × runs = total answers (dark box), then branching lines split it into a blue visibility box and a green accuracy box.
- 4 numbered steps and an 8-term glossary.

**Next step (`next_step`)**
- Timeline with day markers 1 / 30 / 60 / 90.
- Two phase cards (blue Month 1, green Months 2–3) with check bullets.
- A day-90 re-check card.
- A blue call-to-action block with the logo, headline, a white "Book your kickoff →" button (`contact.bookingUrl`) and the contact line.

---

## 6. Components to build (suggested)

`ReportPage` (sheet, header, footer), `StagePill`, `Takeaway`, `NoteBox` ("What this means"), `ScoreRing` (size, stroke, value, band source), `BandPill`, `ScaleBar`, `ToolBadge`, `ToolCard`, `Waffle`, `Donut` (conic), `LeaderboardColumns`, `LeaderboardBars` (V02), `Heatmap`, `PositionTrack`, `QuoteCard`, `SearchBar`, `WordBubbles`, `StatusRow` (pass/warn/fail, missing/partial/have), `FactCard`, `TrueFalseStrip`, `EffortImpactMeter`, `ActionMatrix`, `Timeline`, `CtaBlock`, `EmptyState`.

Build `ScoreRing`, `Donut` and `ToolBadge` first: almost every page uses them.

---

## 7. Accessibility and print quality

- Body text is at least 12px (9pt). Label gray is `#64748B` at minimum; nothing lighter is used for text.
- Status is never shown by color alone: every status has an icon or a label.
- Decorative SVGs get `aria-hidden="true"`. The CTA is a real `<a href>` with at least 44px height.
- Charts are static on paper. On screen, adding hover tooltips to rings, bars and heatmap cells is welcome but optional.

---

## 8. Reading the design source files (`.dc.html`)

The designs were made in a canvas tool. Each file is standard HTML with a small template layer:

- `<x-dc>` wraps the page. `<helmet>` holds the font link and base CSS.
- `{{ name }}` is a value from the `renderVals()` method in the `<script type="text/x-dc">` block at the bottom of the file.
- `<sc-for list="{{items}}" as="item">…</sc-for>` repeats markup for each item.
- `<sc-if value="{{flag}}">…</sc-if>` renders only when the flag is true.
- `data-props='{"showEmpty": …}'` declares design-time toggles. In code, replace these with real data.
- `<script src="./support.js">` is the canvas runtime. **Drop it.**

To translate: move the data inside `renderVals()` into `sample-audit.json` (already done) and the logic into `scoring.ts` (already done). Then convert the markup to your components, keeping the inline style values: they are the exact spacing, sizes and colors. The copy in the markup is approved wording.

---

## 9. PDF export

- Render each page as a `.report-page` (see `tokens.css`): a fixed 816 × 1056 box with `break-after: page`.
- Set `@page { size: letter portrait; margin: 0 }` and `print-color-adjust: exact` so the colored rings and fills print.
- Server-side PDF: open the report route in Playwright or Puppeteer and call `page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true })`. Wait for the fonts first (`document.fonts.ready`).
- One route per variant, e.g. `/reports/:auditId?variant=master|visibility|factcheck`, driven by `variantPages`.
- Nothing may overflow a sheet. If real data is longer than the sample (more wrong facts, longer questions), either cap the list and add "+N more in the master report", or let that section continue onto an extra page. Never clip it.

---

## 10. About the sample data

`sample-audit.json` is for layout only. These parts are **illustrative** and have to come from real scans:

- the 5 buyer questions and the heatmap
- the quotes
- the "ask" line for each outreach site
- the 7 true facts
- Grok's numbers (1 of 15)
- the component sub-scores for rank (20) and tool reach (80)
- actions a7 and a8
- the contact placeholders.

The scores (34 / 29 / 70, range 30–39), competitor 61, per-tool counts for the other four tools, leaderboard, tone, source shares, competitor-win sites, searches, the three wrong facts, website check results and top 3 actions come from the original brief. The totals were widened from 60 to 75 answers when Grok was added.
