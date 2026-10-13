import type { FactCategory } from "@/core/fact-draft-parse";

/**
 * A fact sheet is laid out in sections chosen for that one business (a bakery
 * gets "Menu" and "Allergens", a law firm "Practice areas" and "Fees"). The
 * section is only a heading. It is separate from a fact's category, which is
 * the internal type the scoring and the judge rely on (a price error counts
 * more; a "not offered" entry is what catches an invented service) and which
 * a customer never sees.
 */

/** The heading a fact falls under when nobody chose one (facts saved before sections existed). */
export const DEFAULT_SECTION: Record<FactCategory, string> = {
  identity: "About the business",
  services: "Services",
  not_offered: "Not offered",
  pricing: "Prices",
  logistics: "Hours, location and contact",
  providers: "People",
  compliance: "Licenses and credentials",
};

const MAX_SECTION = 40;

/** A typed or model-written heading, tidied: one line, single spaces, capped. Null when empty. */
export function cleanSection(raw: string | null | undefined): string | null {
  const text = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SECTION).trim();
  return text || null;
}

export function sectionOf(fact: { section: string | null; category: FactCategory }): string {
  return cleanSection(fact.section) ?? DEFAULT_SECTION[fact.category];
}

/**
 * Facts grouped under their headings, in the order each heading first
 * appears. Headings that differ only by capitalisation are one section and
 * keep the first spelling.
 */
export function groupBySection<T extends { section: string | null; category: FactCategory }>(
  rows: T[],
): { title: string; facts: T[] }[] {
  const groups = new Map<string, { title: string; facts: T[] }>();
  for (const row of rows) {
    const title = sectionOf(row);
    const key = title.toLowerCase();
    const group = groups.get(key);
    if (group) group.facts.push(row);
    else groups.set(key, { title, facts: [row] });
  }
  return [...groups.values()];
}
