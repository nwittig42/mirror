import { z } from "zod";
import { extractJsonArray } from "@/core/judge-parse";

export const FACT_CATEGORIES = [
  "identity", "providers", "services", "not_offered", "pricing", "logistics", "compliance",
] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];

export interface DraftFact {
  /** The heading the drafter chose for this business; absent or null if it gave none. */
  section?: string | null;
  category: FactCategory;
  label: string;
  value: string;
  sourceUrl: string | null;
}

const draftSchema = z.array(z.object({
  section: z.string().nullable().optional(),
  category: z.string(),
  label: z.string(),
  value: z.string(),
  sourceUrl: z.string().nullable().optional(),
}));

const MAX_LABEL = 80;
const MAX_VALUE = 400;
const MAX_SECTION = 40;

/**
 * Parses the drafter's JSON. Lenient on the envelope (prose, fences), strict
 * on content: rows with an unknown category or an empty label/value are
 * dropped rather than failing the whole draft, and a label repeated under a
 * different spelling keeps its first occurrence. A draft is a starting point
 * for the fact sheet call, so losing one bad row beats losing all of them.
 *
 * Section headings are the model's own choice for this business. They are
 * tidied, and two headings that differ only by capitalisation become one (the
 * first spelling wins), so "Menu" and "menu" do not split a section.
 */
export function parseDraftFacts(raw: string, pageUrls: string[]): DraftFact[] {
  const json = extractJsonArray(raw, draftSchema);
  if (!json) throw new Error(`No fact array in drafter output: ${raw.slice(0, 200)}`);
  const rows = draftSchema.parse(JSON.parse(json));
  const allowedUrls = new Set(pageUrls);
  const seen = new Set<string>();
  const sections = new Map<string, string>();
  const out: DraftFact[] = [];
  for (const row of rows) {
    const category = row.category.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const label = row.label.trim().slice(0, MAX_LABEL);
    const value = row.value.trim().slice(0, MAX_VALUE);
    if (!(FACT_CATEGORIES as readonly string[]).includes(category) || !label || !value) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Only cite a page we actually fetched: a model-invented URL is worse
    // than no URL, because the operator would trust it.
    const sourceUrl = row.sourceUrl && allowedUrls.has(row.sourceUrl) ? row.sourceUrl : null;
    const typed = (row.section ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SECTION).trim();
    let section: string | null = null;
    if (typed) {
      const sectionKey = typed.toLowerCase();
      if (!sections.has(sectionKey)) sections.set(sectionKey, typed);
      section = sections.get(sectionKey)!;
    }
    out.push({ ...(section ? { section } : {}), category: category as FactCategory, label, value, sourceUrl });
  }
  return out;
}
