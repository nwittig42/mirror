/**
 * The questions a scan asks when the question drafter could not write any.
 *
 * Built only from what the prospect typed on /book (what kind of business it
 * is, and where), so it is a fixed, ordered set rather than a guess: the same
 * lead always gets the same six questions, and a re-run never adds different
 * ones. The operator can still replace them on the business page.
 *
 * Every question names the location. The engine adapters send no user
 * location, so a question about businesses close to the reader would be
 * answered for nowhere in particular; naming the city is the only way the
 * answer can be about this business's area.
 */

export interface FallbackPromptInput {
  name: string;
  category: string;
  location: string;
}

export interface FallbackPrompt {
  text: string;
  kind: "category" | "branded";
}

/**
 * English plural of one word: s, x, z, ch and sh endings take "es", a
 * consonant followed by y becomes "ies", and everything else takes "s".
 * Enough for business categories (plumber, bakery, business, church);
 * irregular nouns are rare there.
 */
export function pluralize(word: string): string {
  const w = word.trim();
  if (!w) return w;
  if (/(s|x|z|ch|sh)$/i.test(w)) return `${w}es`;
  if (/[^aeiou]y$/i.test(w)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
}

// The form invites a capital ("Plumber", "Med Spa"), which reads as a typo in
// the middle of a question. A word that is capitalised and nothing more is
// lowered; one with other capitals (HVAC, CPA, iPhone) is left alone.
function sentenceCase(category: string): string {
  return category.split(" ")
    .map(w => (/^[A-Z][a-z]/.test(w) && !/[A-Z]/.test(w.slice(1)) ? w[0].toLowerCase() + w.slice(1) : w))
    .join(" ");
}

// "med spa" pluralises on its last word: "med spas".
function pluralCategory(category: string): string {
  const words = category.split(" ");
  const last = words.pop() ?? "";
  return [...words, pluralize(last)].join(" ");
}

const tidy = (s: string) => s.trim().replace(/\s+/g, " ");

export function generateFallbackPrompts(input: FallbackPromptInput): FallbackPrompt[] {
  const name = tidy(input.name);
  const category = sentenceCase(tidy(input.category));
  const location = tidy(input.location);
  // A blank would produce a question about nothing or nowhere; the caller
  // (prospect setup) parks the lead instead, so this is a programming error.
  if (!name || !category || !location) {
    throw new Error("Fallback prompts need a name, a category and a location");
  }
  const plural = pluralCategory(category);
  const article = /^[aeiou]/i.test(category) ? "an" : "a";
  return [
    { text: `What are the best ${plural} in ${location}? Name specific businesses.`, kind: "category" },
    { text: `Can you recommend a good ${category} in ${location}?`, kind: "category" },
    { text: `I'm looking for ${article} ${category} in ${location}. Which ones should I consider?`, kind: "category" },
    { text: `Compare the top ${plural} in ${location}. Which would you choose?`, kind: "category" },
    { text: `What do you know about ${name} in ${location}?`, kind: "branded" },
    { text: `What are people saying about ${name} in ${location}?`, kind: "branded" },
  ];
}
