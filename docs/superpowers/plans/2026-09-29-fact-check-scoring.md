# Fact-check accuracy and split scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the fact score trustworthy (judge more answers, one finding per wrong fact, only this scan counts, dismissals stick) and make overall = 70% visibility + 30% fact score, explained in one line under the score.

**Architecture:** Pure scoring and finding-identity logic lives in `src/core/` (unit-tested with no DB). `src/services/scan-runner.ts` wires it: judge → collapse findings per key → upsert against prior findings → score. `src/report/build-report.ts` and the pages read the stored numbers and never recompute the overall.

**Tech Stack:** Next.js 16, TypeScript, drizzle-orm (Postgres; PGlite in tests), zod, vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-fact-check-scoring-design.md`

## Global Constraints

- Fact score: `100 − Σ(critical 25 / major 12 / minor 4, ×1.5 when the fact's category is "pricing")`, floor 0, `null` when no answer was judged.
- Overall: visibility 0 ⇒ 0; fact null ⇒ visibility; else `round(0.7 × visibility + 0.3 × fact)`; then cap at 70 if a finding seen this scan is critical.
- Visibility formula unchanged: `round(100 × (0.5·named + 0.2·rank + 0.15·reach) / 0.85)`, 0 if never named on an earned prompt.
- Findings are never auto-closed.
- Client-facing copy is plain English, no jargon. N/A (not 0, not 100) when the fact score is null.
- Truth text for an unmatched claim: `Your fact sheet doesn't back this up.`
- New DB columns: `findings.last_seen_scan_id uuid null → scans.id`; `checks.facts_confirmed jsonb string[] not null default []`.
- Run commands from `/Users/nicholaswittig/geo-platform`. Tests: `npx vitest run <path>`. Types: `npx tsc --noEmit`.
- This branch has lots of uncommitted unrelated work. **Commit only the files each task names** (`git add <paths>`), never `git add -A`/`.`.

## Review Focus

1. A practice with no active facts: nothing is judged, fact score is null, overall = visibility, report shows N/A. (Task 4 test "no facts ⇒ not judged".)
2. Pre-existing open findings from old scans (`last_seen_scan_id` null) must not cost points in the next scan unless seen again, and must be matched (not duplicated) when seen again. (Task 4 test "legacy open finding is matched".)
3. The judge returns the old bare-array shape or wraps JSON in prose — the scan must not lose the findings. (Task 2 tests.)
4. A label in the judge's `right` list that isn't on the fact sheet, or that is also flagged wrong, must not show as "AI got it right". (Task 2 + Task 5 tests.)
5. Critical finding + high visibility ⇒ overall exactly 70 and the explanation line says why. (Task 3 test.)

---

### Task 1: Finding identity helpers

**Files:**
- Create: `src/core/finding-key.ts`
- Test: `tests/core/finding-key.test.ts`

**Interfaces:**
- Produces: `normalizeClaim(claim: string): string`; `findingKey(f: { factId?: string | null; claim: string }): string`; `worseSeverity(a: Severity, b: Severity): Severity`.

- [ ] **Step 1: Write the failing test** — `tests/core/finding-key.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { findingKey, normalizeClaim, worseSeverity } from "@/core/finding-key";

describe("finding identity", () => {
  it("keys on the fact when there is one, ignoring wording", () => {
    expect(findingKey({ factId: "f1", claim: "Botox is $9/unit" }))
      .toBe(findingKey({ factId: "f1", claim: "They charge 9 dollars a unit" }));
  });
  it("falls back to the normalized claim", () => {
    expect(findingKey({ factId: null, claim: "Offers  LASIK surgery." }))
      .toBe(findingKey({ claim: "offers lasik surgery" }));
    expect(findingKey({ claim: "Offers LASIK" })).not.toBe(findingKey({ claim: "Offers CoolSculpting" }));
  });
  it("normalizes case, punctuation and spacing", () => {
    expect(normalizeClaim("  Botox: $9/unit!! ")).toBe("botox 9 unit");
  });
  it("picks the worse severity", () => {
    expect(worseSeverity("minor", "critical")).toBe("critical");
    expect(worseSeverity("major", "minor")).toBe("major");
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** (module not found): `npx vitest run tests/core/finding-key.test.ts`

- [ ] **Step 3: Implement** — `src/core/finding-key.ts`

```ts
import type { Severity } from "@/core/types";

/** Lowercase, letters and digits only, single-spaced. "Botox: $9/unit" → "botox 9 unit". */
export function normalizeClaim(claim: string): string {
  return claim.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * What makes two findings "the same wrong fact". The same error comes back
 * reworded on every run, so a finding tied to a fact is keyed on the fact;
 * only a claim the judge couldn't tie to a fact falls back to its wording.
 */
export function findingKey(f: { factId?: string | null; claim: string }): string {
  return f.factId ? `fact:${f.factId}` : `claim:${normalizeClaim(f.claim)}`;
}

const RANK: Record<Severity, number> = { minor: 0, major: 1, critical: 2 };

export function worseSeverity(a: Severity, b: Severity): Severity {
  return RANK[b] > RANK[a] ? b : a;
}
```

- [ ] **Step 4: Run it, expect PASS.**
- [ ] **Step 5: Commit** `git add src/core/finding-key.ts tests/core/finding-key.test.ts && git commit -m "feat: finding identity keyed on the contradicted fact"`

---

### Task 2: Judge reports right facts as well as wrong ones

**Files:**
- Modify: `src/core/judge-parse.ts` (add verdict type + parser; keep `extractJsonArray` as is)
- Modify: `src/services/hallucination-judge.ts` (prompt + return type)
- Test: `tests/core/judge-parse.test.ts`, `tests/services/hallucination-judge.test.ts`

**Interfaces:**
- Produces: `interface JudgeVerdict { wrong: JudgeFinding[]; right: string[] }`; `parseJudgeOutput(raw: string): JudgeVerdict`; `judgeAnswer(args): Promise<JudgeVerdict>`.

- [ ] **Step 1: Update tests.** In `tests/core/judge-parse.test.ts`, every existing assertion on the result becomes an assertion on `.wrong` (e.g. `expect(parseJudgeOutput(raw).wrong).toHaveLength(1)`; `expect(parseJudgeOutput("[]")).toEqual({ wrong: [], right: [] })`). Add:

```ts
describe("parseJudgeOutput verdict object", () => {
  it("parses wrong and right", () => {
    const raw = `{"wrong":[{"claim":"Botox is $9","factLabel":"Botox price","severity":"major"}],"right":["Sunday hours"]}`;
    expect(parseJudgeOutput(raw)).toEqual({
      wrong: [{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" }],
      right: ["Sunday hours"],
    });
  });
  it("accepts a fenced object with prose around it", () => {
    const raw = "Here you go:\n```json\n{\"wrong\":[],\"right\":[\"Address\"]}\n```\nDone.";
    expect(parseJudgeOutput(raw)).toEqual({ wrong: [], right: ["Address"] });
  });
  it("treats the old bare array as wrong-only", () => {
    const raw = `[{"claim":"x","factLabel":null,"severity":"minor"}]`;
    expect(parseJudgeOutput(raw)).toEqual({ wrong: [{ claim: "x", factLabel: null, severity: "minor" }], right: [] });
  });
  it("defaults a missing right list to empty", () => {
    expect(parseJudgeOutput(`{"wrong":[]}`)).toEqual({ wrong: [], right: [] });
  });
});
```

In `tests/services/hallucination-judge.test.ts`, change the mocked text to `{"wrong":[{"claim":"Botox is $9/unit","factLabel":"Botox price","severity":"major"}],"right":[]}` and the assertion to `expect(verdict.wrong[0].severity).toBe("major")` (rename `findings` → `verdict`).

- [ ] **Step 2: Run, expect FAIL:** `npx vitest run tests/core/judge-parse.test.ts tests/services/hallucination-judge.test.ts`

- [ ] **Step 3: Implement.** In `src/core/judge-parse.ts`, below `findingSchema` add the verdict schema, and replace `parseJudgeOutput`:

```ts
export interface JudgeVerdict { wrong: JudgeFinding[]; right: string[] }

const verdictSchema = z.object({
  wrong: findingSchema,
  right: z.array(z.string()).default([]),
});

/** First `{...}` candidate (fenced, then first-to-last brace) that is a valid verdict. */
function extractVerdict(raw: string): JudgeVerdict | null {
  const candidates = [
    raw.match(/```json\s*([\s\S]*?)\s*```/)?.[1],
    raw.match(/```\s*([\s\S]*?)\s*```/)?.[1],
    raw.includes("{") ? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1) : undefined,
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const parsed = verdictSchema.safeParse(JSON.parse(c));
      if (parsed.success) return parsed.data;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Reads the judge's `{wrong, right}` verdict. Falls back to the old bare
 * findings array (as `right: []`) so a model that ignores the new shape, or
 * prose that breaks the object, still yields the wrong facts: the array scan
 * finds the `wrong` list inside a broken object too.
 */
export function parseJudgeOutput(raw: string): JudgeVerdict {
  const verdict = extractVerdict(raw);
  if (verdict) return verdict;

  const jsonStr = extractJsonArray(raw);
  if (!jsonStr) throw new JudgeParseError(`No JSON verdict in judge output: ${raw.slice(0, 200)}`);
  const parsed = findingSchema.safeParse(JSON.parse(jsonStr));
  if (!parsed.success) throw new JudgeParseError(parsed.error.message);
  return { wrong: parsed.data, right: [] };
}
```

Keep the existing `"rejects invalid severities"` test passing: an array with a bad severity fails both paths and throws.

In `src/services/hallucination-judge.ts`: import `JudgeVerdict` instead of `JudgeFinding`, change the return type to `Promise<JudgeVerdict>`, raise `max_tokens` to 1500, and replace the last three lines of `JUDGE_SYSTEM` (from `Output ONLY a JSON array` to the end) with:

```
Also list the facts the ANSWER states correctly: fact sheet entries the answer mentions and gets right. Do not list facts the answer doesn't mention.
Output ONLY a JSON object (no prose): {"wrong": [{"claim": "<verbatim or tightly paraphrased claim from the ANSWER>", "factLabel": "<the exact string after 'label:' on the contradicted fact sheet line, copied character for character, or null>", "severity": "critical|major|minor"}], "right": ["<exact label of a fact the ANSWER states correctly>"]}
Never put the category in factLabel or right. The category is a grouping; the label is the fact's name.
If there are no contradictions, "wrong" is []. If the answer states no fact correctly, "right" is [].
```

- [ ] **Step 4: Run, expect PASS** (same command). `npx tsc --noEmit` will now fail in `scan-runner.ts` and test fakes — that is fixed in Task 4; do not commit a broken scan-runner, so commit only the files here.
- [ ] **Step 5: Commit** `git add src/core/judge-parse.ts src/services/hallucination-judge.ts tests/core/judge-parse.test.ts tests/services/hallucination-judge.test.ts && git commit -m "feat: judge returns right facts alongside wrong ones"`

---

### Task 3: Split scoring — visibility, fact, overall

**Files:**
- Modify: `src/core/scoring.ts`
- Test: `tests/core/scoring.test.ts`

**Interfaces:**
- Produces:
  - `interface VisibilityParts { citationRate: number; positionQuality: number; engineBreadth: number }`
  - `computeVisibilityParts(checks: ScoreInput["checks"], engineCount?: number): VisibilityParts`
  - `computeVisibility(checks, engineCount?): number` (unchanged behaviour)
  - `OVERALL_WEIGHTS = { visibility: 0.7, facts: 0.3 }`, `CRITICAL_CAP = 70`
  - `computeOverall(a: OverallInput): { score: number; uncapped: number; capped: boolean }` where `OverallInput = { visibility: number; factScore: number | null; hasCritical: boolean }`
  - `explainOverall(a: OverallInput): string`
  - `computeFactScore` unchanged. `ScoreInput` keeps only `checks` and `engineCount`.
  - **Removed:** `computeScore`, `ScoreBreakdown`, and the `openFindings/brandedCheckCount/brandedChecksWithFinding/factAccuracy` fields.

- [ ] **Step 1: Rewrite the `computeScore` tests.** Delete the `describe("computeScore", …)`, `describe("computeScore with factAccuracy", …)` blocks and the `computeScore` lines in `describe("engineCount", …)`. Port the visibility cases to `computeVisibilityParts` and add the overall tests:

```ts
import { computeVisibilityParts, computeVisibility, computeOverall, explainOverall, computeFactScore, scoreBand } from "@/core/scoring";

describe("computeVisibilityParts", () => {
  it("ignores branded prompts for the named rate", () => {
    const p = computeVisibilityParts([
      check("openai", "branded", true, "mentioned"),
      check("openai", "category", false, "absent"),
      check("openai", "informational", true, "mentioned"),
    ]);
    expect(p.citationRate).toBeCloseTo(0.5);
  });
  it("counts only category prompts for rank", () => {
    const p = computeVisibilityParts([check("openai", "branded", true, "first"), check("openai", "category", true, "mentioned")]);
    expect(p.positionQuality).toBeCloseTo(0.4);
  });
  it("measures reach against engines asked, not branded-only engines", () => {
    const p = computeVisibilityParts([
      check("openai", "category", true, "first"),
      check("anthropic", "branded", true, "mentioned"),
    ], 5);
    expect(p.engineBreadth).toBeCloseTo(0.2);
  });
});

describe("computeOverall", () => {
  it("is 70% visibility + 30% facts", () => {
    expect(computeOverall({ visibility: 60, factScore: 80, hasCritical: false }))
      .toEqual({ score: 66, uncapped: 66, capped: false });
  });
  it("is visibility alone when no facts were checked", () => {
    expect(computeOverall({ visibility: 55, factScore: null, hasCritical: false }).score).toBe(55);
  });
  it("is 0 when AI never named them, however accurate", () => {
    expect(computeOverall({ visibility: 0, factScore: 100, hasCritical: false }).score).toBe(0);
  });
  it("caps at 70 with a serious wrong fact", () => {
    expect(computeOverall({ visibility: 100, factScore: 75, hasCritical: true }))
      .toEqual({ score: 70, uncapped: 93, capped: true });
  });
  it("doesn't cap a score already at or under 70", () => {
    expect(computeOverall({ visibility: 50, factScore: 75, hasCritical: true }))
      .toEqual({ score: 58, uncapped: 58, capped: false });
  });
});

describe("explainOverall", () => {
  it("spells out the weights", () => {
    expect(explainOverall({ visibility: 60, factScore: 80, hasCritical: false }))
      .toBe("Overall = 70% visibility (60) + 30% fact accuracy (80) = 66.");
  });
  it("says why when capped", () => {
    expect(explainOverall({ visibility: 100, factScore: 75, hasCritical: true }))
      .toBe("Overall = 70% visibility (100) + 30% fact accuracy (75) = 93, capped at 70 because AI stated a serious wrong fact about you.");
  });
  it("covers no facts checked", () => {
    expect(explainOverall({ visibility: 55, factScore: null, hasCritical: false }))
      .toBe("Overall = your visibility (55). No facts were checked this scan, so accuracy isn't counted yet.");
  });
  it("covers never named", () => {
    expect(explainOverall({ visibility: 0, factScore: 90, hasCritical: false }))
      .toBe("Overall is 0 because AI never named you when buyers asked. Accurate facts can't lift a business AI doesn't mention.");
  });
});
```

Keep the existing `computeVisibility`, `computeFactScore`, `scoreBand` tests and the `computeVisibility(checks, 5)` line in `engineCount`.

- [ ] **Step 2: Run, expect FAIL:** `npx vitest run tests/core/scoring.test.ts`

- [ ] **Step 3: Implement.** In `src/core/scoring.ts`, replace everything from `export interface ScoreInput` through the end of `computeVisibility` with:

```ts
export interface ScoreInput {
  checks: Pick<CheckResult, "engine" | "promptKind" | "mentioned" | "position">[];
  /** Engines the scan asked; reach is "engines that named you / engines asked". Default 4. */
  engineCount?: number;
}

export interface VisibilityParts { citationRate: number; positionQuality: number; engineBreadth: number }

const POSITION_WEIGHT: Record<Position, number> = { first: 1, top3: 0.7, mentioned: 0.4, absent: 0 };

/**
 * The three "does AI name you" measures. Branded prompts name the practice in
 * the question, so the answer names it back almost every time; they are left
 * out of every visibility term and used only for fact-checking.
 */
export function computeVisibilityParts(checks: ScoreInput["checks"], engineCount?: number): VisibilityParts {
  const earned = checks.filter(c => c.promptKind !== "branded");
  const citationRate = earned.length ? earned.filter(c => c.mentioned).length / earned.length : 0;
  const category = checks.filter(c => c.promptKind === "category");
  const positionQuality = category.length
    ? category.reduce((s, c) => s + POSITION_WEIGHT[c.position], 0) / category.length
    : 0;
  const engines = new Set(earned.filter(c => c.mentioned).map(c => c.engine));
  const engineBreadth = Math.min(1, engines.size / Math.max(1, engineCount ?? 4));
  return { citationRate, positionQuality, engineBreadth };
}

/**
 * Visibility, 0-100: 50% named rate, 20% rank, 15% reach, rescaled over 0.85.
 * Locked rule: never named on an earned prompt => 0.
 */
export function computeVisibility(checks: ScoreInput["checks"], engineCount?: number): number {
  const p = computeVisibilityParts(checks, engineCount);
  if (p.citationRate === 0) return 0;
  return Math.round(100 * (0.5 * p.citationRate + 0.2 * p.positionQuality + 0.15 * p.engineBreadth) / 0.85);
}

export const OVERALL_WEIGHTS = { visibility: 0.7, facts: 0.3 } as const;
/** A serious wrong fact (credentials, safety, a service not offered) holds overall at this. */
export const CRITICAL_CAP = 70;

export interface OverallInput { visibility: number; factScore: number | null; hasCritical: boolean }

/**
 * Overall, built only from the two published scores so anyone can check it:
 * 70% visibility + 30% fact accuracy. Facts never lift an invisible business
 * (visibility 0 => 0); with nothing fact-checked it is visibility alone.
 */
export function computeOverall(a: OverallInput): { score: number; uncapped: number; capped: boolean } {
  const uncapped = a.visibility === 0 ? 0
    : a.factScore === null ? a.visibility
    : Math.round(OVERALL_WEIGHTS.visibility * a.visibility + OVERALL_WEIGHTS.facts * a.factScore);
  const capped = a.hasCritical && uncapped > CRITICAL_CAP;
  return { score: capped ? CRITICAL_CAP : uncapped, uncapped, capped };
}

/** One plain line that shows the overall's maths, shown under the score. */
export function explainOverall(a: OverallInput): string {
  if (a.visibility === 0) {
    return "Overall is 0 because AI never named you when buyers asked. Accurate facts can't lift a business AI doesn't mention.";
  }
  if (a.factScore === null) {
    return `Overall = your visibility (${a.visibility}). No facts were checked this scan, so accuracy isn't counted yet.`;
  }
  const o = computeOverall(a);
  const sum = `Overall = 70% visibility (${a.visibility}) + 30% fact accuracy (${a.factScore}) = ${o.uncapped}`;
  return o.capped ? `${sum}, capped at ${CRITICAL_CAP} because AI stated a serious wrong fact about you.` : `${sum}.`;
}
```

Also update the file's `Severity` import usage (still used by `FACT_PENALTY`) and leave `computeFactScore`/`scoreBand` untouched.

- [ ] **Step 4: Run, expect PASS:** `npx vitest run tests/core/scoring.test.ts`
- [ ] **Step 5: Commit** `git add src/core/scoring.ts tests/core/scoring.test.ts && git commit -m "feat: overall score is 70% visibility + 30% facts, with a plain explanation"`

---

### Task 4: Scan runner — judge more, one finding per fact, this scan only

**Files:**
- Modify: `src/db/schema.ts` (`checks`, `findings`)
- Modify: `src/services/scan-runner.ts`
- Modify: `src/lib/queries.ts` (`getChecksForScan`, `getFindingsForPractice` select the new columns)
- Test: `tests/services/scan-runner.test.ts`, `tests/report/build-report.test.ts` (fake judge shape only), `tests/app/cron.test.ts` (fake judge shape only), any other test passing a judge

**Interfaces:**
- Consumes: `findingKey`, `worseSeverity` (Task 1); `JudgeVerdict` (Task 2); `computeVisibility`, `computeVisibilityParts`, `computeOverall`, `computeFactScore`, `scoreBand` (Task 3).
- Produces: `checks.factsConfirmed: string[]` (fact ids); `findings.lastSeenScanId: string | null`; both returned by `getChecksForScan` / `getFindingsForPractice`. `runScan` signature unchanged; `scans.accuracyScore` no longer written.

- [ ] **Step 1: Schema.** In `src/db/schema.ts`:
  - in `checks`, after `namedOrder`:
    ```ts
    // Active fact ids the judge said this answer stated correctly. Feeds the
    // report's "AI got these right" list; empty when not judged.
    factsConfirmed: jsonb("facts_confirmed").$type<string[]>().notNull().default([]),
    ```
  - in `findings`, after `status`:
    ```ts
    // The latest scan whose answers repeated this wrong fact. Only findings
    // seen in the latest scan count toward its fact score; older ones stay
    // open for review but no longer cost points. Null = from before this column.
    lastSeenScanId: uuid("last_seen_scan_id").references(() => scans.id),
    ```
  In `src/lib/queries.ts` add `factsConfirmed: checks.factsConfirmed,` to `getChecksForScan`'s select and `lastSeenScanId: findings.lastSeenScanId,` to `getFindingsForPractice`'s select.

- [ ] **Step 2: Update fake judges to the new shape.** Every judge passed to `runScan`/`runWeeklyScan` in tests must return `{ wrong, right }`. In `tests/services/scan-runner.test.ts` add near the top `const clean = async () => ({ wrong: [], right: [] });` and pass `clean` wherever the **4th argument** of `runScan` is `async () => []` (the 5th, the extractor, stays `async () => []`). Wrap array-returning judges: e.g. `async () => ({ wrong: [{ claim: "…", factLabel: "Botox price", severity: "major" as const }], right: [] })`. Same in `tests/report/build-report.test.ts` (`judge` returns `{ wrong: answer.includes("$9") ? [...] : [], right: [] }`) and `tests/app/cron.test.ts` (`judgeAnswer: async () => ({ wrong: [], right: [] })`). Find all with `grep -rn "runScan(\|judgeAnswer:" tests`.

  In the "survives a judge failure" test replace `expect(scan?.accuracyScore).toBe(100);` and its comment with:
  ```ts
  // A judge failure is "unknown", not "clean": nothing was judged, so N/A.
  expect(scan?.factScore).toBeNull();
  ```

- [ ] **Step 3: Write the new failing tests** — append to `tests/services/scan-runner.test.ts` (add `findings as findingsTable, scans as scansTable` to the `@/db/schema` import and `import { eq } from "drizzle-orm";`):

```ts
describe("runScan fact-checking", () => {
  const botox = { category: "pricing" as const, label: "Botox price", value: "$13/unit" };

  it("judges a category answer that names the business, but not one that doesn't", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa", kind: "category" }, { text: "Cheap Botox", kind: "category" }],
      facts: [botox],
    });
    const seen: string[] = [];
    const judge = async ({ answer }: { answer: string }) => { seen.push(answer); return { wrong: [], right: [] }; };
    const adapter: EngineAdapter = { name: "openai", run: async p => ({
      answer: p === "Best med spa" ? "Glow MedSpa is great." : "Skin Bar LA has deals.", citations: [] }) };
    await runScan(db, practiceId, [adapter], judge, async () => []);
    expect(seen).toEqual(["Glow MedSpa is great."]);
  });

  it("doesn't judge anything when there is no fact sheet", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }],
    });
    let calls = 0;
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa Botox is $9.")],
      async () => { calls++; return { wrong: [], right: [] }; }, async () => []);
    expect(calls).toBe(0);
    expect((await db.query.scans.findFirst())?.factScore).toBeNull();
  });

  it("collapses a reworded error across runs into one finding at its worst severity", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }], facts: [botox],
    });
    const wordings = [
      { claim: "Botox is $9/unit", severity: "minor" as const },
      { claim: "They charge nine dollars a unit", severity: "major" as const },
      { claim: "Botox runs $9 per unit", severity: "minor" as const },
    ];
    let i = 0;
    const judge = async () => ({ wrong: [{ ...wordings[i++ % 3], factLabel: "Botox price" }], right: [] });
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa Botox is $9.")], judge, async () => [],
      { runs: 3, concurrency: 1 });
    const rows = await db.query.findings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe("major");
    expect((await db.query.scans.findFirst())?.factScore).toBe(82); // 100 − 12 × 1.5
  });

  it("stores the facts AI got right, dropping unknown labels", async () => {
    const db = await makeTestDb();
    const { practiceId, factIds } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }], facts: [botox],
    });
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa Botox is $13.")],
      async () => ({ wrong: [], right: ["Botox price", "Made-up label"] }), async () => []);
    const [check] = await db.query.checks.findMany();
    expect(check.factsConfirmed).toEqual([factIds[0]]);
  });

  it("updates the open finding on a re-scan instead of adding another, and counts only this scan", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }],
      facts: [botox, { category: "services", label: "Lasers", value: "No laser treatments" }],
    });
    const run = (wrong: { claim: string; factLabel: string; severity: "major" | "critical" }[]) =>
      runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], async () => ({ wrong, right: [] }), async () => []);

    await run([{ claim: "Offers laser hair removal", factLabel: "Lasers", severity: "critical" }]);
    const second = await run([{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" }]);

    const rows = await db.query.findings.findMany();
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.status === "open")).toBe(true); // never auto-closed
    const scan = await db.query.scans.findFirst({ where: eq(scansTable.id, second.scanId) });
    // Only the price error was seen this scan: the old critical costs nothing and doesn't cap.
    expect(scan?.factScore).toBe(82);
    expect(second.newFindings).toHaveLength(1);

    const third = await run([{ claim: "Botox costs nine dollars", factLabel: "Botox price", severity: "major" }]);
    expect(await db.query.findings.findMany()).toHaveLength(2);
    expect(third.newFindings).toHaveLength(0);
    const price = (await db.query.findings.findMany()).find(r => r.claim === "Botox is $9");
    expect(price?.lastSeenScanId).toBe(third.scanId);
  });

  it("doesn't bring back a dismissed finding, but does reopen a fixed one that recurs", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }],
      facts: [botox, { category: "services", label: "Lasers", value: "No laser treatments" }],
    });
    const both = async () => ({ wrong: [
      { claim: "Botox is $9", factLabel: "Botox price", severity: "major" as const },
      { claim: "Offers lasers", factLabel: "Lasers", severity: "critical" as const },
    ], right: [] });
    const scanOnce = () => runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], both, async () => []);

    await scanOnce();
    await db.update(findingsTable).set({ status: "dismissed" }).where(eq(findingsTable.claim, "Botox is $9"));
    await db.update(findingsTable).set({ status: "fixed" }).where(eq(findingsTable.claim, "Offers lasers"));

    const again = await scanOnce();
    const rows = await db.query.findings.findMany();
    expect(rows).toHaveLength(3); // the fixed laser error came back as a new open finding
    expect(again.newFindings.map(f => f.claim)).toEqual(["Offers lasers"]);
    const scan = await db.query.scans.findFirst({ where: eq(scansTable.id, again.scanId) });
    expect(scan?.factScore).toBe(75); // only the critical: the dismissed price error costs nothing
  });

  it("matches a legacy open finding (no last-seen scan) by its fact", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Botox at Glow MedSpa?", kind: "branded" }], facts: [botox],
    });
    const judge = async () => ({ wrong: [{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" as const }], right: [] });
    const first = await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], judge, async () => []);
    await db.update(findingsTable).set({ lastSeenScanId: null });
    const clean = await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")],
      async () => ({ wrong: [], right: [] }), async () => []);
    expect((await db.query.scans.findFirst({ where: eq(scansTable.id, clean.scanId) }))?.factScore).toBe(100);
    const again = await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa.")], judge, async () => []);
    expect(await db.query.findings.findMany()).toHaveLength(1);
    expect(again.newFindings).toHaveLength(0);
    expect(first.scanId).not.toBe(again.scanId);
  });

  it("stores overall as 70% visibility + 30% facts", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa", kind: "category" }, { text: "Botox at Glow MedSpa?", kind: "branded" }],
      facts: [botox],
    });
    await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa is the best.")],
      async () => ({ wrong: [{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" as const }], right: [] }),
      async () => []);
    const scan = await db.query.scans.findFirst();
    expect(scan?.factScore).toBe(82);
    expect(scan?.score).toBe(Math.round(0.7 * scan!.visibilityScore! + 0.3 * 82));
    expect(scan?.accuracyScore).toBeNull();
  });
});
```

- [ ] **Step 4: Run, expect FAIL:** `npx vitest run tests/services/scan-runner.test.ts`

- [ ] **Step 5: Implement in `src/services/scan-runner.ts`.**

Imports: replace the scoring import with
`import { computeVisibility, computeVisibilityParts, computeOverall, computeFactScore, scoreBand } from "@/core/scoring";`
and add `import { findingKey, worseSeverity } from "@/core/finding-key";`. Delete the `ScoringCheck`'s dependency on `computeScore` (the type itself stays).

Network phase — replace the `judged` branch of the `Promise.all` with:

```ts
        shouldJudge(prompt.kind, answer)
          ? judge({ answer, facts: judgeFacts }).catch(() => null)
          : Promise.resolve(undefined),
```

and define, right after `judgeFacts`:

```ts
    // Any answer that names the business can state a wrong fact about it,
    // not just the ones where the question named it. Nothing to check
    // against without a fact sheet, so then nothing is judged (fact score N/A).
    const shouldJudge = (kind: PromptRow["kind"], answer: string) =>
      judgeFacts.length > 0 && !!answer && (kind === "branded" || detectMention(answer, practiceNames));
```

(`PromptRow` is declared below `runScan`'s types; move `type PromptRow = typeof prompts.$inferSelect;` above `ScanOptions` if TS complains about use-before-define — it won't, types are hoisted.) In `Gathered`, change the comment on `judged` to `// undefined = not judged`.

Record phase — before the `for (const g of gathered)` loop, replace the `brandedCheckCount` / `brandedChecksWithFinding` counters with:

```ts
    let judgedCheckCount = 0;
    // One entry per wrong fact seen this scan, however many answers repeated it.
    const seenThisScan = new Map<string, {
      claim: string; factId: string | null; factValue: string | null;
      severity: NewFinding["severity"]; checkId: string; engine: string; prompt: string;
    }>();
```

In the `checks` insert add `factsConfirmed: confirmedIds(g),` where, above the loop:

```ts
    const factIdByLabel = new Map(factRows.map(f => [f.label, f.id]));
    const confirmedIds = (g: Gathered) => g.ok && g.judged
      ? [...new Set(g.judged.right.map(l => factIdByLabel.get(l)).filter((id): id is string => !!id))]
      : [];
```

Replace everything from `// Only checks the judge actually scored…` through the end of the `for (const finding of g.judged)` loop with:

```ts
      // Only answers the judge actually scored count as checked: a judge
      // failure means "unknown", not "clean".
      judgedCheckCount++;

      for (const finding of g.judged.wrong) {
        const matchedFact = finding.factLabel ? factRows.find(f => f.label === finding.factLabel) : undefined;
        const key = findingKey({ factId: matchedFact?.id, claim: finding.claim });
        const prior = seenThisScan.get(key);
        if (prior) {
          prior.severity = worseSeverity(prior.severity, finding.severity);
          continue;
        }
        seenThisScan.set(key, {
          claim: finding.claim, factId: matchedFact?.id ?? null, factValue: matchedFact?.value ?? null,
          severity: finding.severity, checkId: check.id, engine: adapter.name, prompt: prompt.text,
        });
      }
    }

    // Reconcile this scan's wrong facts with the practice's history. An open
    // finding for the same fact is the same mistake seen again; a dismissed one
    // was ruled "not actually wrong" and stays that way; a fixed or verified
    // one that comes back is a new mistake.
    const priorFindings = await db.select().from(findings).where(eq(findings.practiceId, practiceId));
    const priorByKey = new Map<string, (typeof priorFindings)[number][]>();
    for (const f of priorFindings) {
      const key = findingKey(f);
      priorByKey.set(key, [...(priorByKey.get(key) ?? []), f]);
    }
    const newFindings: NewFinding[] = [];
    for (const [key, seen] of seenThisScan) {
      const history = priorByKey.get(key) ?? [];
      if (history.some(f => f.status === "dismissed")) continue;
      const open = history.find(f => f.status === "open");
      if (open) {
        await db.update(findings)
          .set({ lastSeenScanId: scan.id, severity: worseSeverity(open.severity, seen.severity) })
          .where(eq(findings.id, open.id));
        continue;
      }
      await db.insert(findings).values({
        practiceId, checkId: seen.checkId, factId: seen.factId ?? undefined, claim: seen.claim,
        factValue: seen.factValue ?? undefined, severity: seen.severity, status: "open", lastSeenScanId: scan.id,
      });
      newFindings.push({ claim: seen.claim, factValue: seen.factValue, severity: seen.severity, engine: seen.engine, prompt: seen.prompt });
    }
```

(The closing `}` of the `for (const g of gathered)` loop is now the one before the "Reconcile" comment; remove the old `const newFindings` declaration above the loop.)

Replace the `openFindings` query through the `db.update(scans).set({...})` call with:

```ts
    // Only wrong facts seen in this scan cost points or cap the overall.
    const seenFindings = await db.select({ severity: findings.severity, category: facts.category })
      .from(findings)
      .leftJoin(facts, eq(findings.factId, facts.id))
      .where(and(eq(findings.practiceId, practiceId), eq(findings.status, "open"), eq(findings.lastSeenScanId, scan.id)));

    const factScore = computeFactScore({ judgedChecks: judgedCheckCount, openFindings: seenFindings });
    const hasCritical = seenFindings.some(f => f.severity === "critical");
    const engineCount = adapters.length;
    const overallFor = (subset: ScoringCheck[]) =>
      computeOverall({ visibility: computeVisibility(subset, engineCount), factScore, hasCritical }).score;

    const visibility = computeVisibility(scoringChecks, engineCount);
    const parts = computeVisibilityParts(scoringChecks, engineCount);
    const score = computeOverall({ visibility, factScore, hasCritical }).score;
    const band = runs > 1
      ? scoreBand(Array.from({ length: runs }, (_, r) => scoringChecks.filter(c => c.run === r + 1))
          .filter(subset => subset.length > 0)
          .map(overallFor))
      : { low: score, high: score };

    await db.update(scans).set({
      status: "complete",
      score,
      citationRate: pct(parts.citationRate),
      positionScore: pct(parts.positionQuality),
      breadthScore: pct(parts.engineBreadth),
      visibilityScore: visibility,
      factScore,
      scoreLow: band.low,
      scoreHigh: band.high,
      websiteCheck: await websiteCheck,
      finishedAt: new Date(),
    }).where(eq(scans.id, scan.id));
```

Replace `breakdown.score` with `score` in the completion activity line and the return value. Update the `runScan` doc comment's "audits branded answers" to "fact-checks every answer that names the practice".

- [ ] **Step 6: Run, expect PASS:** `npx vitest run tests/services tests/report tests/app` then `npx tsc --noEmit` (0 errors — fix any remaining judge fakes it reports).
- [ ] **Step 7: Commit** `git add src/db/schema.ts src/services/scan-runner.ts src/lib/queries.ts tests/services/scan-runner.test.ts tests/report/build-report.test.ts tests/app/cron.test.ts && git commit -m "feat: fact-check every answer that names the business, one finding per wrong fact"` (add any other test file you touched in Step 2).

---

### Task 5: Report data — N/A, this scan's facts, weights, explanation

**Files:**
- Modify: `src/report/types.ts`, `src/report/build-report.ts`, `src/report/sample-audit.json`, `src/report/scoring.ts`
- Test: `tests/report/build-report.test.ts`

**Interfaces:**
- Consumes: `explainOverall` (Task 3); `factsConfirmed`, `lastSeenScanId` from queries (Task 4).
- Produces: `Scores.factAccuracy: number | null`; `Scores.overall.explanation: string`; `factScoreView(score: number | null): { ring: number; shown: string | number; label: string; colors: typeof statusColor[keyof typeof statusColor] }` in `src/report/scoring.ts`.

- [ ] **Step 1: Update and add tests** in `tests/report/build-report.test.ts`:
  - In `scanned()`, the judge now also confirms the price when it's right and nothing else: `right: answer.includes("$13") ? ["Botox price"] : []`. Add a fourth answer so "Sunday hours" is actually mentioned correctly: add prompt `{ text: "Is Glow MedSpa open Sunday?", kind: "branded" }` with answer `{ answer: "Glow MedSpa is closed on Sundays.", citations: [] }` and make the judge return `right: ["Sunday hours"]` for it. Update `brandedQuestionCount: 2` in the `r.scan` expectation.
  - Keep `expect(r.facts.filter(f => f.isTrue).map(f => f.topic)).toEqual(["Sunday hours"]);`.
  - Replace the two component assertions at the end with:
    ```ts
    expect(r.scores.components.map(c => [c.id, c.weight])).toEqual([["named_often", 41], ["rank_high", 17], ["tool_reach", 12], ["accuracy", 30]]);
    expect(r.scores.factAccuracy).toBe(82);
    expect(r.scores.overall.explanation).toMatch(/^Overall = 70% visibility \(\d+\) \+ 30% fact accuracy \(82\) = \d+\.$/);
    ```
  - Add:
    ```ts
    it("shows N/A and visibility-only weights when nothing was fact-checked", async () => {
      const db = await makeTestDb();
      const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", prompts: [{ text: "Best med spa", kind: "category" }] });
      await runScan(db, practiceId, [{ name: "openai", run: async () => ({ answer: "Glow MedSpa.", citations: [] }) }],
        async () => ({ wrong: [], right: [] }), async () => []);
      const r = (await buildAuditReportData(db, practiceId))!;
      expect(r.scores.factAccuracy).toBeNull();
      expect(r.scores.components.map(c => c.weight)).toEqual([59, 23, 18]);
      expect(r.scores.overall.explanation).toMatch(/No facts were checked/);
      expect(r.facts).toEqual([]);
    });

    it("lists only this scan's wrong facts, with plain truth text when no fact matched", async () => {
      const db = await makeTestDb();
      const { practiceId } = await seedPractice(db, {
        name: "Glow MedSpa", prompts: [{ text: "Glow MedSpa services?", kind: "branded" }],
        facts: [{ category: "services", label: "Lasers", value: "No laser treatments" }],
      });
      const say = (claim: string) => runScan(db, practiceId,
        [{ name: "openai", run: async () => ({ answer: "Glow MedSpa.", citations: [] }) }],
        async () => ({ wrong: [{ claim, factLabel: null, severity: "minor" as const }], right: [] }), async () => []);
      await say("Has a rooftop pool");
      await say("Offers dog grooming");
      const r = (await buildAuditReportData(db, practiceId))!;
      const wrong = r.facts.filter(f => !f.isTrue);
      expect(wrong.map(f => f.aiSaid)).toEqual(["Offers dog grooming"]);
      expect(wrong[0].truth).toBe("Your fact sheet doesn't back this up.");
    });
    ```

- [ ] **Step 2: Run, expect FAIL:** `npx vitest run tests/report`

- [ ] **Step 3: Implement.**

`src/report/types.ts` — in `ScoreComponent` change the weight comment to `// max points out of 100; the parts always sum to 100`. In `Scores`:
```ts
  overall: { value: number; min: number; max: number; explanation: string }; // min/max across runs
  visibility: number;           // 0–100
  factAccuracy: number | null;  // 0–100; null = nothing was fact-checked (show "N/A")
```

`src/report/sample-audit.json` — read its `scores.visibility`, `scores.factAccuracy` and `scores.overall.value`. Add `scores.overall.explanation` set to exactly the string `explainOverall({ visibility, factScore: factAccuracy, hasCritical })` returns for those numbers (`hasCritical` = the sample has a critical wrong fact in `facts`), and set `overall.value` to `computeOverall(...)` of the same so the preview is consistent. Change the sample's component weights to 41 / 17 / 12 / 30. Confirm with `npx vitest run tests/report/scoring.test.ts`.

`src/report/scoring.ts` — add, after `bandColors`:
```ts
/** How to show a fact score that may be missing: grey "N/A" instead of a red 0. */
export function factScoreView(score: number | null) {
  if (score === null) return { ring: 0, shown: "N/A" as string | number, label: "Not checked", colors: statusColor.neutral };
  const band = scoreBand(score);
  return { ring: score, shown: score as string | number, label: bandLabel[band], colors: bandColors(band) };
}
```
(import `statusColor` from `@/report/tokens` if it isn't already.)

`src/report/build-report.ts`:
- import `explainOverall` alongside `computeVisibility` from `@/core/scoring`.
- Replace the facts block (from `// Facts: every open wrong fact…` through the `facts` array) with:
```ts
  // Facts: only what AI said about them this scan. Wrong = open findings this
  // scan repeated; right = facts the judge confirmed and nobody got wrong.
  const ownDomain = domainOf(practice.website?.includes("://") ? practice.website : `https://${practice.website ?? ""}`);
  const open = priceFirst(findingRows.filter(f => f.status === "open" && f.lastSeenScanId === scan.id));
  const wrongFactIds = new Set(open.map(f => f.factId).filter(Boolean));
  const confirmed = new Set(checks.flatMap(c => c.factsConfirmed));
  const facts: FactCheck[] = [
    ...open.map((f): FactCheck => { /* body unchanged except: */ }),
    ...factRows.filter(r => confirmed.has(r.id) && !wrongFactIds.has(r.id)).map((r): FactCheck => ({
      id: r.id, topic: r.label, isTrue: true, truth: r.value,
    })),
  ];
```
  keeping the existing `open.map` body, with `truth: f.factValue ?? "Your fact sheet doesn't back this up.",`.
- Replace `const factScore = scan.factScore ?? scan.accuracyScore ?? 100;` with:
```ts
  const factScore = scan.factScore ?? null;
  const visibilityScore = scan.visibilityScore ?? 0;
  const explanation = explainOverall({
    visibility: visibilityScore, factScore, hasCritical: open.some(f => f.severity === "critical"),
  });
  // Points out of 100 each part can earn: visibility's 50/20/15 split scaled
  // into its 70% share (or the whole 100 when facts weren't checked), facts 30.
  const w = factScore === null
    ? { named: 59, rank: 23, reach: 18 }
    : { named: 41, rank: 17, reach: 12 };
```
- In the returned `scores`: `overall: { value: …, min: …, max: …, explanation }`, `visibility: visibilityScore`, `factAccuracy: factScore`, component weights `w.named`, `w.rank`, `w.reach`, and the accuracy component only when checked:
```ts
      components: [
        { id: "named_often", …, weight: w.named, … },
        { id: "rank_high", …, weight: w.rank, … },
        { id: "tool_reach", …, weight: w.reach, … },
        ...(factScore === null ? [] : [{ id: "accuracy" as const, label: "How accurate AI is about you",
          definition: "Whether what AI says about you matches your confirmed facts.",
          weight: 30, score: factScore, detail: `${open.length} wrong fact${open.length === 1 ? "" : "s"}` }]),
      ],
```

- [ ] **Step 4: Run, expect PASS:** `npx vitest run tests/report`. `npx tsc --noEmit` will now flag pages that treat `factAccuracy` as a number — fixed in Task 6; commit only this task's files.
- [ ] **Step 5: Commit** `git add src/report/types.ts src/report/build-report.ts src/report/sample-audit.json src/report/scoring.ts tests/report/build-report.test.ts && git commit -m "feat: report shows N/A, this scan's facts only, and the overall's maths"`

---

### Task 6: Pages, dashboard, admin, docs

**Files:**
- Modify: `src/report/pages/master-score-tools.tsx`, `src/report/pages/master-summary.tsx`, `src/report/pages/f-cover.tsx`, `src/report/pages/f-true-false.tsx`, `src/report/pages/master-wrong-facts.tsx`
- Modify: `src/app/dashboard/[slug]/page.tsx`, `src/app/admin/practices/[id]/page.tsx`
- Modify: `docs/audit-design/HANDOFF.md`

**Interfaces:**
- Consumes: `factScoreView` (Task 5), `explainOverall` (Task 3), `r.scores.overall.explanation`, `findings.lastSeenScanId`.

- [ ] **Step 1: Fact pages.** In `f-cover.tsx`, `f-true-false.tsx`, `master-wrong-facts.tsx`, replace the `score`/`band`/`bc` (or `ring`) lines with `const fs = factScoreView(r.scores.factAccuracy);` (import it from `@/report/scoring`) and use `fs.ring` in `ringDash(...)`, `fs.shown` where `{score}` is printed, `fs.colors` where `bc`/`bandColors(...)` was used, and `fs.label` where `bandLabel[band]` was printed. Remove now-unused imports.

- [ ] **Step 2: Summary page.** In `master-summary.tsx`:
  - Overall tile `def: r.scores.overall.explanation,`.
  - Fact tile: `score: factAccuracy ?? 0`, add `shown: factAccuracy ?? "N/A"` to every tile (`shown: overall.value`, `shown: visibility`), print `{t.shown}` instead of `{t.score}`, and when `factAccuracy === null` use `statusColor.neutral` for that tile's colors and "Not checked" for its band label (compute per tile: `const c = t.name === "Fact accuracy" && factAccuracy === null ? factScoreView(null).colors : bandColors(band)`; same for the label).
  - Pins: `placePins([{ label: "Overall", value: overall.value }, ...(factAccuracy === null ? [] : [{ label: "Accuracy", value: factAccuracy }]), { label: "Visibility", value: visibility }])`.

- [ ] **Step 3: Score page.** In `master-score-tools.tsx`, directly after the donut/parts grid `</div>` (before the first divider), add:
```tsx
      <p style={{ ...text.small, margin: 0, color: "#334155" }}>{r.scores.overall.explanation}</p>
```

- [ ] **Step 4: Dashboard.** In `src/app/dashboard/[slug]/page.tsx`, import `explainOverall` from `@/core/scoring`, and directly after the three `ScoreCard`s' `</section>` add:
```tsx
      <p className="-mt-6 mb-10 text-sm text-zinc-600 dark:text-zinc-400">
        {explainOverall({
          visibility: latestScan.visibilityScore ?? 0,
          factScore: latestScan.factScore,
          hasCritical: openFindings.some(f => f.severity === "critical" && f.lastSeenScanId === latestScan.id),
        })}
      </p>
```
  (`getOpenFindings` selects the whole row, so `lastSeenScanId` is there.)

- [ ] **Step 5: Admin.** In `src/app/admin/practices/[id]/page.tsx`, inside the open-findings row's claim cell:
```tsx
                  <td className="py-2 pr-4 text-black dark:text-zinc-50">
                    {finding.claim}
                    {latestScan && finding.lastSeenScanId !== latestScan.id && (
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        not seen in latest scan
                      </span>
                    )}
                  </td>
```
  (check `latestScan` is in scope at that point; it is used at line ~284.)

- [ ] **Step 6: Docs.** In `docs/audit-design/HANDOFF.md` replace the line `- **Overall score** = \`round(Σ score × weight / 100)\`. The weights are 40 / 30 / 18 / 12 and must add up to 100.` with:
```
- **Overall score** = 70% visibility + 30% fact accuracy (`computeOverall` in `src/core/scoring.ts`); visibility alone when no facts were checked; 0 when AI never names the business; capped at 70 while a serious wrong fact from the latest scan is open. Component weights shown on P03 are 41 / 17 / 12 / 30 (or 59 / 23 / 18 with no fact check). The line under the score (`scores.overall.explanation`) spells out the maths.
```

- [ ] **Step 7: Verify everything.**
  - `npx tsc --noEmit` → 0 errors
  - `npx eslint src scripts` → clean
  - `npm test` → all pass (was 314; expect ~330)
  - `npm run dev`, open `/admin/report-preview` and one real `/dashboard/<slug>/audit?variant=master` and `?variant=factcheck`: P03 shows the explanation line; fact pages show N/A in grey for a practice with no facts.
- [ ] **Step 8: Commit** `git add src/report/pages/master-score-tools.tsx src/report/pages/master-summary.tsx src/report/pages/f-cover.tsx src/report/pages/f-true-false.tsx src/report/pages/master-wrong-facts.tsx "src/app/dashboard/[slug]/page.tsx" "src/app/admin/practices/[id]/page.tsx" docs/audit-design/HANDOFF.md && git commit -m "feat: show the overall's weights and N/A fact scores across report, dashboard and admin"`

---

## After the build

Before deploy: `npm run db:push` against production (adds `facts_confirmed`, `last_seen_scan_id`, plus this branch's other pending columns).
