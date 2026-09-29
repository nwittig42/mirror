# Fact-check accuracy and split scoring — design

Date: 2026-09-29
Status: approved in chat, awaiting spec review

## Goal

Make the fact score trustworthy, and make the three headline numbers
(visibility, fact score, overall) separate and explainable, with overall built
only from the other two.

## What Nick asked for

- Fix the fact-check so it catches real mistakes and doesn't punish the same
  mistake several times.
- Keep "start at 100, lose points per mistake" for the fact score.
- Separate the factual score from the ranking score, and keep a joint one.
- Joint weights: 70% visibility, 30% facts.

## Problems today

1. Only branded answers are judged (`scan-runner.ts`, `prompt.kind === "branded"`).
   A wrong fact inside a category answer that names the business is missed.
2. Findings are merged only on exact claim text. Three runs reword the same
   error into three findings, each costing up to 25 points.
3. The fact score counts every open finding the practice has ever had, not
   this scan's.
4. A dismissed finding is re-created the next scan (dedupe only looks at
   `open`).
5. The report prints 100 when the fact score is null
   (`build-report.ts`: `scan.factScore ?? scan.accuracyScore ?? 100`).
6. The report lists every active fact without an open error as "true", even
   facts AI never mentioned.
7. The overall score is computed independently (50/20/15/15 with its own
   accuracy term), so the report's component points don't always add up to
   the number shown.

## Design

### 1. Judge every answer that names the business

In the network phase, call the judge when `prompt.kind === "branded"` OR
`detectMention(answer, practiceNames)` is true, and the practice has at least
one active fact. Answers that don't name the business are not judged.

### 2. Judge reports right facts as well as wrong ones

The judge output changes from a bare array to:

```json
{ "wrong": [{ "claim": "...", "factLabel": "...|null", "severity": "critical|major|minor" }],
  "right": ["<fact label AI stated correctly>", "..."] }
```

- `right` lists labels of fact-sheet entries the answer states and gets right.
  Omitted facts are not listed.
- The parser still accepts the old bare-array form (treated as `right: []`),
  so a model that ignores the new shape doesn't break the scan.
- Labels in `right` that don't match an active fact are dropped.
- Stored per check as `checks.facts_confirmed` (uuid[] of fact ids, default
  empty). A fact is "mentioned" in a scan if it appears in `facts_confirmed`
  of any check or is the `factId` of any finding seen that scan.

### 3. One wrong fact = one finding

Finding identity key:
- `fact:<factId>` when the judge's `factLabel` matches an active fact;
- otherwise `claim:<normalized claim>` (lowercased, punctuation and
  whitespace collapsed).

Within a scan, all judge results with the same key collapse to one finding,
kept at the worst severity seen. Across scans:
- If an **open** finding with the same key exists, update it
  (`last_seen_scan_id` = this scan, severity raised if worse; claim text kept)
  instead of inserting.
- If a **dismissed** finding with the same key exists, skip it entirely: it
  is not re-opened and does not cost points.
- If only a `fixed`/`verified` finding exists, the error has come back: insert
  a new open finding (and it is reported as new).
- Otherwise insert a new open finding.

New column: `findings.last_seen_scan_id` (uuid, nullable, references
`scans.id`). Existing rows are left null.

### 4. Only this scan's mistakes count

- Fact score input = open findings whose `last_seen_scan_id` is this scan
  (with their fact category, for the 1.5× pricing multiplier).
- Formula unchanged: `100 − Σ(25 critical / 12 major / 4 minor, ×1.5 pricing)`,
  floor 0; null when no answer was judged.
- Older open findings not seen this scan stay open and listed for the
  operator, labelled "not seen in latest scan", but cost no points. They are
  not auto-closed.

### 5. Three separate scores

- **Visibility** (unchanged): `computeVisibility` — 50/20/15 of named rate,
  rank quality and tool reach, rescaled to 0–100. Never named on an earned
  prompt ⇒ 0.
- **Fact score**: section 4.
- **Overall** (new formula):
  - if visibility = 0 ⇒ 0 (facts never lift an invisible business);
  - else if fact score is null ⇒ visibility;
  - else `round(0.7 × visibility + 0.3 × fact)`;
  - then, if any finding seen this scan is critical, cap at 70.
- The per-run score band uses the same overall formula per run (visibility per
  run, the scan's fact score for every run).
- `computeScore`'s old 4-term formula and the `accuracy` term are removed;
  `accuracyScore` on the scan is no longer written (column kept for old rows).
- Stored columns: `score` (overall), `visibilityScore`, `factScore`,
  `citationRate`, `positionScore`, `breadthScore`, `scoreLow`, `scoreHigh`.

### 6. Report and dashboard

- Fact score null ⇒ show "N/A" (report pages, dashboard, accuracy page). The
  report type's `factAccuracy` becomes `number | null`.
- Report score breakdown (P03 and equivalents) shows overall = 70% visibility
  + 30% facts, with visibility's three parts underneath. When the cap applies,
  show "capped at 70 because of a serious wrong fact" so the numbers reconcile.
- Under the overall score, a plain line explains the weights, e.g.
  "Overall = 70% visibility (62) + 30% fact accuracy (80) = 67". Variants for
  fact score N/A ("Overall = visibility, no facts were checked this scan"),
  never named ("Overall is 0 because AI never named you"), and the cap.
- Fact list ("checked / right"): only facts mentioned this scan. Right =
  confirmed and not wrong this scan; wrong = open findings seen this scan.
  Older unseen open findings are not in the client report.
- A wrong claim with no matching fact shows truth text
  "Your fact sheet doesn't back this up."
- Admin practice page: open findings not seen in the latest scan get a
  "not seen in latest scan" tag.
- `docs/audit-design/HANDOFF.md` weights updated to match.

## Out of scope

Scan reliability (failed engine calls), PDF export, onboarding, admin leads
view, support replies — separate specs.

## Database changes

- `findings.last_seen_scan_id uuid null references scans(id)`
- `checks.facts_confirmed uuid[] not null default '{}'`

Applied with `npm run db:push`, along with this branch's other pending schema
changes.

## Testing

Unit tests (vitest, existing patterns):
- judge parse: new object shape, old array shape, unknown labels dropped.
- scan-runner: category answer that names the business is judged; answer that
  doesn't isn't; three reworded runs of the same fact error ⇒ one finding;
  worst severity kept; dismissed finding not re-created; fixed finding that
  recurs ⇒ new finding; old unseen open finding doesn't cost points.
- scoring: overall = 0.7V + 0.3F; null fact ⇒ visibility; zero visibility ⇒ 0;
  critical cap at 70; band uses the same formula.
- build-report: null fact score ⇒ N/A; checked/right counts only mentioned
  facts; unmatched claim truth text.
- Full suite and `tsc --noEmit` pass.
