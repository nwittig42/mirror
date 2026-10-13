/**
 * Which website belongs to a business an AI answer named. The scan stores
 * competitors by name only, so the match is made against the websites the
 * same scan's answers cited: "Apollo" pairs with apollo.io because some
 * answer read apollo.io. Pure. A name with no cited website stays unmatched;
 * guessing "name.com" would put another company's logo beside it.
 */

const TLD_TAIL = /\.(com|io|ai|co|app|org|net|so|dev)$/;
const LABEL_PREFIX = /^(get|try|use|join|go|my|the)(?=.{3,})/;
const LABEL_SUFFIX = /(?<=.{3,})(hq|app|ai|io|inc)$/;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A name as it would be typed in a web address: "Apollo.io" and "Apollo" are both "apollo". */
function nameSlug(name: string): string {
  return squash(name.trim().toLowerCase().replace(TLD_TAIL, ""));
}

/** The spellings of one part of a hostname that a business name may match: "getlemlist" also offers "lemlist". */
function labelSlugs(label: string): string[] {
  const base = squash(label);
  return [...new Set([base, base.replace(LABEL_PREFIX, ""), base.replace(LABEL_SUFFIX, "")])].filter(Boolean);
}

/**
 * Pairs each name with its website, when a cited one fits. `domains` are
 * hostnames without "www."; when several fit, the most-cited wins (they are
 * taken in the order given, so pass them most-cited first).
 */
export function brandDomains(names: string[], domains: string[]): Map<string, string> {
  const bySlug = new Map<string, string>();
  for (const domain of domains) {
    const labels = domain.split(".").slice(0, -1);
    // The part just before the ending is the brand ("mail.google.com" is Google's); the rest are sections of its site.
    const brand = labels[labels.length - 1];
    if (!brand) continue;
    for (const slug of labelSlugs(brand)) if (!bySlug.has(slug)) bySlug.set(slug, domain);
  }
  const out = new Map<string, string>();
  for (const name of names) {
    const slug = nameSlug(name);
    const domain = slug.length >= 3 ? bySlug.get(slug) : undefined;
    if (domain) out.set(name, domain);
  }
  return out;
}
