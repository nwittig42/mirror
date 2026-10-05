/**
 * The website check: can an AI assistant read this business's site and find
 * its key facts? Pure evaluation functions over what was fetched, so each
 * rule is testable without a network. The fetching lives in
 * services/website-check.ts.
 */

export type CheckStatus = "pass" | "warn" | "fail";

export interface WebsiteCheckRow {
  id: "ai_allowed" | "readable_text" | "facts_page" | "machine_labels" | "sitemap";
  label: string;
  why: string;
  fix?: string;
  status: CheckStatus;
}

export interface SitePageInfo { url: string; title: string | null }

/** Everything the check learned, stored on the scan so the report never refetches. */
export interface WebsiteCheckResult {
  checkedAt: string;
  checks: WebsiteCheckRow[];
  /** Pages found on the site (home + fact-looking links), for "pages AI is looking for". */
  pages: SitePageInfo[];
  /** Start of the homepage's visible text, lower-cased, for word matching. */
  homepageText: string;
  /** Set when the site could not be reached at all. */
  error?: string;
}

// The crawlers the major assistants send. "*" rules apply to any of them
// that has no group of its own.
export const AI_AGENTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "Googlebot",
] as const;

interface RobotsGroup { agents: string[]; disallow: string[]; allow: string[] }

export function parseRobots(txt: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "sitemap") { if (value) sitemaps.push(value); continue; }
    if (key === "user-agent") {
      if (!current || !lastWasAgent) { current = { agents: [], disallow: [], allow: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "disallow") current.disallow.push(value);
    if (key === "allow") current.allow.push(value);
  }
  return { groups, sitemaps };
}

/** True when robots.txt blocks `agent` from the whole site ("Disallow: /" with no "Allow: /"). */
export function blocksWholeSite(robots: ReturnType<typeof parseRobots>, agent: string): boolean {
  const a = agent.toLowerCase();
  const own = robots.groups.filter(g => g.agents.includes(a));
  const groups = own.length ? own : robots.groups.filter(g => g.agents.includes("*"));
  return groups.some(g => g.disallow.includes("/") && !g.allow.includes("/"));
}

export function checkAiAllowed(robotsTxt: string | null): WebsiteCheckRow {
  const base = {
    id: "ai_allowed" as const,
    label: "AI assistants are allowed to read your site",
    why: "If your site blocks them, AI answers about you come from other people's pages instead.",
  };
  if (robotsTxt === null) return { ...base, status: "pass" };
  const robots = parseRobots(robotsTxt);
  const blocked = AI_AGENTS.filter(agent => blocksWholeSite(robots, agent));
  if (blocked.length === 0) return { ...base, status: "pass" };
  const fix = `Remove the rule in your robots.txt file that blocks ${blocked.slice(0, 3).join(", ")}${blocked.length > 3 ? " and others" : ""}.`;
  return { ...base, status: blocked.length >= AI_AGENTS.length / 2 ? "fail" : "warn", fix };
}

export function checkReadableText(homepageTextLength: number): WebsiteCheckRow {
  const base = {
    id: "readable_text" as const,
    label: "Your text is readable without special page code",
    why: "Several AI readers don't run the code some sites need to show their text, so they see a blank page.",
  };
  if (homepageTextLength >= 500) return { ...base, status: "pass" };
  const fix = "Ask your web developer to make the homepage text load in the page itself (server-side), not only after scripts run.";
  return { ...base, status: homepageTextLength >= 150 ? "warn" : "fail", fix };
}

const ABOUT = /(about|team|who-we-are|our-story)/i;
const PRICING = /(pricing|price|prices|plans|cost|menu|rates)/i;
const SERVICES = /(service|treatment|product|feature|what-we-do)/i;

export function checkFactsPage(pages: SitePageInfo[]): WebsiteCheckRow {
  const base = {
    id: "facts_page" as const,
    label: "You have a clear facts page",
    why: "A plain page with what you do, who it's for, prices and location gives AI one correct place to copy from.",
  };
  const text = (p: SitePageInfo) => `${new URL(p.url).pathname} ${p.title ?? ""}`;
  const hasAbout = pages.some(p => ABOUT.test(text(p)));
  const hasPricing = pages.some(p => PRICING.test(text(p)));
  const hasServices = pages.some(p => SERVICES.test(text(p)));
  if (hasAbout && hasPricing) return { ...base, status: "pass" };
  const missing = [!hasAbout && "about", !hasPricing && "pricing"].filter(Boolean).join(" and ");
  return {
    ...base,
    status: hasAbout || hasPricing || hasServices ? "warn" : "fail",
    fix: `Add ${missing === "about and pricing" ? "an about page and a pricing page" : `a ${missing} page`} that states the facts in plain sentences.`,
  };
}

/** Schema.org types found in a page's JSON-LD blocks. */
export function jsonLdTypes(html: string): string[] {
  const types: string[] = [];
  for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      const obj = node as Record<string, unknown>;
      const t = obj["@type"];
      if (typeof t === "string") types.push(t);
      if (Array.isArray(t)) t.forEach(x => typeof x === "string" && types.push(x));
      for (const v of Object.values(obj)) if (v && typeof v === "object") walk(v);
    };
    try { walk(JSON.parse(m[1])); } catch { /* malformed block: ignore it */ }
  }
  return types;
}

const PRICE_OR_FAQ = new Set(["Offer", "AggregateOffer", "PriceSpecification", "UnitPriceSpecification", "Product", "Service", "FAQPage", "MenuItem", "Menu"]);

export function checkMachineLabels(types: string[]): WebsiteCheckRow {
  const base = {
    id: "machine_labels" as const,
    label: "Prices and FAQs are labeled for machines",
    why: "Hidden labels (schema markup) tell AI which number is the price and which text answers a question.",
  };
  if (types.some(t => PRICE_OR_FAQ.has(t))) return { ...base, status: "pass" };
  const fix = "Add schema markup for your prices (Offer) and your FAQ section (FAQPage). Most site builders have a setting or plugin for this.";
  return { ...base, status: types.length > 0 ? "warn" : "fail", fix };
}

export function checkSitemap(found: boolean, listedInRobots: boolean): WebsiteCheckRow {
  const base = {
    id: "sitemap" as const,
    label: "You have a sitemap",
    why: "A sitemap lists every page so AI and search engines find the ones that matter.",
  };
  if (found) return { ...base, status: "pass" };
  return {
    ...base,
    status: listedInRobots ? "warn" : "fail",
    fix: listedInRobots
      ? "Your robots.txt points to a sitemap that doesn't load. Fix the link or regenerate the sitemap."
      : "Publish a sitemap at /sitemap.xml and submit it in Google Search Console and Bing Webmaster Tools.",
  };
}
