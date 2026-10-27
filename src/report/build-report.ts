import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { facts as factsTable, nameVariations, practices, scans } from "@/db/schema";
import { getChecksForScan, getFindingsForPractice, getLatestScan, priceFirst } from "@/lib/queries";
import { buildCompetitorReport } from "@/lib/competitor-report";
import { buildSourcesReport, type SourceKind } from "@/core/citations";
import { buildSearchReport } from "@/core/search-queries";
import { fixAdvice } from "@/core/fix-list";
import { pagesWanted, WEBSITE_FIXES } from "@/core/action-plan";
import { computeVisibility, displayScores, explainOverall, shownScore } from "@/core/scoring";
import { coverageLabel } from "@/core/coverage";
import { extractSnippet } from "@/core/mention";
import { nameKey } from "@/core/competitors";
import type { Engine, Position } from "@/core/types";
import { runWebsiteCheck } from "@/services/website-check";
import { toolMeta } from "@/report/tokens";
import type {
  Action, AuditReport, BuyerQuestion, ClosestWin, FactCheck, OutreachSite, Quote, SourceType, ToolId,
} from "@/report/types";

/**
 * Turns the latest completed scan for a practice into the report's
 * `AuditReport`. Everything is read from stored scan data (answers, citations,
 * searches, tone, findings, the website check); the only network call is the
 * website check, run once and saved when a scan predates it.
 */

const TOOL_OF: Record<Engine, ToolId> = {
  openai: "chatgpt", anthropic: "claude", gemini: "gemini", grok: "grok", perplexity: "perplexity",
  google: "google",
};
const TOOL_ORDER: ToolId[] = ["chatgpt", "claude", "gemini", "grok", "perplexity", "google"];

const SOURCE_TYPE: Record<SourceKind, SourceType> = {
  own_site: "own_website", reviews: "reviews_directories", social: "reddit_social",
  reference: "reference", google: "google", press: "articles", other: "articles",
};

const OUTREACH_ASK: Record<SourceType, string> = {
  reviews_directories: "Claim your listing, fix the details, and ask happy customers for reviews.",
  reddit_social: "Join the threads where people ask about this. Answer honestly, as yourself.",
  articles: "Pitch to be included next time they update their list.",
  reference: "Check your entry is accurate and complete.",
  google: "Complete your Google Business Profile: services, prices, hours, photos.",
  own_website: "",
};

type Check = Awaited<ReturnType<typeof getChecksForScan>>[number];

// The scan runner marks a namesake veto (the answer named a different
// business with the client's name) with this prefix on the tone reason.
const isNamesake = (c: Check) => c.toneReason?.startsWith("Different business:") ?? false;

/** Every other business the scan found in a check, for the matcher's longer-name guard. */
const othersOf = (c: Pick<Check, "competitorsMentioned" | "namedOrder">) =>
  Array.from(new Set([...c.competitorsMentioned, ...c.namedOrder]));

/** Percentages that add up to exactly 100 (largest remainder). */
function toPercents(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const exact = counts.map(c => (c / total) * 100);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r).forEach(({ i }) => {
    if (left > 0) { out[i]++; left--; }
  });
  return out;
}

function bareWebsite(url: string | null): string {
  return (url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

/** The opening sentences of an answer, markdown stripped, cut at a sentence end near `max` characters. */
function firstSentences(text: string, max: number): string {
  const plain = text.replace(/[*_#>`]+/g, "").replace(/\[(.*?)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > max * 0.4 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function mostCommon<T>(items: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Position of a named business in one answer, the way scoring grades the client. */
function positionOf(index: number): Position {
  if (index < 0) return "absent";
  if (index === 0) return "first";
  if (index < 3) return "top3";
  return "mentioned";
}

export async function buildAuditReportData(db: Db, practiceId: string): Promise<AuditReport | null> {
  const scan = await getLatestScan(db, practiceId);
  if (!scan) return null;

  const [[practice], variations, checks, findingRows, factRows] = await Promise.all([
    db.select().from(practices).where(eq(practices.id, practiceId)),
    db.select().from(nameVariations).where(eq(nameVariations.practiceId, practiceId)),
    getChecksForScan(db, scan.id),
    getFindingsForPractice(db, practiceId),
    db.select().from(factsTable).where(and(eq(factsTable.practiceId, practiceId), eq(factsTable.status, "active"))),
  ]);
  const names = Array.from(new Set([practice.name, ...variations.map(v => v.text)]));
  const clientKeys = new Set(names.map(nameKey));
  const isClient = (n: string) => clientKeys.has(nameKey(n));

  // Website check: from the scan, or run once now and saved for next time.
  let site = scan.websiteCheck ?? null;
  if (!site && practice.website) {
    site = await runWebsiteCheck(practice.website, undefined, { names }).catch(() => null);
    if (site) await db.update(scans).set({ websiteCheck: site }).where(eq(scans.id, scan.id));
  }

  const tools = TOOL_ORDER.filter(t => checks.some(c => TOOL_OF[c.engine] === t));
  const earned = checks.filter(c => c.promptKind !== "branded");
  const buyerPrompts = [...new Map(earned.map(c => [c.promptId, c.promptText])).entries()];
  const brandedCount = new Set(checks.filter(c => c.promptKind === "branded").map(c => c.promptId)).size;

  // Tools
  const toolResults = tools.map(tool => {
    const rows = earned.filter(c => TOOL_OF[c.engine] === tool);
    return { tool, named: rows.filter(c => c.mentioned).length, total: rows.length };
  });

  // Leaderboard and top competitor
  const cr = buildCompetitorReport(earned, names);
  const leaderboard = cr.shareOfVoice.slice(0, 12).map(s => ({ name: s.name, count: s.mentions, isClient: s.isPractice }));
  const clientCount = earned.filter(c => c.mentioned).length;
  const clientRow = leaderboard.find(e => e.isClient);
  if (clientRow) clientRow.count = clientCount;
  const top = cr.shareOfVoice.find(s => !s.isPractice);
  const topKey = top ? nameKey(top.name) : null;
  const competitorChecks = earned.map(c => {
    const idx = topKey ? c.namedOrder.findIndex(n => nameKey(n) === topKey) : -1;
    return { engine: c.engine, promptKind: c.promptKind, mentioned: idx >= 0, position: positionOf(idx) };
  });
  const topCompetitor = {
    name: top?.name ?? "No competitor named",
    // On the shown scale, like the business's own score beside it.
    visibility: shownScore(top ? computeVisibility(competitorChecks, tools.length) : 0)!,
    namedCount: competitorChecks.filter(c => c.mentioned).length,
  };

  // Question grid and closest wins
  const questions: BuyerQuestion[] = buyerPrompts.map(([id, text]) => ({
    id, text,
    cells: tools.map(tool => {
      const runs = earned.filter(c => c.promptId === id && TOOL_OF[c.engine] === tool);
      const firsts = runs.map(c => c.namedOrder[0]).filter(Boolean);
      const ranks = runs.map(c => c.namedOrder.findIndex(isClient)).filter(i => i >= 0).map(i => i + 1);
      return {
        tool,
        firstNamed: (mostCommon(firsts) && isClient(mostCommon(firsts)!)) ? "You" : (mostCommon(firsts) ?? "No one named"),
        clientRank: ranks.length ? Math.round(ranks.sort((a, b) => a - b)[Math.floor(ranks.length / 2)]) : null,
        runsAppeared: runs.filter(c => c.mentioned).length,
      };
    }),
  }));
  const closestWins: ClosestWin[] = [];
  for (const q of questions) {
    for (const cell of q.cells) {
      if (cell.clientRank !== 2 && cell.clientRank !== 3) continue;
      const run = earned.find(c => c.promptId === q.id && TOOL_OF[c.engine] === cell.tool &&
        c.namedOrder.findIndex(isClient) + 1 === cell.clientRank);
      closestWins.push({
        questionId: q.id, tool: cell.tool, rank: cell.clientRank,
        ahead: run ? run.namedOrder.slice(0, cell.clientRank - 1) : [],
        runsAppeared: cell.runsAppeared,
      });
    }
  }
  closestWins.sort((a, b) => a.rank - b.rank || b.runsAppeared - a.runsAppeared);

  // Tone and quotes
  const toned = checks.filter(c => c.mentioned && c.tone);
  const count = (t: string) => toned.filter(c => c.tone === t).length;
  const quoteFrom = (c: Check | undefined): Quote | undefined => {
    if (!c) return undefined;
    // The row's competitors are the names the scan knew when it counted the
    // mention; without them "Glow MedSpa and Skin Bar LA are both good" reads
    // as one longer name and the sentence that earned the row is skipped.
    const snippet = extractSnippet(c.answerText, names, othersOf(c)) ?? c.toneReason;
    return snippet ? { text: snippet.slice(0, 260), tool: TOOL_OF[c.engine], questionId: c.promptId } : undefined;
  };

  // The quote an owner reads first: a buyer question where AI recommended
  // others and not them. ChatGPT first, since that's the one they've heard of.
  // Never a vetoed namesake: its text carries the client's own name.
  const missed = [...earned]
    .filter(c => c.promptKind === "category" && !c.mentioned && c.namedOrder.length > 0 && !isNamesake(c))
    .sort((a, b) => Number(b.engine === "openai") - Number(a.engine === "openai") || a.run - b.run)[0];
  const missedQuote = missed ? {
    question: missed.promptText,
    text: firstSentences(missed.answerText, 260),
    tool: TOOL_OF[missed.engine],
    named: missed.namedOrder.slice(0, 3),
  } : undefined;

  // Sources
  const sources = buildSourcesReport(checks, practice.website);
  const kinds: SourceType[] = ["articles", "reviews_directories", "reddit_social", "own_website", "google", "reference"];
  const kindCounts = kinds.map(t => sources.kindMix
    .filter(k => SOURCE_TYPE[k.kind] === t).reduce((s, k) => s + k.answers, 0));
  const pcts = toPercents(kindCounts);
  const competitorWinSites: OutreachSite[] = sources.gaps.slice(0, 8).map(g => ({
    domain: g.domain, ask: OUTREACH_ASK[SOURCE_TYPE[g.kind]] || OUTREACH_ASK.articles,
  }));

  // Searches
  const searchReport = buildSearchReport(checks);
  const addedWords = searchReport.addedWords.slice(0, 8).map(w => w.word);

  // Facts: only what AI said about them this scan. Wrong = open findings this
  // scan repeated; right = facts the judge confirmed and nobody got wrong.
  const open = priceFirst(findingRows.filter(f => f.status === "open" && f.lastSeenScanId === scan.id));
  const wrongFactIds = new Set(open.map(f => f.factId).filter(Boolean));
  const confirmed = new Set(checks.flatMap(c => c.factsConfirmed));
  const facts: FactCheck[] = [
    ...open.map((f): FactCheck => {
      const fix = fixAdvice(f.citations, practice.website);
      const label = factRows.find(r => r.id === f.factId)?.label;
      return {
        id: f.id, topic: label ?? "Other claim", isTrue: false,
        truth: f.factValue ?? "Your fact sheet doesn't back this up.",
        aiSaid: f.claim, tool: TOOL_OF[f.engine], severity: f.severity, isPrice: f.factCategory === "pricing",
        sources: fix.sources,
        fix: fix.advice,
      };
    }),
    ...factRows.filter(r => confirmed.has(r.id) && !wrongFactIds.has(r.id)).map((r): FactCheck => ({
      id: r.id, topic: r.label, isTrue: true, truth: r.value,
    })),
  ];

  const websiteChecks = site?.checks ?? [];

  // Actions, in priority order.
  const actions: Action[] = [];
  const add = (a: Omit<Action, "id">) => actions.push({ ...a, id: `a${actions.length + 1}` });
  const priceWrong = open.filter(f => f.factCategory === "pricing");
  const otherWrong = open.filter(f => f.factCategory !== "pricing");
  if (priceWrong.length) add({
    title: "Fix your price everywhere it appears", why: "Price is the fact AI gets wrong most, and the one customers act on.",
    fixes: `${priceWrong.length} wrong price${priceWrong.length === 1 ? "" : "s"}`, effort: "low", impact: "high", track: "facts",
  });
  if (otherWrong.length) add({
    title: "Correct the wrong facts at their source", why: "AI repeats a mistake until the page it read is fixed.",
    fixes: `${otherWrong.length} wrong fact${otherWrong.length === 1 ? "" : "s"}`, effort: "medium", impact: "high", track: "facts",
  });
  const failing = websiteChecks.filter(c => c.status !== "pass");
  for (const c of failing) {
    // The same titles as the action plan's; a website fix doesn't wait for confirmed facts.
    const meta = WEBSITE_FIXES[c.id];
    if (meta) add({ ...meta, track: "both", why: c.why, fixes: `website check: ${c.label.toLowerCase()}` });
  }
  if (sources.gaps.length) add({
    title: `Get featured on ${sources.gaps.slice(0, 2).map(g => g.domain).join(" and ")}`,
    why: "AI reads these sites when it recommends a competitor instead of you.",
    fixes: `${sources.gaps.length} competitor-only source${sources.gaps.length === 1 ? "" : "s"}`, effort: "medium", impact: "high", track: "visibility",
  });
  if (closestWins.length) add({
    title: "Turn your closest calls into wins", why: "You already place 2nd or 3rd on these questions; small gains flip them.",
    fixes: `${closestWins.length} near miss${closestWins.length === 1 ? "" : "es"}`, effort: "medium", impact: "high", track: "visibility",
  });
  const missingPages = pagesWanted(addedWords, site).filter(p => p.status !== "have");
  if (missingPages.length) add({
    title: `Add ${missingPages[0].page.toLowerCase()}`, why: "AI searched for this before answering and didn't find it on your site.",
    fixes: `searches for "${missingPages.map(p => p.word).join("\", \"")}"`, effort: "medium", impact: "medium", track: "visibility",
  });
  const warned = count("negative") + count("mixed");
  if (warned) add({
    title: "Answer the complaint AI repeats", why: "When AI names you with a caveat, the reason is usually a review or old page you can respond to.",
    fixes: `${warned} answer${warned === 1 ? "" : "s"} with a caveat`, effort: "medium", impact: "medium", track: "visibility",
  });
  if (sources.totalAnswers && sources.ownSiteRate < 0.2) add({
    title: "Make your site a source AI quotes", why: `AI cited your website in only ${Math.round(sources.ownSiteRate * 100)}% of answers.`,
    fixes: "own-site citations", effort: "medium", impact: "medium", track: "visibility",
  });
  const silent = toolResults.filter(t => t.total > 0 && t.named === 0);
  if (silent.length && silent.length < toolResults.length) add({
    title: `Get named on ${silent.map(t => toolMeta[t.tool].name).join(" and ")}`,
    why: "Each AI tool leans on different sources, so this gap closes tool by tool.",
    fixes: `${silent.length} tool${silent.length === 1 ? "" : "s"} never naming you`, effort: "high", impact: "medium", track: "visibility",
  });
  // Quick wins first (low effort, high impact), keeping price and facts at the top.
  const weight = (a: Action) => (a.impact === "high" ? 0 : a.impact === "medium" ? 2 : 4) + (a.effort === "low" ? 0 : a.effort === "medium" ? 1 : 2);
  actions.sort((a, b) => weight(a) - weight(b));
  actions.forEach((a, i) => { a.id = `a${i + 1}`; });

  const namedEngines = new Set(earned.filter(c => c.mentioned).map(c => c.engine)).size;
  const earnedTotal = earned.length;
  // Older scans only stored visibility's parts; rebuild it rather than show 0.
  const shown = displayScores(scan);
  const factScore = shown.facts;
  const visibilityScore = shown.visibility ?? 0;
  // Scans from before the split scores have no visibility number; the maths
  // line would be wrong for them, so it is left out until the next scan.
  const explanation = scan.visibilityScore === null ? "" : explainOverall({
    visibility: visibilityScore, factScore, hasCritical: open.some(f => f.severity === "critical"),
  });
  // Points each part can earn. Every business starts at 30 (see shownScore),
  // so the parts share the other 70: visibility's 50/20/15 split scaled into
  // its 70% share (41/17/12, or 59/23/18 when facts weren't checked), facts
  // 30, each times 0.7 and rounded to sum to 70.
  const w = factScore === null
    ? { named: 41, rank: 16, reach: 13, facts: 0 }
    : { named: 29, rank: 12, reach: 8, facts: 21 };
  // Headline scores go into the report as a person sees them; sub-scores stay raw.
  const overall = scan.score ?? 0;

  return {
    business: {
      name: practice.name,
      website: bareWebsite(practice.website),
      location: practice.location?.trim() || "your area",
      category: practice.category?.trim() || "business like yours",
    },
    scan: {
      date: scan.startedAt.toISOString().slice(0, 10),
      tools,
      buyerQuestionCount: buyerPrompts.length,
      brandedQuestionCount: brandedCount,
      runsPerQuestion: scan.runs,
      coverageNote: coverageLabel(scan.coverage ?? null),
    },
    scores: {
      overall: {
        value: shownScore(overall)!, min: shownScore(scan.scoreLow ?? overall)!, max: shownScore(scan.scoreHigh ?? overall)!, explanation,
      },
      visibility: shownScore(visibilityScore)!,
      factAccuracy: shownScore(factScore),
      components: [
        { id: "named_often", label: "How often you're named", definition: "How many answers mention you at all.",
          weight: w.named, score: scan.citationRate ?? 0, detail: `${clientCount} of ${earnedTotal}` },
        { id: "rank_high", label: "How high you rank", definition: "When you're named, how close to the top of the answer.",
          weight: w.rank, score: scan.positionScore ?? 0, detail: "Across category questions" },
        { id: "tool_reach", label: "How many AI tools name you", definition: "How many of the AI assistants name you at least once.",
          weight: w.reach, score: scan.breadthScore ?? 0, detail: `${namedEngines} of ${tools.length} tools` },
        ...(factScore === null ? [] : [{
          id: "accuracy" as const, label: "How accurate AI is about you",
          definition: "Whether what AI says about you matches your confirmed facts.",
          weight: w.facts, score: factScore, detail: `${open.length} wrong fact${open.length === 1 ? "" : "s"}`,
        }]),
      ],
    },
    topCompetitor,
    toolResults,
    leaderboard,
    questions,
    closestWins,
    tone: { recommended: count("positive"), justListed: count("neutral"), mixed: count("mixed"), warnedAgainst: count("negative") },
    quotes: {
      best: quoteFrom(toned.find(c => c.tone === "positive")),
      worst: quoteFrom(toned.find(c => c.tone === "negative") ?? toned.find(c => c.tone === "mixed")),
    },
    sources: {
      types: kinds.map((type, i) => ({ type, pct: pcts[i] })).filter(t => t.pct > 0),
      topSites: sources.sources.slice(0, 10).map(s => ({ domain: s.domain, type: SOURCE_TYPE[s.kind] })),
      competitorWinSites,
      ownSiteCitedPct: Math.round(sources.ownSiteRate * 100),
    },
    searches: {
      queries: searchReport.queries.slice(0, 10).map(q => ({
        query: q.query, tools: [...new Set(q.engines.map(e => TOOL_OF[e as Engine]).filter(Boolean))],
      })),
      addedWords,
      pagesWanted: pagesWanted(addedWords, site),
    },
    facts,
    websiteChecks,
    actions,
    topFixIds: actions.slice(0, 3).map(a => a.id),
    plan90: [
      { when: "Month 1", title: "Fix the facts", items: [
        "Correct every wrong fact at the page AI read it from",
        "Publish a plain facts and pricing page",
        "Fix the website check items",
      ] },
      { when: "Months 2-3", title: "Win more questions", items: [
        "Get listed on the sites AI cites for competitors",
        "Add the pages AI searches for",
        "Monthly re-check and report",
      ] },
    ],
    missedQuote,
    // The same rule as isPreviewOnly in @/lib/auth: paused and not yet unlocked
    // by the operator. Written out here because tests that mock @/lib/auth
    // replace the whole module, and the report builder must not depend on it.
    prospect: !practice.active && !practice.dashboardUnlocked,
    aiOverviews: scan.aiOverviews
      ? { asked: scan.aiOverviews.asked, shown: scan.aiOverviews.shown, namedIn: scan.aiOverviews.namedIn }
      : null,
    contact: {
      name: process.env.CONTACT_NAME || `The ${process.env.NEXT_PUBLIC_APP_NAME || "Mirror"} team`,
      email: process.env.LEADS_EMAIL || process.env.OPERATOR_EMAIL || "",
      bookingUrl: process.env.CALENDLY_URL || `${process.env.APP_URL ?? ""}/book`,
    },
  };
}
