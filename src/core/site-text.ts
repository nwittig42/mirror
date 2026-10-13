/**
 * Turning a business's website into plain text a model can read. Pure, so the
 * crawling rules (which pages, how much text) are testable without a network.
 */

// Pages that tend to hold the facts a fact sheet needs. Matched against the
// URL path, so "/our-team", "/pricing-plans" and "/services/botox" all count.
// The words the facts-page check looks for (fees, estimates, quotes, our
// story, what we do) are here too: a page the check would pass on has to be
// fetched for the check to see it. "fee" is a whole word so that /feedback
// and /newsfeed do not take a page slot.
const FACT_PAGE_PATTERN =
  /(about|team|staff|provider|doctor|people|founder|our-story|who-we-are|pricing|price|plans|cost|menu|\bfees?\b|estimate|quote|service|treatment|product|feature|what-we-do|contact|location|hours|visit|faq)/i;

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

// Paths that are never worth a page slot when filling up with "the rest of
// the site": posts, legal pages, accounts and shop plumbing.
const SKIP_PAGE_PATTERN =
  /(blog|news|press|article|post|tag|category|author|feed|privacy|terms|legal|cookie|login|log-in|signin|sign-in|signup|sign-up|register|account|cart|checkout|basket|search|careers|jobs|wp-|cdn-cgi)/i;

/**
 * The pages to read when building a fact sheet: the fact-looking pages first
 * (as factPageLinks picks them), then the rest of what the page links to on
 * the same site, so a business whose site names its pages in its own way
 * ("/the-bakery", "/custom-cakes", "/areas-we-serve") is still read. Posts,
 * legal pages and account pages are left out.
 */
export function sitePageLinks(html: string, pageUrl: string, limit: number): string[] {
  const first = factPageLinks(html, pageUrl, limit);
  if (first.length >= limit) return first;
  const base = new URL(pageUrl);
  const baseHost = base.hostname.replace(/^www\./, "");
  const seen = new Set<string>([normalize(base), ...first]);
  const out = [...first];
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
    if (SKIP_PAGE_PATTERN.test(url.pathname)) continue;
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

/**
 * The page's tel: links as written in the href ("tel:+15035551234"). The
 * visible text often shows only "Call us", so the contact check needs these.
 */
export function telLinks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']\s*(tel:[^"']+)["']/gi)) {
    let href = m[1].trim();
    try { href = decodeURIComponent(href); } catch { /* keep it as written */ }
    out.push(href);
  }
  return out;
}
