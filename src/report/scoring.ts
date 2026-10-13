/**
 * Mirror reports: derived values.
 *
 * Pure functions, no framework. Every color, label, sort order and
 * headline in the reports comes from here so the reports always agree. Colors reference `tokens.ts`.
 */
import type {
  AuditReport, ScoreComponent, ToolResult, LeaderboardEntry, FactCheck,
  WebsiteCheck, Tone, SourceShare, Level, Severity, CheckStatus, ToolId,
} from '@/report/types';
import { color, statusColor, toolMeta, sourceColor } from '@/report/tokens';

/* ------------------------------------------------------------------ */
/* Score bands                                                         */
/* ------------------------------------------------------------------ */

export type Band = 'needs_work' | 'fair' | 'strong';

/** 0–100 scores (overall, visibility, accuracy, sub-scores). */
export function scoreBand(score: number): Band {
  if (score >= 70) return 'strong';
  if (score >= 40) return 'fair';
  return 'needs_work';
}

/** "Named in X% of answers" rates use a lower bar than scores. */
export function rateBand(pct: number): Band {
  if (pct >= 40) return 'strong';
  if (pct >= 20) return 'fair';
  return 'needs_work';
}

export const bandLabel: Record<Band, string> = {
  needs_work: 'Needs work',
  fair: 'Fair',
  strong: 'Strong',
};
/** Rate bands say "Weak" instead of "Needs work" on tool cards. */
export const rateBandLabel: Record<Band, string> = {
  needs_work: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
};

export function bandColors(b: Band) {
  return statusColor[b === 'strong' ? 'good' : b === 'fair' ? 'warn' : 'bad'];
}

/* ------------------------------------------------------------------ */
/* Score maths                                                         */
/* ------------------------------------------------------------------ */

/** Overall = round( Σ score × weight / 100 ). Weights must sum to 100. */
export function overallScore(components: ScoreComponent[]): number {
  return Math.round(components.reduce((s, c) => s + (c.score * c.weight) / 100, 0));
}

/** Visibility = the three visibility components, rescaled to 0–100. */
export function visibilityScore(components: ScoreComponent[]): number {
  const vis = components.filter((c) => c.id !== 'accuracy');
  const raw = vis.reduce((s, c) => s + (c.score * c.weight) / 100, 0);
  const max = vis.reduce((s, c) => s + c.weight, 0);
  return Math.round((raw / max) * 100);
}

/**
 * Whole points per component that add up exactly to `total` (largest-remainder
 * rounding). `total` defaults to the components' own sum; pass the stored
 * overall so the donut always matches the number in its centre. When the
 * overall is lower than the parts (never named => 0, or the serious-error
 * cap), the parts are scaled down to it. Sample: 5 + 5 + 10 + 21 = 41.
 */
export function componentPoints(components: ScoreComponent[], total = overallScore(components)): number[] {
  const raw = components.map((c) => (c.score * c.weight) / 100);
  const sum = raw.reduce((a, b) => a + b, 0);
  const exact = sum > total && sum > 0 ? raw.map((v) => (v * total) / sum) : raw;
  const floors = exact.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) { if (left <= 0) break; floors[i] += 1; left -= 1; }
  return floors;
}

/** Fact accuracy = share of checked facts that are true. */
export function factAccuracy(facts: FactCheck[]): number {
  if (!facts.length) return 100;
  return Math.round((facts.filter((f) => f.isTrue).length / facts.length) * 100);
}

export function pct(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 100) : 0;
}

/* ------------------------------------------------------------------ */
/* Chart geometry                                                      */
/* ------------------------------------------------------------------ */

/** SVG ring: apply as stroke-dasharray on a circle rotated -90°. */
export function ringDash(value0to100: number, radius: number): string {
  const c = 2 * Math.PI * radius;
  return `${(Math.max(0, Math.min(100, value0to100)) / 100) * c} ${c}`;
}

/**
 * Donut as a CSS conic-gradient with a thin white gap between slices.
 * Zero-size slices are skipped. `gapPct` is in percent of the circle.
 */
export function conicDonut(slices: { value: number; color: string }[], gapPct = 0.6, rest?: string): string {
  const total = rest ? 100 : slices.reduce((s, x) => s + x.value, 0) || 1;
  let at = 0;
  const stops: string[] = [];
  for (const s of slices.filter((x) => x.value > 0)) {
    const w = (s.value / total) * 100;
    stops.push(`${s.color} ${at}% ${at + w - gapPct}%`, `${color.surface} ${at + w - gapPct}% ${at + w}%`);
    at += w;
  }
  if (rest) stops.push(`${rest} ${at}% 100%`);
  return `conic-gradient(${stops.join(', ')})`;
}

/* ------------------------------------------------------------------ */
/* Lists: sorting and flags                                            */
/* ------------------------------------------------------------------ */

export function sortedTools(results: ToolResult[]) {
  const rows = [...results].sort((a, b) => b.named - a.named);
  const max = rows[0]?.named ?? 0;
  const min = rows[rows.length - 1]?.named ?? 0;
  return rows.map((r) => {
    const p = pct(r.named, r.total);
    return {
      ...r, ...toolMeta[r.tool], pct: p, band: rateBand(p),
      isBest: max > min && r.named === max,
      isWorst: max > min && r.named === min,
    };
  });
}

export function sortedLeaderboard(entries: LeaderboardEntry[]) {
  const rows = [...entries].sort((a, b) => b.count - a.count);
  const max = rows[0]?.count || 1;
  return rows.map((e, i) => ({ ...e, rank: i + 1, barPct: pct(e.count, max) }));
}

const severityRank: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };

/** Wrong facts: price errors first, then critical → major → minor. */
export function sortedWrongFacts(facts: FactCheck[]) {
  return facts
    .filter((f) => !f.isTrue)
    .sort((a, b) =>
      Number(!!b.isPrice) - Number(!!a.isPrice) ||
      severityRank[a.severity ?? 'minor'] - severityRank[b.severity ?? 'minor'],
    );
}

export function severityCounts(facts: FactCheck[]): Record<Severity, number> {
  const out = { critical: 0, major: 0, minor: 0 };
  for (const f of facts) if (!f.isTrue && f.severity) out[f.severity] += 1;
  return out;
}

export function mistakesByTool(facts: FactCheck[], tools: ToolId[]) {
  return tools.map((t) => ({ tool: t, ...toolMeta[t], wrong: facts.filter((f) => !f.isTrue && f.tool === t).length }));
}

/** Website checks: fail → warn → pass. */
export function sortedChecks(checks: WebsiteCheck[]) {
  const o: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2 };
  return [...checks].sort((a, b) => o[a.status] - o[b.status]);
}

export function toneTotal(t: Tone) {
  return t.recommended + t.justListed + t.mixed + t.warnedAgainst;
}

/** Effort: low is good. Impact: high is good. */
export function effortColor(l: Level) {
  return statusColor[l === 'low' ? 'good' : l === 'medium' ? 'warn' : 'bad'];
}
export function impactColor(l: Level) {
  return l === 'high' ? statusColor.good : l === 'medium' ? statusColor.warn : statusColor.neutral;
}
export const levelLabel: Record<Level, string> = { low: 'Low', medium: 'Medium', high: 'High' };

/** Action matrix quadrant, for the effort/impact chart. */
export function quadrant(effort: Level, impact: Level): 'quick_win' | 'big_project' | 'easy_extra' | 'later' {
  const hiImpact = impact === 'high';
  const loEffort = effort === 'low';
  if (hiImpact && loEffort) return 'quick_win';
  if (hiImpact) return 'big_project';
  if (loEffort) return 'easy_extra';
  return 'later';
}

export function sourceSlices(types: SourceShare[]) {
  return types.map((t) => ({ value: t.pct, color: sourceColor[t.type] }));
}

/* ------------------------------------------------------------------ */
/* Headlines ("takeaway" lines above each chart)                       */
/* ------------------------------------------------------------------ */

export function headlines(r: AuditReport) {
  const client = r.leaderboard.find((e) => e.isClient);
  const lb = sortedLeaderboard(r.leaderboard);
  const clientRank = lb.find((e) => e.isClient)?.rank;
  const buyerAnswers = r.scan.buyerQuestionCount * r.scan.runsPerQuestion * r.scan.tools.length;
  const tools = sortedTools(r.toolResults);
  const best = tools.find((t) => t.isBest);
  const zero = tools.filter((t) => t.named === 0);
  const wrong = sortedWrongFacts(r.facts);
  const priceWrong = wrong.some((f) => f.isPrice);
  const trueCount = r.facts.filter((f) => f.isTrue).length;
  const checksPassed = r.websiteChecks.filter((c) => c.status === 'pass').length;

  return {
    verdict:
      `When people ask AI for a ${r.business.category.toLowerCase()} in ${r.business.location.split(',')[0]}, ` +
      `${r.business.name} comes up in ${client?.count ?? 0} of ${buyerAnswers} answers. ` +
      `${r.topCompetitor.name} comes up in ${r.topCompetitor.namedCount}.`,
    leaderboard: `${lb[0]?.name} was named in ${lb[0]?.count} of ${buyerAnswers} answers. You were named in ${client?.count ?? 0}${clientRank ? `, #${clientRank} on the list` : ''}.`,
    tools: best
      ? `${toolMeta[best.tool].name} names you most, ${best.named} of ${best.total} times.` +
        (zero.length ? ` ${zero.map((z) => toolMeta[z.tool].name).join(' and ')} never named you.` : '')
      : 'Every AI tool named you about equally.',
    closestWins: r.closestWins.length
      ? `You placed 2nd or 3rd in ${r.closestWins.length} answers. These are the easiest to turn into wins.`
      : 'You didn’t place 2nd or 3rd anywhere, so there are no quick flips yet.',
    tone: `When AI names you, ${r.tone.recommended} of ${toneTotal(r.tone)} answers recommend you` +
      (r.tone.warnedAgainst ? `, and ${r.tone.warnedAgainst} warn against you.` : ', and none warn against you.'),
    sources: `Your own website was cited in ${r.sources.ownSiteCitedPct}% of answers.`,
    outreach: r.sources.competitorWinSites.length
      ? `When a competitor won, AI read these ${r.sources.competitorWinSites.length} sites. Get on them.`
      : 'No sites stood out when competitors won.',
    searches: r.searches.queries.length ? null /* write per client; e.g. "AI searched for prices, reviews and Saturday hours before naming anyone." */ : 'No web searches were recorded in this scan.',
    facts: wrong.length
      ? `AI got ${wrong.length} fact${wrong.length > 1 ? 's' : ''} wrong about you${priceWrong ? ', including your price. Price errors come first.' : '.'}`
      : 'AI got every fact we checked right.',
    factVerdict: wrong.length
      ? `AI gets ${trueCount} of ${r.facts.length} facts about ${r.business.name} right.`
      : `AI gets every fact about ${r.business.name} right.`,
    website: checksPassed === r.websiteChecks.length
      ? 'Your site passed every check. AI can read it and find your key facts.'
      : `${checksPassed} of ${r.websiteChecks.length} checks passed.`,
  };
}

/* ------------------------------------------------------------------ */
/* The four reports                                                    */
/* ------------------------------------------------------------------ */

export type Variant = 'summary' | 'visibility' | 'factcheck' | 'master';

/**
 * Page order per report. Each id maps to a component in pages/index.ts. The
 * recommendation report and the fact check are the full report's own pages
 * on one subject each, so the three never disagree.
 */
export const variantPages: Record<Variant, string[]> = {
  summary: ['one_page'],
  visibility: ['score_and_tools', 'competitors', 'sources', 'action_plan', 'closing'],
  factcheck: ['wrong_facts', 'action_plan', 'closing'],
  master: ['overview', 'score_and_tools', 'competitors', 'wrong_facts', 'sources', 'action_plan', 'closing'],
};

/**
 * The reports as a customer is offered them, shortest first: on the Reports
 * tab, in the report viewer's switcher and as the PDF's file name.
 */
export const VARIANT_INFO: { key: Variant; label: string; title: string; blurb: string }[] = [
  { key: 'summary', label: 'Summary', title: 'One-page summary', blurb: 'Your three scores, who AI recommends over you and the three changes that help most.' },
  { key: 'visibility', label: 'Recommendations', title: 'Who AI recommends', blurb: 'How often each AI tool names you, who it names over you, the sites it relies on and what gets you named more.' },
  { key: 'factcheck', label: 'Fact check', title: 'What AI gets wrong', blurb: 'Every wrong fact AI states about you, next to the truth, with where it read it and how to fix it.' },
  { key: 'master', label: 'Full report', title: 'Full report', blurb: 'Everything: your scores, every AI tool, who AI recommends, wrong facts, the sites AI relies on and what to do first.' },
];

/** "1 page", "7 pages". */
export function pageCountLabel(variant: Variant): string {
  const n = variantPages[variant].length;
  return `${n} page${n === 1 ? '' : 's'}`;
}

/** Whether a string from a URL is one of the reports. */
export function isVariant(value: string | null | undefined): value is Variant {
  return VARIANT_INFO.some(v => v.key === value);
}

/** The downloaded PDF's name: "harbor-plumbing-full-report-2026-10-12.pdf". */
export function pdfFileName(slug: string, variant: Variant, scanDate: string): string {
  const label = VARIANT_INFO.find(v => v.key === variant)!.label.toLowerCase().replace(/\s+/g, '-');
  return `${slug}-${label}-${scanDate}.pdf`;
}

/**
 * Which actions to show. "master" is the first six in priority order (one
 * page). "visibility" is only the actions that get AI to recommend the
 * business more often: what a prospect sees before their facts are confirmed
 * (the one-page summary and the prospect email both use it).
 */
export function actionsFor(set: 'master' | 'visibility', r: AuditReport) {
  if (set === 'master') return r.actions.slice(0, 6);
  return r.actions.filter((a) => a.track === 'visibility' || a.track === 'both');
}

/**
 * Score explanations are written upstream with the old score names. Reports
 * call the scores "Recommended by AI" and "Accuracy".
 */
export function plainScoreNames(text: string): string {
  return text
    .replace(/your visibility/g, 'your Recommended by AI score')
    .replace(/fact accuracy/g, 'Accuracy')
    .replace(/visibility/g, 'Recommended by AI');
}

/**
 * The actions a report's plan page lists. The recommendation report keeps
 * the ones that get the business named more, the fact check the ones that
 * correct a wrong fact; an action that does both is in each.
 */
export function planActions(variant: Variant, r: AuditReport) {
  if (variant === 'visibility') return r.actions.filter((a) => a.track !== 'facts');
  if (variant === 'factcheck') return r.actions.filter((a) => a.track !== 'visibility');
  return r.actions;
}

/** How to show a fact score that may be missing: grey "N/A" instead of a red 0. */
export function factScoreView(score: number | null) {
  if (score === null) return { ring: 0, shown: "N/A" as string | number, label: "Not checked", colors: statusColor.neutral };
  const band = scoreBand(score);
  return { ring: score, shown: score as string | number, label: bandLabel[band], colors: bandColors(band) };
}
