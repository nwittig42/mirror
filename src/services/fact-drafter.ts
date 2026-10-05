import { and, eq, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { facts } from "@/db/schema";
import { loadEnv } from "@/lib/env";
import { isSafeHttpUrl } from "@/lib/url";
import { factPageLinks, htmlToText, htmlTitle } from "@/core/site-text";
import { parseDraftFacts, type DraftFact } from "@/core/fact-draft-parse";

/**
 * Pre-fills a practice's fact sheet from its own website, so the fact sheet
 * call is the client correcting a draft rather than dictating from scratch.
 *
 * Every drafted fact is saved as status 'draft'. Drafts are invisible to the
 * judge until someone approves them: a fact read off a stale web page must
 * not be able to mark an AI answer "wrong".
 */

const MAX_EXTRA_PAGES = 6;
const PAGE_TEXT_LIMIT = 8_000;
const TOTAL_TEXT_LIMIT = 36_000;
const MAX_HTML_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 15_000;

export interface SitePage { url: string; title: string | null; text: string }

type Fetch = typeof fetch;

async function fetchHtml(url: string, fetchImpl: Fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(url, {
      headers: { "user-agent": "MirrorFactDrafter/1.0 (+fact sheet pre-fill)", accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "text/html").includes("html")) return null;
    const html = await res.text();
    return html.slice(0, MAX_HTML_BYTES);
  } catch {
    return null;
  }
}

/**
 * The homepage plus up to six fact-looking pages it links to (about, pricing,
 * services, contact...). Pages that fail to load are skipped, not fatal.
 */
// The operator types the website, but it is still a URL we fetch from our
// server, so refuse the obvious internal targets.
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i;

export async function fetchSitePages(website: string, fetchImpl: Fetch = fetch): Promise<SitePage[]> {
  const home = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  if (!isSafeHttpUrl(home) || PRIVATE_HOST.test(new URL(home).hostname)) {
    throw new Error(`Not a public website address: ${website}`);
  }
  const homeHtml = await fetchHtml(home, fetchImpl);
  if (!homeHtml) throw new Error(`Could not load ${home}`);

  const links = factPageLinks(homeHtml, home, MAX_EXTRA_PAGES);
  const extra = await Promise.all(links.map(async url => ({ url, html: await fetchHtml(url, fetchImpl) })));

  let budget = TOTAL_TEXT_LIMIT;
  const pages: SitePage[] = [];
  for (const { url, html } of [{ url: home, html: homeHtml }, ...extra]) {
    if (!html || budget <= 0) continue;
    const text = htmlToText(html).slice(0, Math.min(PAGE_TEXT_LIMIT, budget));
    if (!text) continue;
    budget -= text.length;
    pages.push({ url, title: htmlTitle(html), text });
  }
  return pages;
}

const DRAFTER_SYSTEM = `You pre-fill a fact sheet for a business from the text of its own website.
The fact sheet is later used to check whether AI assistants describe the business correctly, so every fact must be specific, checkable, and stated on the pages given. Never guess, infer, or use outside knowledge.
Categories:
- identity: legal/brand name, what the business is in one line, founding year, owner or founder
- providers: named people who deliver the service, with titles and credentials exactly as written
- services: each service, product, or feature offered (one fact per item or tight group)
- not_offered: things the site explicitly says it does NOT do or offer
- pricing: each stated price, plan, fee, or "free" claim, with the unit (per unit, per month, per session)
- logistics: address, service area, phone, email, hours, booking method, languages
- compliance: licenses, certifications, accreditations, insurance accepted, regulatory statements
Rules: one fact per row; label is a short name ("Botox price", "Saturday hours"); value is the fact as stated, including units; skip marketing adjectives and testimonials; skip anything you are unsure of. Aim for 10 to 40 facts.
Output ONLY a JSON array: [{"category": "<one of the categories>", "label": "<short name>", "value": "<the fact>", "sourceUrl": "<the PAGE url it came from>"}]`;

export async function draftFactsFromPages(args: {
  businessName: string;
  pages: SitePage[];
}): Promise<DraftFact[]> {
  const env = loadEnv();
  const body = args.pages
    .map(p => `PAGE: ${p.url}${p.title ? `\nTITLE: ${p.title}` : ""}\n${p.text}`)
    .join("\n\n---\n\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
      "content-type": "application/json" },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL, max_tokens: 4000, system: DRAFTER_SYSTEM,
      messages: [{ role: "user", content: `BUSINESS: ${args.businessName}\n\n${body}` }],
    }),
  });
  if (!res.ok) throw new Error(`drafter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("");
  return parseDraftFacts(text, args.pages.map(p => p.url));
}

/**
 * Saves drafts, skipping any whose label already exists on the practice's
 * sheet (active or draft, any capitalization), so re-running the drafter
 * never duplicates what the operator has already confirmed or is reviewing.
 * Returns how many were added.
 */
export async function saveDraftFacts(db: Db, practiceId: string, drafts: DraftFact[]): Promise<number> {
  const existing = await db.select({ label: facts.label }).from(facts)
    .where(and(eq(facts.practiceId, practiceId), ne(facts.status, "archived")));
  const taken = new Set(existing.map(f => f.label.trim().toLowerCase()));
  const fresh = drafts.filter(d => !taken.has(d.label.toLowerCase()));
  if (fresh.length === 0) return 0;
  await db.insert(facts).values(fresh.map(d => ({
    practiceId, category: d.category, label: d.label, value: d.value,
    status: "draft", source: "website", sourceUrl: d.sourceUrl,
  })));
  return fresh.length;
}
