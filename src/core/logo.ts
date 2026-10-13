/**
 * Where a website keeps its logo, read from the homepage's HTML. Pure: the
 * caller does the fetching (src/services/logo.ts).
 */

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : null;
};

/** The larger side of a `sizes="180x180"` attribute; 0 when it has none. */
const sizeOf = (tag: string): number => {
  const m = /(\d+)x(\d+)/i.exec(attr(tag, "sizes") ?? "");
  return m ? Math.max(Number(m[1]), Number(m[2])) : 0;
};

const absolute = (href: string | null, pageUrl: string): string | null => {
  if (!href || href.startsWith("data:")) return null;
  try {
    const url = new URL(href, pageUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

/**
 * Logo addresses to try, best first: the home-screen icon (square, and the
 * largest a site publishes), then its browser-tab icons from largest to
 * smallest, then the logo named in its business schema, then the two
 * addresses browsers fall back to. The share image (og:image) is left out on
 * purpose: it is a banner, not a logo.
 */
export function logoCandidates(html: string, pageUrl: string): string[] {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const touch: { url: string; size: number }[] = [];
  const icons: { url: string; size: number }[] = [];
  for (const tag of links) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const url = absolute(attr(tag, "href"), pageUrl);
    if (!url) continue;
    if (rel.includes("apple-touch-icon")) touch.push({ url, size: sizeOf(tag) });
    else if (/(^|\s)icon(\s|$)/.test(rel)) {
      // A vector icon is sharp at any size, so it outranks every bitmap.
      const svg = /svg/i.test(attr(tag, "type") ?? "") || /\.svg(\?|$)/i.test(url);
      icons.push({ url, size: svg ? 10_000 : sizeOf(tag) });
    }
  }
  const bySize = (a: { size: number }, b: { size: number }) => b.size - a.size;
  const schema = /"logo"\s*:\s*(?:"([^"]+)"|\{[^{}]*?"url"\s*:\s*"([^"]+)")/i.exec(html);
  const out = [
    ...touch.sort(bySize).map(t => t.url),
    ...icons.sort(bySize).map(i => i.url),
    absolute(schema ? (schema[1] ?? schema[2]).replace(/\\\//g, "/") : null, pageUrl),
    absolute("/apple-touch-icon.png", pageUrl),
    absolute("/favicon.ico", pageUrl),
  ].filter((u): u is string => !!u);
  return [...new Set(out)];
}
