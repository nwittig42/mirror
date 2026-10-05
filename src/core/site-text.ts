/**
 * Turning a business's website into plain text a model can read. Pure, so the
 * crawling rules (which pages, how much text) are testable without a network.
 */

// Pages that tend to hold the facts a fact sheet needs. Matched against the
// URL path, so "/our-team", "/pricing-plans" and "/services/botox" all count.
const FACT_PAGE_PATTERN =
  /(about|team|staff|provider|doctor|people|founder|pricing|price|plans|cost|menu|service|treatment|product|feature|contact|location|hours|visit|faq)/i;

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
  "&mdash;": "-", "&ndash;": "-", "&rsquo;": "'", "&lsquo;": "'", "&ldquo;": "\"", "&rdquo;": "\"",
};

/** Visible text of an HTML page: scripts, styles and markup removed, whitespace collapsed. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, m => ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The page's <title>, if any. */
export function htmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? htmlToText(m[1]) || null : null;
}

/**
 * Same-site links from a page that look like they hold facts (about, pricing,
 * services, contact...), absolute, de-duplicated, fragment and query dropped,
 * in the order they appear.
 */
export function factPageLinks(html: string, pageUrl: string, limit: number): string[] {
  const base = new URL(pageUrl);
  const baseHost = base.hostname.replace(/^www\./, "");
  const seen = new Set<string>([normalize(base)]);
  const out: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*)["']/gi)) {
    let url: URL;
    try {
      url = new URL(m[1], base);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    if (url.hostname.replace(/^www\./, "") !== baseHost) continue;
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4)$/i.test(url.pathname)) continue;
    if (!FACT_PAGE_PATTERN.test(url.pathname)) continue;
    const key = normalize(url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}

function normalize(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${url.protocol}//${url.host}${path}`;
}
