import { isSafeHttpUrl } from "@/lib/url";
import { factPageLinks, htmlTitle, htmlToText } from "@/core/site-text";
import {
  checkAiAllowed, checkFactsPage, checkMachineLabels, checkReadableText, checkSitemap, jsonLdTypes, parseRobots,
  type SitePageInfo, type WebsiteCheckResult,
} from "@/core/website-check";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 1_500_000;
const MAX_PAGES = 8;
const HOMEPAGE_TEXT_KEEP = 8_000;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i;

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

/**
 * Reads the business's site the way an AI assistant would and runs the five
 * checks: robots.txt rules for AI crawlers, homepage text without scripts,
 * an about/pricing page, schema labels for prices and FAQs, and a sitemap.
 * Free: it is just our own requests to their public site.
 */
export async function runWebsiteCheck(website: string, fetchImpl: Fetch = fetch): Promise<WebsiteCheckResult> {
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

  const links = factPageLinks(homeRes.body, home, MAX_PAGES - 1);
  const subpages = await Promise.all(links.map(async url => ({ url, res: await get(url, fetchImpl) })));
  const pageHtml = [{ url: home, html: homeRes.body }, ...subpages
    .filter(p => p.res && p.res.status < 400)
    .map(p => ({ url: p.url, html: p.res!.body }))];
  const pages: SitePageInfo[] = pageHtml.map(p => ({ url: p.url, title: htmlTitle(p.html) }));

  const sitemapUrls = robots.sitemaps.length ? robots.sitemaps.slice(0, 2) : [`${origin}/sitemap.xml`];
  const sitemapResults = await Promise.all(sitemapUrls.filter(isSafeHttpUrl).map(u => get(u, fetchImpl)));
  const sitemapFound = sitemapResults.some(r => r && r.status < 400 && /<(urlset|sitemapindex)\b/i.test(r.body));

  const homepageText = htmlToText(homeRes.body);
  const types = pageHtml.flatMap(p => jsonLdTypes(p.html));

  return {
    checkedAt,
    checks: [
      checkAiAllowed(robotsTxt),
      checkReadableText(homepageText.length),
      checkFactsPage(pages),
      checkMachineLabels(types),
      checkSitemap(sitemapFound, robots.sitemaps.length > 0),
    ],
    pages,
    homepageText: homepageText.slice(0, HOMEPAGE_TEXT_KEEP).toLowerCase(),
  };
}
