import { domainOf, type SourceKind, type SourcesReport } from "@/core/citations";
import { canonicalName, nameKey, squashedNameKey } from "@/core/competitors";
import type { SearchReport } from "@/core/search-queries";
import type { WebsiteCheckResult, WebsiteCheckRow } from "@/core/website-check";

/**
 * The action plan: a to-do list for the business, built from one scan. Pure,
 * so every rule is testable without a database. Each item points at a real
 * thing the scan saw (a site AI read, a question it lost, a search it ran, a
 * website check), and its key names that thing, so a tick carries over to
 * next week's scan while the thing is still there.
 *
 * Buyer questions only, as everywhere in visibility, and nothing that rests
 * on the fact check: this is the free plan, and facts need a confirmed sheet.
 */

export type Level = "low" | "medium" | "high";
export type GroupKey = "sources" | "questions" | "pages" | "website" | "reputation";

export interface ActionItem {
  key: string;
  title: string;
  why: string;
  how: string;
  evidence: string[];
  effort: Level;
  impact: Level;
}

export interface ActionGroup {
  key: GroupKey;
  title: string;
  intro: string;
  items: ActionItem[];
}

export interface ActionPlan {
  groups: ActionGroup[];
  total: number;
  /** Items that are low effort and high impact. */
  quickWins: number;
}

/** One stored answer, as the plan reads it. */
export interface PlanCheck {
  promptId: string;
  promptText: string;
  promptKind: string;
  engine: string;
  mentioned: boolean;
  competitorsMentioned: string[];
  /** Every business named, the client included, in order. Gives the client's rank. */
  namedOrder?: string[];
  citations: string[];
  searchQueries: string[];
  tone?: string | null;
  toneReason?: string | null;
  answerText?: string;
}

export interface ActionPlanInput {
  checks: PlanCheck[];
  sources: SourcesReport;
  search: SearchReport;
  websiteCheck: WebsiteCheckResult | null;
  website: string | null;
  /** The business's name and its variations, for its rank and for quotes. */
  names?: string[];
  /** Today, for the "Updated <month>" advice. Defaults to now. */
  today?: Date;
}

const GROUPS: Record<GroupKey, { title: string; intro: string }> = {
  sources: {
    title: "Get listed where AI looks",
    intro: "AI read these sites when it recommended a competitor and not you. Being on them puts you in the running.",
  },
  questions: {
    title: "Win the questions you're losing",
    intro: "Buyer questions where AI named other businesses and mostly left you out. Closest calls first.",
  },
  pages: {
    title: "Add what AI searched for",
    intro: "Before answering, AI searched the web for these. Your site doesn't have a page for them yet.",
  },
  website: {
    title: "Fix your website for AI",
    intro: "Things on your site that make it harder for AI to read you or trust what it reads.",
  },
  reputation: {
    title: "Answer the \"but\" in AI's answers",
    intro: "Answers where AI named you, then added a \"but\". Here's what it said.",
  },
};
const ORDER: GroupKey[] = ["sources", "questions", "pages", "website", "reputation"];
const CAP = 8;

// The scan runner marks a namesake veto (the answer named a different
// business with the client's name) with this prefix on the tone reason.
const isNamesake = (c: PlanCheck) => c.toneReason?.startsWith("Different business:") ?? false;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** Quoted, without the markdown bold AI writes in its answers. */
const quote = (s: string) => `“${s.replace(/\*\*/g, "")}”`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");

/** "A", "A and B", "A, B and C". */
function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Businesses named across some answers, each counted once per answer with
 * its spellings together (nameKey, punctuation gone, so "Dunkin'" and
 * "Dunkin" are one), under the first spelling seen. Most named
 * first; a tie goes to the name first in the alphabet.
 */
function competitorCounts(checks: Pick<PlanCheck, "competitorsMentioned">[]): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const c of checks) {
    const seen = new Set<string>();
    for (const name of c.competitorsMentioned) {
      const key = squashedNameKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const row = counts.get(key) ?? { name: canonicalName(name), count: 0 };
      row.count++;
      counts.set(key, row);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function domainsOf(c: Pick<PlanCheck, "citations">): Set<string> {
  return new Set(c.citations.map(domainOf).filter((d): d is string => d !== null));
}

// What to do about a site, by the kind of site it is.
const SOURCE_HOW: Record<SourceKind, { how: string; effort: Level }> = {
  reviews: {
    how: "Claim your listing, fill in every detail (services, prices, hours, photos), and ask a few happy customers to leave a review.",
    effort: "low",
  },
  google: {
    how: "Claim and complete your Google Business Profile: services, prices, hours and photos. Then ask happy customers for reviews.",
    effort: "low",
  },
  press: {
    how: "This is an article by a writer. You can't add yourself, but you can pitch: email the writer a short note on what makes you different, with a photo and a link.",
    effort: "high",
  },
  social: {
    how: "Post there as yourself and link to your site. Where people ask for recommendations, answer honestly and say what you do.",
    effort: "medium",
  },
  reference: {
    how: "Check whether you have an entry, and that it's accurate and complete. Add your business where the site allows it.",
    effort: "medium",
  },
  other: {
    how: "Find who wrote the page AI read and pitch them: a short note on what makes you different and why you belong on it.",
    effort: "medium",
  },
  own_site: { how: "", effort: "low" },
};

/** Answers that named a competitor and not the client. */
const lostTo = (c: Pick<PlanCheck, "mentioned" | "competitorsMentioned">) => !c.mentioned && c.competitorsMentioned.length > 0;

// Labels that never name a business: "www.", "help.", "m.".
const PLAIN_LABELS = new Set(["www", "help", "m"]);

/**
 * Whether a domain is a competitor's own website: "hillcrestbakery.com" for
 * Hillcrest Bakery, "honeycrumb.com" for Honey Crumb Cake Studio,
 * "hillcrest.square.site" or "order.honeycrumb.com" too. Every label but the
 * ending (and www, help, m), punctuation gone, against each name's key with
 * spaces gone; either containing the other is a match. Very short labels are
 * never matched, so "ab.com" can't knock out a source.
 */
function isCompetitorSite(domain: string, names: string[]): boolean {
  const labels = domain.split(".").slice(0, -1).filter(l => !PLAIN_LABELS.has(l)).map(squash).filter(l => l.length >= 4);
  return labels.some(label => names.some(n => {
    const key = squashedNameKey(n);
    return key.length >= 4 && (key.includes(label) || label.includes(key));
  }));
}

// Sites a small business can't get onto, whatever AI read there.
const AI_VENDORS = ["openai.com", "chatgpt.com", "perplexity.ai", "anthropic.com", "claude.ai", "x.ai", "gemini.google.com"];
const APP_STORES = ["apps.apple.com", "play.google.com", "chromewebstore.google.com"];
const FILE_HOSTS = ["amazonaws.com", "cloudfront.net"];
const GOOGLE_KEPT = new Set(["google.com", "maps.google.com", "business.google.com"]);
const within = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/**
 * Whether no business can put itself on a site: an encyclopaedia, a
 * government or school site, an AI company, an app store, a file host or CDN,
 * or a Google site other than its search, maps and business pages.
 */
function isUnreachable(domain: string, kind: SourceKind): boolean {
  if (kind === "reference") return true;
  if (/\.(gov|edu)(\.[a-z]{2})?$/.test(domain)) return true;
  if ([...AI_VENDORS, ...APP_STORES, ...FILE_HOSTS].some(d => within(domain, d))) return true;
  if (domain.split(".").some(l => l.includes("cdn"))) return true;
  return within(domain, "google.com") && !GOOGLE_KEPT.has(domain);
}

/**
 * The sites to get on: the sources report's gaps, biggest first, with
 * competitors' own websites and sites nobody can get onto left out. Each
 * carries the buyer answers that read it and named a competitor, not the
 * client, and who those answers named.
 */
export function sitesToGetOn<C extends Pick<PlanCheck, "promptKind" | "mentioned" | "competitorsMentioned" | "citations">>(
  sources: SourcesReport, checks: C[],
) {
  const buyer = checks.filter(c => c.promptKind !== "branded");
  return sources.gaps.map(gap => {
    const lost = buyer.filter(c => lostTo(c) && domainsOf(c).has(gap.domain));
    return { domain: gap.domain, gap, lost, named: competitorCounts(lost) };
  }).filter(g => !isUnreachable(g.domain, g.gap.kind) && !isCompetitorSite(g.domain, g.named.map(n => n.name)));
}

/**
 * The pages on a domain that the given answers read, most read first,
 * tracking tags gone. A page under one already listed (an image path such as
 * ".../c_fill/") is the same page, so it's left out; the homepage aside.
 */
function pagesRead(domain: string, checks: Pick<PlanCheck, "citations">[]): string[] {
  const counts = new Map<string, number>();
  for (const c of checks) {
    const urls = new Set(c.citations.filter(u => domainOf(u) === domain).map(u => u.replace(/([?&])utm_[^&#]*&?/g, "$1").replace(/[?&]$/, "")));
    for (const u of urls) counts.set(u, (counts.get(u) ?? 0) + 1);
  }
  const out: string[] = [];
  for (const [u] of [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))) {
    // Never under the homepage: every page is.
    const under = (o: string) => new URL(o).pathname.length > 1 && u.startsWith(o.endsWith("/") ? o : `${o}/`);
    if (!out.some(under)) out.push(u);
  }
  return out;
}

/** At most `max` characters, cut at a word with an ellipsis when it's longer. */
function clip(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max).replace(/[\s,;:.]+$/, "")}…`;
}

// When the business is already on a site, what to do about the pages that leave it out.
const ALREADY_ON_LISTING = "You're already on this site, but AI also read pages that leave you out (below). Open those pages and make your listing or posts there complete and current.";
const ALREADY_IN_ARTICLE = "You're already on this site, but AI also read an article that leaves you out (below). Email its writer a short note on what makes you different, with a photo and a link.";

function sourceItems(input: ActionPlanInput, buyer: PlanCheck[]): ActionItem[] {
  // Kept in the data's order, biggest gap first: a site's kind says how to get
  // on it, not how much it matters. The top three, or any that took a quarter
  // of buyer answers, are high impact. Google's sites are one step: the
  // business profile.
  const sites = sitesToGetOn(input.sources, buyer).filter((s, i, all) => s.gap.kind !== "google" || all.findIndex(o => o.gap.kind === "google") === i);
  return sites.slice(0, CAP).map(({ gap, lost, named: counts }, i) => {
    const named = counts.slice(0, 3);
    const advice = SOURCE_HOW[gap.kind];
    const big = i < 3 || (buyer.length > 0 && gap.competitorOnly / buyer.length >= 0.25);
    // AI read the site and named these businesses in the same answers: said as
    // that, never as AI naming them from the site.
    const onIt = gap.namedYou > 0;
    const title = gap.kind === "google" ? "Complete your Google Business Profile"
      : onIt ? `Stand out on ${gap.domain}` : `Get on ${gap.domain}`;
    const why = onIt
      ? `AI read ${gap.domain} in ${plural(gap.answers, "answer")}. It named you in ${gap.namedYou}, but in ${lost.length} it named ${listOf(named.map(n => n.name))} instead of you.`
      : `In ${plural(lost.length, "answer")} that left you out, AI read ${gap.domain} and named ${listOf(named.map(n => `${n.name} (${n.count})`))}.`;
    return {
      key: `source:${gap.domain}`,
      title,
      why,
      // For an article or blog, emailing its writer is the whole advice.
      how: !onIt ? advice.how : gap.kind === "other" || gap.kind === "press" ? ALREADY_IN_ARTICLE : `${ALREADY_ON_LISTING} ${advice.how}`,
      evidence: [...pagesRead(gap.domain, lost).slice(0, 2), ...[...new Set(lost.map(c => c.promptText))].slice(0, 2).map(quote)],
      effort: advice.effort,
      impact: big ? "high" : "medium",
    };
  });
}

function questionItems(input: ActionPlanInput, buyer: PlanCheck[]): ActionItem[] {
  // Only sites a business can get onto, never a competitor's own.
  const reachable = new Map(sitesToGetOn(input.sources, buyer).map(s => [s.domain, s.gap.namedYou]));
  const clientKeys = new Set((input.names ?? []).map(nameKey));
  const byPrompt = new Map<string, PlanCheck[]>();
  for (const c of buyer) byPrompt.set(c.promptId, [...(byPrompt.get(c.promptId) ?? []), c]);

  const rows = [...byPrompt.entries()].map(([promptId, answers]) => {
    const namedYou = answers.filter(c => c.mentioned).length;
    const withCompetitor = answers.filter(c => c.competitorsMentioned.length > 0).length;
    // The client's best place in any answer, 1-based; null when never placed.
    const ranks = answers.map(c => (c.namedOrder ?? []).findIndex(n => clientKeys.has(nameKey(n)))).filter(i => i >= 0);
    const bestRank = ranks.length ? Math.min(...ranks) + 1 : null;
    return { promptId, text: answers[0].promptText, answers, namedYou, withCompetitor, bestRank };
  }).filter(r => r.withCompetitor > 0 && r.namedYou < r.answers.length / 2);

  // Closest calls first: named at least once (or placed 2nd/3rd), best place
  // first; then the rest by how many answers named a competitor.
  const close = (r: (typeof rows)[number]) => r.namedYou > 0 || r.bestRank === 2 || r.bestRank === 3;
  rows.sort((a, b) =>
    Number(close(b)) - Number(close(a))
    || (close(a) ? b.namedYou - a.namedYou || (a.bestRank ?? 99) - (b.bestRank ?? 99) : 0)
    || b.withCompetitor - a.withCompetitor
    || a.text.localeCompare(b.text));

  return rows.slice(0, CAP).map(r => {
    const counts = competitorCounts(r.answers);
    const named = counts.slice(0, 3).map(n => n.name);
    const cited = new Map<string, number>();
    // Only the answers it lost: those are the sites that sent AI elsewhere.
    for (const c of r.answers.filter(lostTo)) {
      for (const d of domainsOf(c)) {
        if (reachable.has(d) && !isCompetitorSite(d, counts.map(n => n.name))) cited.set(d, (cited.get(d) ?? 0) + 1);
      }
    }
    const domains = [...cited.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 2).map(([d]) => d);
    // A site whose answers already named the business is one to stand out on, not get onto.
    const getOnto = domains.filter(d => !reachable.get(d));
    const standOut = domains.filter(d => reachable.get(d));
    const then = [
      getOnto.length ? `get onto ${listOf(getOnto)}` : "",
      standOut.length ? `make sure you stand out on ${listOf(standOut)}` : "",
    ].filter(Boolean).join(", and ");
    const page = `Add a page or section to your site that answers ${quote(r.text)} in plain words, and says where you fit: what you make, for whom and where.`;
    return {
      key: `question:${r.promptId}`,
      title: quote(r.text),
      why: `AI named ${listOf(named)}; you were named in ${r.namedYou} of ${plural(r.answers.length, "answer")}.`,
      how: then ? `${page} Then ${then}, which AI read for this question.` : page,
      evidence: r.bestRank ? [`Your best place in an answer: ${ordinal(r.bestRank)}.`] : [],
      effort: "medium",
      impact: close(r) ? "high" : "medium",
    };
  });
}

function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

// What a word AI adds to its searches says about the page it wants.
const PAGE_FOR_WORD: { test: RegExp; page: string; why: string }[] = [
  { test: /^(price|prices|pricing|cost|costs|cheap|affordable|rates?)$/, page: "A current price list", why: "AI looks up prices before recommending anyone." },
  { test: /^(reviews?|rated|ratings?|testimonials?)$/, page: "A reviews and results page", why: "AI checks what customers say before it recommends you." },
  { test: /^(hours|open|saturday|sunday|weekend|today|appointment|booking|book)$/, page: "Hours and booking details", why: "AI answers \"open now\" and \"book\" questions from this." },
  { test: /^(near|nearby|location|address|parking|directions)$/, page: "A location page", why: "AI matches you to local questions from your address and area." },
  { test: /^20\d\d$/, page: "Pages with this year's details", why: "AI prefers recent pages. Dated, updated info reads as current." },
  { test: /^(vs|versus|alternative|alternatives|compare|comparison)$/, page: "A comparison page", why: "AI is weighing options. Say plainly how you differ." },
];

export interface PageWanted {
  word: string;
  page: string;
  why: string;
  status: "have" | "partial" | "missing";
}

/**
 * The pages AI's added search words point to, and whether the site has each.
 * Only words with a known page: "cakes" or "oregon" say nothing about a page
 * to add. Four at most.
 */
export function pagesWanted(words: string[], site: WebsiteCheckResult | null): PageWanted[] {
  const out: PageWanted[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    const rule = PAGE_FOR_WORD.find(r => r.test.test(word));
    if (!rule || seen.has(rule.page)) continue;
    seen.add(rule.page);
    const onPage = site?.pages.some(p => `${p.url} ${p.title ?? ""}`.toLowerCase().includes(word)) ?? false;
    const inText = site?.homepageText.includes(word) ?? false;
    out.push({
      word, page: rule.page, why: rule.why,
      status: onPage ? "have" : inText ? "partial" : "missing",
    });
    if (out.length >= 4) break;
  }
  return out;
}

const isYear = (word: string) => /^20\d\d$/.test(word);

function pageItems(input: ActionPlanInput): ActionItem[] {
  const words = input.search.addedWords.map(w => w.word);
  const updated = (input.today ?? new Date()).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return pagesWanted(words, input.websiteCheck).filter(p => p.status !== "have").map(p => {
    const searches = input.search.queries.filter(q => q.query.split(/[^a-z0-9]+/).includes(p.word)).slice(0, 2).map(q => quote(q.query));
    // Only say the site lacks it when the site was checked and it isn't there.
    const verdict = !input.websiteCheck ? ". Make sure your site covers it."
      : p.status === "partial" ? ", and your site doesn't give it its own page."
      : ", and your site doesn't have this.";
    return {
      key: `page:${slug(p.page)}`,
      title: `Add ${p.page.charAt(0).toLowerCase()}${p.page.slice(1)}`,
      why: searches.length
        ? `AI searched for ${listOf(searches)} before answering${verdict}`
        : `AI kept adding "${p.word}" to its searches${verdict}`,
      how: isYear(p.word)
        ? `Put the date on your menu, prices and hours ("Updated ${updated}") and refresh it when they change.`
        : p.status === "partial"
        ? `${p.why} Your homepage mentions it; give it its own page, linked from the homepage.`
        : `${p.why} Put it on its own page, in plain text, linked from your homepage.`,
      evidence: searches,
      effort: p.status === "partial" ? "low" : "medium",
      impact: "medium",
    };
  });
}

/** Today's Fix plan titles for each website check, kept the same here. */
export const WEBSITE_FIXES: Record<WebsiteCheckRow["id"], { title: string; effort: Level; impact: Level }> = {
  ai_allowed: { title: "Let AI assistants read your site", effort: "low", impact: "high" },
  facts_page: { title: "Add a plain facts page", effort: "low", impact: "high" },
  readable_text: { title: "Make your text load without special code", effort: "medium", impact: "high" },
  machine_labels: { title: "Label your prices and FAQs for machines", effort: "low", impact: "medium" },
  sitemap: { title: "Publish a sitemap", effort: "low", impact: "low" },
  business_schema: { title: "Label your business for machines", effort: "low", impact: "medium" },
  contact_visible: { title: "Put your phone, address and hours in plain text", effort: "low", impact: "high" },
};

function websiteItems(input: ActionPlanInput): ActionItem[] {
  return (input.websiteCheck?.checks ?? []).filter(c => c.status !== "pass" && WEBSITE_FIXES[c.id]).map(c => ({
    key: `site:${c.id}`,
    ...WEBSITE_FIXES[c.id],
    why: c.why,
    how: c.fix ?? "Ask whoever runs your website to fix this; it's usually a small change.",
    // Not the check's label: it names what passing looks like, not what's wrong.
    evidence: [],
  }));
}

function reputationItems(buyer: PlanCheck[]): ActionItem[] {
  const warned = buyer.filter(c => c.mentioned && (c.tone === "negative" || c.tone === "mixed") && !isNamesake(c));
  if (!warned.length) return [];
  // AI's own reason for the "but", not a sentence lifted from the answer.
  const quotes = [...new Set(warned.map(c => (c.toneReason ? clip(c.toneReason.replace(/\*\*/g, "")) : "") || null)
    .filter((q): q is string => !!q))].slice(0, 2);
  const negative = warned.filter(c => c.tone === "negative").length;
  return [{
    key: "reputation:caveats",
    title: warned.length === 1 ? "Answer the caveat AI gives" : "Answer the caveat AI repeats",
    why: `AI named you with a caveat in ${plural(warned.length, "answer")}${negative ? `, and warned people off in ${negative}` : ""}.`,
    how: "Find the review or page the caveat comes from. Reply to the review calmly, or update the page, and say plainly on your site what has changed.",
    evidence: quotes.map(quote),
    effort: "medium",
    impact: negative ? "high" : "medium",
  }];
}

const IMPACT: Record<Level, number> = { high: 0, medium: 1, low: 2 };
const EFFORT: Record<Level, number> = { low: 0, medium: 1, high: 2 };

export function buildActionPlan(input: ActionPlanInput): ActionPlan {
  const buyer = input.checks.filter(c => c.promptKind !== "branded");
  const built: Record<GroupKey, ActionItem[]> = {
    sources: sourceItems(input, buyer),
    questions: questionItems(input, buyer),
    pages: pageItems(input),
    website: websiteItems(input),
    reputation: reputationItems(buyer),
  };
  // Stable sort: equal items keep the order each builder gave them. Sources
  // stay in the data's order, biggest gap first: an easy listing must not
  // jump a site that cost the business more answers.
  const groups = ORDER.filter(k => built[k].length).map(key => ({
    key, ...GROUPS[key],
    items: key === "sources" ? built[key]
      : [...built[key]].sort((a, b) => IMPACT[a.impact] - IMPACT[b.impact] || EFFORT[a.effort] - EFFORT[b.effort]),
  }));
  const all = groups.flatMap(g => g.items);
  return { groups, total: all.length, quickWins: all.filter(i => i.effort === "low" && i.impact === "high").length };
}
