import { z } from "zod";
import { extractJsonArray } from "@/core/judge-parse";
import { nameTokens } from "@/core/mention";

export class CompetitorParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompetitorParseError";
  }
}

const namesSchema = z.array(z.string());

/** Parses the competitor extractor's output: a JSON array of business names. */
export function parseCompetitorOutput(raw: string): string[] {
  const jsonStr = extractJsonArray(raw, namesSchema);
  if (!jsonStr) throw new CompetitorParseError(`No JSON array in competitor output: ${raw.slice(0, 200)}`);
  const names = namesSchema.parse(JSON.parse(jsonStr));
  return names.map(n => n.trim()).filter(n => n.length > 0);
}

/**
 * Drops the location tail engines love to append: "Cienega Medical Spa –
 * Santa Monica", "NAKEDMD (Santa Monica)", "Ava MD - Santa Monica". Only a
 * spaced dash counts, so hyphenated names like "Skin-Tastic" survive.
 */
export function canonicalName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+[–—-]\s+.*$/, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Case- and whitespace-insensitive identity for a business name. */
export function nameKey(name: string): string {
  return canonicalName(name).toLowerCase();
}

/**
 * Directories, review sites, marketplaces and apps the extractor is told to
 * leave out but sometimes returns anyway. Compared by exact key only, so a
 * business that merely contains one of these words ("Amazon Cleaning Co")
 * is still a competitor.
 */
export const KNOWN_PLATFORMS: readonly string[] = [
  "yelp", "google", "google maps", "google business profile", "bing", "bing places", "apple maps",
  "yellow pages", "yp", "angi", "angie's list", "homeadvisor", "thumbtack", "houzz", "nextdoor",
  "facebook", "instagram", "tiktok", "youtube", "linkedin", "reddit", "tripadvisor",
  "bbb", "better business bureau", "groupon", "doordash", "uber eats", "grubhub", "opentable", "resy",
  "zillow", "realtor.com", "amazon", "realself", "healthgrades", "zocdoc", "vitals", "webmd",
  "avvo", "findlaw", "justia", "expertise.com", "three best rated",
];

const PLATFORM_KEYS = new Set(KNOWN_PLATFORMS);

function isPlatform(key: string): boolean {
  return PLATFORM_KEYS.has(key.replace(/’/g, "'"));
}

interface PracticeName {
  key: string;
  tokens: string[];
}

/**
 * Whether a discovered name is the practice itself: its key is contained in
 * a practice key ("Glow" for "Glow MedSpa"), or, compared through the
 * matcher's own tokeniser so that both sides agree on what a name is, its
 * tokens equal a practice variation's ("Harbor Plumbing, LLC", "Harbor
 * Plumbing's") or continue them with anything but a conjunction ("Harbor
 * Plumbing, Portland", "Harbor Plumbing-Portland" are the practice with a
 * descriptor tail; "Harbor Plumbing & Heating" is a different business).
 */
function isPracticeName(key: string, tokens: string[], practiceNames: PracticeName[]): boolean {
  return practiceNames.some(p => {
    if (p.key.includes(key)) return true;
    if (p.tokens.length === 0 || tokens.length < p.tokens.length) return false;
    if (!p.tokens.every((t, i) => tokens[i] === t)) return false;
    return tokens.length === p.tokens.length || tokens[p.tokens.length] !== "and";
  });
}

// A discovered name that starts with a known name plus a space is the same
// business with a descriptor tacked on ("SkinLab Santa Monica", "Kare Plastic
// Surgery & Skin Health Center"). The length floor keeps a short generic
// word ("Skin") from swallowing every name that begins with it.
const MIN_PREFIX_KEY_LENGTH = 6;

function isVariantOf(candidateKey: string, existingKey: string): boolean {
  const [shorter, longer] = candidateKey.length <= existingKey.length
    ? [candidateKey, existingKey] : [existingKey, candidateKey];
  return shorter.length >= MIN_PREFIX_KEY_LENGTH && longer.startsWith(shorter + " ");
}

/**
 * Merges names the scan just discovered into the names already known for a
 * practice. Known spellings win over discovered ones. Hidden names, known
 * platforms and the practice's own name (with or without a descriptor tail)
 * are dropped, because the extractor occasionally returns them; a longer
 * name that continues the practice's with a conjunction ("Harbor Plumbing &
 * Heating") is a different business and is kept.
 */
export function reconcileCompetitors(args: {
  known: string[];
  ignored: string[];
  discovered: string[];
  practiceNames: string[];
}): { all: string[]; newlyDiscovered: string[] } {
  const practice: PracticeName[] = args.practiceNames
    .map(nameKey)
    .filter(key => key.length > 0)
    .map(key => ({ key, tokens: nameTokens(key) }));
  const ignoredKeys = args.ignored.map(nameKey);
  const seenKeys = args.known.map(nameKey);
  const newlyDiscovered: string[] = [];

  const matchesAny = (key: string, keys: string[]) =>
    keys.some(k => k === key || isVariantOf(key, k));

  for (const raw of args.discovered) {
    const key = nameKey(raw);
    if (!key || matchesAny(key, seenKeys) || matchesAny(key, ignoredKeys)) continue;
    if (isPracticeName(key, nameTokens(key), practice) || isPlatform(key)) continue;
    seenKeys.push(key);
    newlyDiscovered.push(canonicalName(raw));
  }

  return { all: [...args.known, ...newlyDiscovered], newlyDiscovered };
}
