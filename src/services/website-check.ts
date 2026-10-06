import { isSafeHttpUrl } from "@/lib/url";
import { factPageLinks, htmlTitle, htmlToText, telLinks } from "@/core/site-text";
import {
  checkAiAllowed, checkBusinessSchema, checkContactVisible, checkFactsPage, checkMachineLabels, checkReadableText,
  checkSitemap, jsonLdNodes, nodeTypes, parseRobots,
  type SitePageInfo, type WebsiteCheckResult,
} from "@/core/website-check";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 1_500_000;
const MAX_PAGES = 8;
const HOMEPAGE_TEXT_KEEP = 8_000;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i;
// The page where a site keeps its phone, address and hours.
const CONTACT_PAGE = /contact|hours|location|visit/i;

type Fetch = typeof fetch;

async function get(url: string, fetchImpl: Fetch): Promise<{ status: number; body: string; type: string } | null> {
  try {
    const res = await fetchImpl(url, {
      headers: { "user-agent": "MirrorSiteCheck/1.0 (+AI readiness check)" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.text()).slice(0, MAX_BYTES);
    return { status: res.status, body, type: res.headers.get("content-type") ?? "" };
  } catch {
    return null;
  }
}

const isContactPage = (url: string) => CONTACT_PAGE.test(new URL(url).pathname);

/**
 * Reads the business's site the way an AI assistant would and runs the seven
 * checks: robots.txt rules for AI crawlers, homepage text without scripts, an
 * about/services/pricing page, schema labels for prices and FAQs, a sitemap,
 * business schema with the right name, and a phone, address and hours in
 * plain text. Free: it is just our own requests to their public site.
 *
 * `opts.names` are the business's name variations, which the business schema
 * check compares with the markup's name; without them that rule is skipped.
 */
export async function runWebsiteCheck(website: string, fetchImpl: Fetch = fetch, opts: { names?: string[] } = {}): Promise<WebsiteCheckResult> {
  const home = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const checkedAt = new Date().toISOString();
  if (!isSafeHttpUrl(home) || PRIVATE_HOST.test(new URL(home).hostname)) {
    return { checkedAt, checks: [], pages: [], homepageText: "", error: "Not a public website address" };
  }
  const origin = new URL(home).origin;

  const [homeRes, robotsRes] = await Promise.all([get(home, fetchImpl), get(`${origin}/robots.txt`, fetchImpl)]);
  if (!homeRes || homeRes.status >= 400) {
    return { checkedAt, checks: [], pages: [], homepageText: "", error: `Could not load ${home}` };
  }

  const robotsTxt = robotsRes && robotsRes.status < 400 && !robotsRes.type.includes("html") ? robotsRes.body : null;
  const robots = robotsTxt ? parseRobots(robotsTxt) : { groups: [], sitemaps: [] };

  // One of the page slots is held for the contact page: when no fact-looking
  // link is one, /contact is tried in its place (a 404 just loses the slot).
  let links = factPageLinks(homeRes.body, home, MAX_PAGES - 1);
  if (!links.some(isContactPage)) links = [...links.slice(0, MAX_PAGES - 2), `${origin}/contact`];
  const subpages = await Promise.all(links.map(async url => ({ url, res: await get(url, fetchImpl) })));
  const pageHtml = [{ url: home, html: homeRes.body }, ...subpages
    .filter(p => p.res && p.res.status < 400)
    .map(p => ({ url: p.url, html: p.res!.body }))];
  const pages: SitePageInfo[] = pageHtml.map(p => ({ url: p.url, title: htmlTitle(p.html) }));

  const sitemapUrls = robots.sitemaps.length ? robots.sitemaps.slice(0, 2) : [`${origin}/sitemap.xml`];
  const sitemapResults = await Promise.all(sitemapUrls.filter(isSafeHttpUrl).map(u => get(u, fetchImpl)));
  const sitemapFound = sitemapResults.some(r => r && r.status < 400 && /<(urlset|sitemapindex)\b/i.test(r.body));

  const homepageText = htmlToText(homeRes.body);
  const nodes = pageHtml.flatMap(p => jsonLdNodes(p.html));
  const types = nodes.flatMap(nodeTypes);
  // The contact check reads the whole homepage and contact page, tel: links
  // included, not the slice kept for the report.
  const contactPages = pageHtml.filter(p => p.url !== home && isContactPage(p.url));
  const contactText = [
    homepageText,
    ...contactPages.map(p => htmlToText(p.html)),
    ...[homeRes.body, ...contactPages.map(p => p.html)].flatMap(telLinks),
  ].join("\n");

  return {
    checkedAt,
    checks: [
      checkAiAllowed(robotsTxt),
      checkReadableText(homepageText.length),
      checkFactsPage(pages),
      checkMachineLabels(types),
      checkSitemap(sitemapFound, robots.sitemaps.length > 0),
      checkBusinessSchema(nodes, opts.names ?? []),
      checkContactVisible({ text: contactText, nodes }),
    ],
    pages,
    homepageText: homepageText.slice(0, HOMEPAGE_TEXT_KEEP).toLowerCase(),
  };
}
