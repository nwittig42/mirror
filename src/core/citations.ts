/**
 * Where the engines get their answers. Pure functions over stored checks:
 * every answer already carries the URLs the engine cited, so this module turns
 * those into the "which sites does AI trust in your category" view, and the
 * "sites it cites when it recommends a competitor instead of you" gap list,
 * which is the outreach target list.
 */

export type SourceKind =
  | "own_site"
  | "reviews"
  | "social"
  | "reference"
  | "google"
  | "other";

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  own_site: "Your website",
  reviews: "Reviews and directories",
  social: "Social and forums",
  reference: "Reference",
  google: "Google",
  other: "Articles and other sites",
};

// Matched against the registrable end of the hostname, so "m.yelp.com" and
// "yelp.com" both land on yelp.com. Grouped by kind, and covering the sites
// that answer "who should I hire" in every trade, not one vertical. A domain
// that is not listed is "other", which is the honest default.
const DOMAINS_BY_KIND: Record<Exclude<SourceKind, "own_site" | "other">, string[]> = {
  reviews: [
    // General reviews and directories
    "yelp.com", "trustpilot.com", "bbb.org", "yellowpages.com", "yp.com", "superpages.com", "manta.com",
    "mapquest.com", "foursquare.com", "nextdoor.com", "groupon.com", "expertise.com", "threebestrated.com",
    "alignable.com", "birdeye.com", "chamberofcommerce.com", "niche.com",
    // Home services
    "angi.com", "homeadvisor.com", "thumbtack.com", "houzz.com", "porch.com", "bark.com",
    // Law
    "avvo.com", "findlaw.com", "justia.com", "superlawyers.com", "martindale.com",
    // Food, travel and lodging
    "tripadvisor.com", "opentable.com", "resy.com", "doordash.com", "ubereats.com", "grubhub.com",
    "booking.com", "expedia.com",
    // Property and cars
    "zillow.com", "realtor.com", "redfin.com", "apartments.com", "cars.com", "dealerrater.com", "edmunds.com",
    "carfax.com",
    // Health, care and wellness
    "realself.com", "healthgrades.com", "zocdoc.com", "vitals.com", "webmd.com", "psychologytoday.com",
    "care.com", "rover.com", "classpass.com", "mindbodyonline.com",
    // Events and schools
    "theknot.com", "weddingwire.com", "greatschools.org",
    // Software and business services
    "g2.com", "capterra.com", "clutch.co", "glassdoor.com", "getapp.com", "softwareadvice.com",
    "producthunt.com", "crunchbase.com",
  ],
  social: [
    "reddit.com", "quora.com", "youtube.com", "facebook.com", "instagram.com", "tiktok.com", "linkedin.com",
    "x.com", "twitter.com", "threads.net", "bsky.app", "snapchat.com", "tumblr.com", "discord.com",
    "medium.com", "substack.com", "pinterest.com",
  ],
  reference: ["wikipedia.org", "wikidata.org", "britannica.com"],
  google: ["google.com", "maps.google.com", "goo.gl"],
};

const KIND_BY_DOMAIN: Record<string, SourceKind> = Object.fromEntries(
  Object.entries(DOMAINS_BY_KIND).flatMap(([kind, domains]) => domains.map(domain => [domain, kind as SourceKind])),
);

/** Lower-cased hostname without "www.", or null for anything that is not an http(s) URL. */
export function domainOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function classifyDomain(host: string, ownDomain: string | null): SourceKind {
  if (ownDomain && matchesDomain(host, ownDomain)) return "own_site";
  for (const [domain, kind] of Object.entries(KIND_BY_DOMAIN)) {
    if (matchesDomain(host, domain)) return kind;
  }
  return "other";
}

export interface CitationCheck {
  promptKind: string;
  mentioned: boolean;
  competitorsMentioned: string[];
  citations: string[];
}

export interface SourceRow {
  domain: string;
  kind: SourceKind;
  /** Answers that cited this domain at least once. */
  answers: number;
  /** Of those, answers that named the practice. */
  namedYou: number;
  /** Of those, answers that named a competitor and not the practice. */
  competitorOnly: number;
}

export interface SourcesReport {
  /** Non-branded answers considered. */
  totalAnswers: number;
  /** Of those, how many cited any source at all. */
  answersWithSources: number;
  /** Share (0-1) of answers with sources that cited the practice's own site. */
  ownSiteRate: number;
  /** Every cited domain, most-cited first. */
  sources: SourceRow[];
  /**
   * Domains cited when the engine recommended a competitor and not the
   * practice, excluding the practice's own site. The pages to get onto.
   */
  gaps: SourceRow[];
  /** Answers citing each kind of source. */
  kindMix: { kind: SourceKind; answers: number }[];
}

/**
 * Builds the sources view from a scan's checks. Branded prompts are left out
 * for the same reason they are left out of every visibility number: they name
 * the practice in the question, so they measure nothing about where the
 * engine goes when it has to choose.
 *
 * Counts are per answer, not per URL: an answer citing three Yelp pages is one
 * answer that leaned on Yelp.
 */
export function buildSourcesReport(checks: CitationCheck[], website: string | null): SourcesReport {
  const ownDomain = website ? domainOf(website.includes("://") ? website : `https://${website}`) : null;
  const earned = checks.filter(c => c.promptKind !== "branded");
  const rows = new Map<string, SourceRow>();
  const kindAnswers = new Map<SourceKind, number>();
  let answersWithSources = 0;
  let ownSiteAnswers = 0;

  for (const check of earned) {
    const domains = new Set(check.citations.map(domainOf).filter((d): d is string => d !== null));
    if (domains.size === 0) continue;
    answersWithSources++;
    const kindsHere = new Set<SourceKind>();
    const competitorOnly = !check.mentioned && check.competitorsMentioned.length > 0;

    for (const domain of domains) {
      const kind = classifyDomain(domain, ownDomain);
      kindsHere.add(kind);
      const row = rows.get(domain) ?? { domain, kind, answers: 0, namedYou: 0, competitorOnly: 0 };
      row.answers++;
      if (check.mentioned) row.namedYou++;
      if (competitorOnly) row.competitorOnly++;
      rows.set(domain, row);
    }
    if (kindsHere.has("own_site")) ownSiteAnswers++;
    for (const kind of kindsHere) kindAnswers.set(kind, (kindAnswers.get(kind) ?? 0) + 1);
  }

  const byCount = (a: SourceRow, b: SourceRow) => b.answers - a.answers || a.domain.localeCompare(b.domain);
  const sources = [...rows.values()].sort(byCount);
  const gaps = sources
    .filter(r => r.kind !== "own_site" && r.competitorOnly > 0)
    .sort((a, b) => b.competitorOnly - a.competitorOnly || byCount(a, b));

  return {
    totalAnswers: earned.length,
    answersWithSources,
    ownSiteRate: answersWithSources ? ownSiteAnswers / answersWithSources : 0,
    sources,
    gaps,
    kindMix: [...kindAnswers.entries()]
      .map(([kind, answers]) => ({ kind, answers }))
      .sort((a, b) => b.answers - a.answers),
  };
}
