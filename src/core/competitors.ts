import { z } from "zod";
import { extractJsonArray } from "@/core/judge-parse";

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
 * practice. Known spellings win over discovered ones; hidden names and any
 * name that is (or contains) the practice's own name are dropped, because
 * the extractor occasionally returns the practice itself.
 */
export function reconcileCompetitors(args: {
  known: string[];
  ignored: string[];
  discovered: string[];
  practiceNames: string[];
}): { all: string[]; newlyDiscovered: string[] } {
  const practiceKeys = args.practiceNames.map(nameKey);
  const ignoredKeys = args.ignored.map(nameKey);
  const seenKeys = args.known.map(nameKey);
  const newlyDiscovered: string[] = [];

  const matchesAny = (key: string, keys: string[]) =>
    keys.some(k => k === key || isVariantOf(key, k));

  for (const raw of args.discovered) {
    const key = nameKey(raw);
    if (!key || matchesAny(key, seenKeys) || matchesAny(key, ignoredKeys)) continue;
    if (practiceKeys.some(p => key.includes(p) || p.includes(key))) continue;
    seenKeys.push(key);
    newlyDiscovered.push(canonicalName(raw));
  }

  return { all: [...args.known, ...newlyDiscovered], newlyDiscovered };
}
