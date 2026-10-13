/**
 * Name matching for scanned answers.
 *
 * A typed business name rarely comes back from an engine exactly as typed:
 * the client writes "Harbor Plumbing LLC" and the answer says "Harbor
 * Plumbing", "Joe's Pizza" comes back as "Joes Pizza", "SkinLab" as "Skin
 * Lab", "The Rusty Anchor" as "Rusty Anchor", "Crumb & Crust" as "Crumb and
 * Crust". Every variation is compiled into one tolerant matcher
 * (`compileMatcher`) and every function here goes through it, so
 * `mentioned`, `position`, the quoted snippet and the highlight all agree on
 * what counts as the name.
 *
 * Two things a bare match gets wrong are handled on top of it. A match that
 * is only the first words of a longer business name ("Harbor Plumbing &
 * Heating", "Glow and Grace Aesthetics") is rejected by the longer-name
 * guard. A match inside "I couldn't find any information about Harbor
 * Plumbing" is the engine echoing the question, not a mention; echo
 * detection applies to the practice's own names only, never to competitors.
 */

export interface Match {
  name: string;
  start: number;
  end: number;
}

export interface Range {
  start: number;
  end: number;
}

export type MentionKind = "named" | "echo" | "absent";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Matcher ---------------------------------------------------------------

const ARTICLES = new Set(["the", "a", "an"]);
// Dotted spellings (l.l.c, p.c, d.d.s, m.d, p.a) are looked up with the dots
// removed, see `tokenize`.
const LEGAL_SUFFIXES = new Set([
  "llc", "inc", "incorporated", "ltd", "limited", "co", "corp", "corporation",
  "pllc", "pc", "dds", "md", "pa", "lp", "llp", "gmbh", "plc",
]);
// "&", "+" and the word "and" are one token, so "Crumb & Crust" and "Crumb
// and Crust" are the same name. It is never distinctive and never required.
const CONJUNCTION = "and";

const APOSTROPHE = /['’]/g;
const AMPERSAND = /[&+]/g;
// Combining marks (\p{M}) belong to the letter before them: an answer in
// NFD form spells "é" as "e" plus U+0301.
const NON_ALNUM_RUN = /[^\p{L}\p{N}\p{M}]+/gu;
const CASE_BOUNDARY = /(\p{Ll}\p{M}*)(\p{Lu})/gu;
const TRAILING_POSSESSIVE = /['’]s$/iu;

/**
 * Lower-cased tokens of a variation, split on whitespace, punctuation and a
 * lower-to-upper boundary inside a word ("SkinLab" gives skin, lab; "NAKEDMD"
 * stays one token; "iPhone" gives i, phone). Apostrophes are deleted first,
 * so "Joe's" is one token, joes; "&" and "+" become the token and.
 */
function tokenize(variation: string): string[] {
  const tokens: string[] = [];
  const words = variation.normalize("NFC").replace(APOSTROPHE, "").replace(AMPERSAND, ` ${CONJUNCTION} `);
  for (const word of words.split(/\s+/u)) {
    const compact = word.replace(NON_ALNUM_RUN, "").toLowerCase();
    if (!compact) continue;
    if (LEGAL_SUFFIXES.has(compact)) {
      tokens.push(compact);
      continue;
    }
    for (const token of word.replace(CASE_BOUNDARY, "$1 $2").toLowerCase().split(NON_ALNUM_RUN)) {
      if (token) tokens.push(token);
    }
  }
  return tokens;
}

function isDistinctive(token: string): boolean {
  return !ARTICLES.has(token) && !LEGAL_SUFFIXES.has(token) && token !== CONJUNCTION;
}

/**
 * The tokens the matcher requires of a variation, or null when nothing
 * distinctive is left ("LLC", "The", an empty string). Trailing suffixes go
 * only while two distinctive tokens remain: "Harbor Plumbing LLC" becomes
 * harbor plumbing, but "The Pasta Co" keeps its co and "Ava MD" its md,
 * because pasta or ava alone would match far too much. A leading article is
 * split off as optional only when two other words follow it ("The Rusty
 * Anchor" matches "Rusty Anchor"); "The Spa" keeps its article, or every
 * sentence with the word spa in it would be a mention.
 */
function matcherTokens(variation: string): { article: string | null; tokens: string[] } | null {
  const tokens = tokenize(variation);
  const distinctive = tokens.filter(isDistinctive).length;
  if (distinctive === 0) return null;

  const last = () => tokens[tokens.length - 1];
  while (tokens.length > 0 && last() === CONJUNCTION) tokens.pop();
  if (distinctive >= 2) {
    while (tokens.length > 0 && (LEGAL_SUFFIXES.has(last()) || last() === CONJUNCTION)) tokens.pop();
  }

  let article: string | null = null;
  if (ARTICLES.has(tokens[0]) && tokens.slice(1).filter(t => t !== CONJUNCTION).length >= 2) {
    article = tokens.shift() ?? null;
  }
  return { article, tokens };
}

/**
 * The normalised tokens of a business name, as the matcher sees it: lower
 * case, apostrophes deleted, a trailing possessive dropped, "&" and "+" as
 * and, legal suffixes dropped behind the floor, an optional leading article
 * dropped. Two names with equal tokens are matched by the same pattern.
 * Empty when nothing distinctive is left. This is how competitor
 * reconciliation tells "Harbor Plumbing, LLC" from "Harbor Plumbing &
 * Heating".
 */
export function nameTokens(name: string): string[] {
  return matcherTokens(name.replace(TRAILING_POSSESSIVE, ""))?.tokens ?? [];
}

const BOUNDARY_BEFORE = "(?<![\\p{L}\\p{N}\\p{M}])";
const BOUNDARY_AFTER = "(?![\\p{L}\\p{N}\\p{M}])";
// "SkinLab", "Skin Lab", "Skin-Lab" and "Skin & Lab" are all the same name,
// but a name never spans a sentence end or a line break: "serve Portland.
// Plumbing rates" is not Portland Plumbing. A period is allowed only after a
// token short enough to be an abbreviation ("Dr. Kim", "St. Mary's").
const BETWEEN_TOKENS = "[^\\p{L}\\p{N}\\p{M}.!?\\n\\r]{0,4}";
const BETWEEN_TOKENS_AFTER_ABBREVIATION = "[^\\p{L}\\p{N}\\p{M}!?\\n\\r]{0,4}";
const ABBREVIATION_LENGTH = 3;
// "Joe Pizza" typed, "Joe's Pizza" in the answer. The last token carries no
// possessive of its own: the closing boundary already accepts an apostrophe,
// and keeping "'s" out of the span lets echo detection see it.
const POSSESSIVE = "(?:['’]s)?";
// The word needs its own boundaries so that "Sandwich" is not "S & Wich".
const CONJUNCTION_PATTERN = `(?:${BOUNDARY_BEFORE}and${BOUNDARY_AFTER}|&|\\+)`;

function separatorAfter(token: string): string {
  return token.length <= ABBREVIATION_LENGTH ? BETWEEN_TOKENS_AFTER_ABBREVIATION : BETWEEN_TOKENS;
}

// A letter with an accent matches its composed form and its base letter
// followed by combining marks, so an NFD answer matches an NFC variation and
// the other way round.
function letterPattern(letter: string): string {
  const decomposed = Array.from(letter.normalize("NFD"));
  if (decomposed.length < 2 || /\p{M}/u.test(decomposed[0])) return escapeRegex(letter);
  return `(?:${escapeRegex(letter)}|${escapeRegex(decomposed[0])}\\p{M}*)`;
}

// A token matches its own letters with an apostrophe allowed between any
// two of them, so joes matches "Joe's", "Joes" and "Joes'".
function tokenPattern(token: string): string {
  return Array.from(token.normalize("NFC")).map(letterPattern).join("['’]?");
}

interface Compiled {
  name: string;
  /** Finds occurrences anywhere in the answer (global). */
  scan: RegExp;
  /** Finds an occurrence starting exactly at `lastIndex` (sticky). */
  at: RegExp;
}

/**
 * Compiles one variation. Returns null for a variation that has nothing
 * distinctive to match ("LLC", "The", an empty string): it never matches.
 */
function compileMatcher(name: string): Compiled | null {
  const parts = matcherTokens(name);
  if (!parts) return null;
  const { article, tokens } = parts;

  // Every token but the article and the conjunction is required: generic
  // words such as group or associates are what tell two names on the same
  // street apart.
  let source = BOUNDARY_BEFORE;
  if (article) source += `(?:${tokenPattern(article)}${separatorAfter(article)})?`;
  source += tokens
    .map((token, i) => {
      const separator = i < tokens.length - 1 ? separatorAfter(token) : "";
      if (token === CONJUNCTION) return `(?:${CONJUNCTION_PATTERN}${separator})?`;
      return tokenPattern(token) + (separator ? POSSESSIVE + separator : "");
    })
    .join("");
  source += BOUNDARY_AFTER;

  return { name, scan: new RegExp(source, "giu"), at: new RegExp(source, "iuy") };
}

function compileAll(names: string[]): Compiled[] {
  return names.map(compileMatcher).filter((c): c is Compiled => c !== null);
}

// --- Longer-name guard -----------------------------------------------------

// Up to four non-alphanumerics, then `&`, `+` or `and`, whitespace and a
// capital letter: the match may be the first words of a longer business
// name. A comma or semicolon ("A, and B") marks a list, and a sentence end,
// a line break or a dash ("Call A. And B...", "A — and B agrees —") can
// never sit inside a name.
const LONGER_NAME = /[^\p{L}\p{N}\p{M},;.!?\n\r—–]{0,4}(?:[&+]|[aA][nN][dD])\s+\p{Lu}/uy;

// Words that follow a conjunction without continuing a business name: "I",
// the pronouns and titles that open a new clause or a person's name ("Glow
// MedSpa and Dr. Kim there is excellent"), and the review sites and directories an answer names next to a business
// ("Harbor Plumbing and Yelp both list the hours"). Kept here rather than
// taken from competitors.ts, which imports this module.
const AFTER_CONJUNCTION_WORDS = compileAll([
  "I", "They", "Their", "We", "You", "It", "Dr", "Mr", "Mrs", "Ms", "Yelp", "Google", "Google Maps", "Google Business Profile", "Facebook", "Instagram", "Angi",
  "Thumbtack", "Houzz", "Nextdoor", "TripAdvisor", "BBB", "HomeAdvisor", "Amazon", "Reddit", "YouTube",
  "TikTok", "LinkedIn", "Bing", "Apple Maps", "Yellow Pages",
]);

// A run of capitalised words and then a plural verb: "Harbor Plumbing and
// Rose City Plumbing are both well reviewed" is two businesses, where "Harbor
// Plumbing & Heating is top rated" is one. Lets a list be read as a list
// even when the second business is not a known name yet, which is every
// time the competitor extractor fails or leaves it out.
const LIST_OF_TWO =
  /(?:[\p{Lu}\p{N}][\p{L}\p{N}\p{M}'’.&-]*\s+){1,6}(?:are|were|both|each|have)(?![\p{L}\p{N}\p{M}])/uy;

/**
 * Whether the occurrence of `all[self]` at [start, end) is really a longer
 * business name. Two things keep it: the capitalised word after the
 * conjunction starts another known name ("Skin Bar LA and Glow MedSpa are
 * both good" is a list of two businesses, not one), or the longer text
 * matches another variation of the same business that is itself accepted, so
 * a client who lists both "Harbor Plumbing" and "Harbor Plumbing & Heating"
 * is matched by either. `others` holds the names that may follow a
 * conjunction without turning the match into a longer name: the practice's
 * variations when matching competitors, and the competitors when matching
 * the practice. "I", pronouns, titles and the platform names are always
 * allowed, and so is a second name followed by a plural verb.
 */
function rejectedAsLongerName(
  answer: string, all: (Compiled | null)[], self: number, start: number, end: number, others: Compiled[],
): boolean {
  LONGER_NAME.lastIndex = end;
  if (!LONGER_NAME.test(answer)) return false;
  // The regex ends on the capital letter, so the next name would start there.
  const nextStart = LONGER_NAME.lastIndex - 1;
  for (const known of [...all, ...others, ...AFTER_CONJUNCTION_WORDS]) {
    if (!known) continue;
    known.at.lastIndex = nextStart;
    if (known.at.test(answer)) return false;
  }
  LIST_OF_TWO.lastIndex = nextStart;
  if (LIST_OF_TWO.test(answer)) return false;
  for (let j = 0; j < all.length; j++) {
    const other = all[j];
    if (j === self || !other) continue;
    other.at.lastIndex = start;
    const m = other.at.exec(answer);
    // Strictly longer spans only, so the recursion always terminates.
    if (m && m[0].length > end - start && !rejectedAsLongerName(answer, all, j, start, start + m[0].length, others)) {
      return false;
    }
  }
  return true;
}

// --- Echo detection --------------------------------------------------------

const NO_KNOWLEDGE_PHRASES = [
  "could not find", "couldn't find", "can't find", "cannot find", "unable to find",
  "wasn't able to find", "was not able to find", "didn't find", "did not find",
  "don't have", "do not have", "doesn't have", "does not have",
  "not aware of", "not familiar with",
  "no information", "no details", "no record", "no reliable information",
  "no specific information", "little information", "limited information",
];

const phrasePattern = (phrase: string) =>
  escapeRegex(phrase).replace(/'/g, "['’]").replace(/ /g, "\\s+");

const NO_KNOWLEDGE_ALTERNATION = NO_KNOWLEDGE_PHRASES.map(phrasePattern).join("|");
const NO_KNOWLEDGE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${NO_KNOWLEDGE_ALTERNATION})(?![\\p{L}\\p{N}])`,
  "giu",
);
// A phrase that ends in its own preposition ("not aware of") links straight
// to a name that follows it; the words in `LINKED` are not needed again.
const PHRASE_OWN_PREPOSITION = /(?:of|with)$/iu;
// The link word sits directly after the phrase, with only filler words on
// either side of it ("couldn't find any information about X", "didn't find
// much about X", "no details on X"), then punctuation or quotes before the
// name. "no record of complaints for X" and "don't have time to shop around,
// go for X" say something about the business and are not linked.
const FILLER_WORDS = [
  "a", "an", "the", "this", "that", "any", "much", "more", "many", "some", "specific", "detailed",
  "reliable", "public", "verified", "available", "current", "information", "details", "data", "review",
  "reviews", "record", "records", "result", "results", "listing", "listings", "anything", "something",
  "else", "or", "customer", "online", "recent", "business", "company", "called", "named",
];
const FILLER = `(?:${FILLER_WORDS.join("|")})`;
const LINKED = new RegExp(
  `^\\s*(?:${FILLER}[,\\s]+)*(?:about|on|for|regarding|of)(?:\\s+${FILLER})*[^\\p{L}\\p{N}\\p{M}]*$`,
  "iu",
);
const CONTRAST = /(?<![\p{L}\p{N}])(?:but|however|that\s+said|although|though)(?![\p{L}\p{N}])/iu;
// The clause a contrast word introduces starts after optional punctuation,
// whitespace or markdown.
const CLAUSE_LEAD = /^[^\p{L}\p{N}\p{M}]*/u;
// "Harbor Plumbing's hours": the engine knows the business, not one fact.
const ATTRIBUTE_POSSESSIVE = /^['’]s\s+[\p{L}\p{N}]/u;
// "Harbor Plumbing: I'm not aware of this business", as a list item or not.
const LABEL_COLON = /^[^\p{L}\p{N}:]{0,4}:/u;
// The label's content must be the no-knowledge statement itself, after an
// optional lead-in ("I'm", "I", "Sorry,", "Unfortunately,", "There is"):
// "Harbor Plumbing: well reviewed on Yelp; no details on pricing" describes
// the business and then caveats one fact.
const LABEL_LEAD_IN =
  "(?:(?:i['’]?m|i|we|sorry|unfortunately|i\\s+have|there\\s+is|there['’]?s)[,\\s]+[^\\p{L}\\p{N}\\p{M}]*){0,3}";
const LABEL_NO_KNOWLEDGE = new RegExp(
  `^[^\\p{L}\\p{N}\\p{M}]*${LABEL_LEAD_IN}(?:${NO_KNOWLEDGE_ALTERNATION})(?![\\p{L}\\p{N}])`,
  "iu",
);
const ALNUM = /[\p{L}\p{N}]/u;
// How far (in characters) a no-knowledge phrase may sit from the name.
const ECHO_WINDOW = 60;

// Sentence ends (`.`, `!`, `?` and whitespace), newlines, and list markers
// (`-`, `*`, `•`, `1.`, `1)`) all close a sentence.
const SENTENCE_BREAK = /[.!?]+\s+|\n+|(?:^|(?<=\s))(?:[-*•]|\d+[.)])\s+/gu;

/**
 * The sentences of `answer` as [start, end) ranges, skipping runs with no
 * letter or digit. Shared with the namesake guard in tone.ts so both apply
 * one sentence rule.
 */
export function splitSentences(answer: string): Range[] {
  const sentences: Range[] = [];
  const push = (start: number, end: number) => {
    if (end > start && ALNUM.test(answer.slice(start, end))) sentences.push({ start, end });
  };
  let start = 0;
  SENTENCE_BREAK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SENTENCE_BREAK.exec(answer)) !== null) {
    if (m[0].length === 0) {
      SENTENCE_BREAK.lastIndex++;
      continue;
    }
    push(start, m.index);
    start = m.index + m[0].length;
  }
  push(start, answer.length);
  return sentences;
}

// How a clause that is still about the business opens: a pronoun for it, a
// plain noun for it, or the people who talk about it.
const ABOUT_THE_BUSINESS = new RegExp(
  "^(?:they|their|theirs|it|its|the\\s+(?:business|company|shop|firm|team|practice|clinic|restaurant|store|studio)"
  + "|this\\s+(?:business|company|shop|firm)|reviews|reviewers|customers|locals)(?![\\p{L}\\p{N}\\p{M}])",
  "iu",
);

/**
 * Whether the first contrast word after the name (but / however / that said
 * / although / though) says the engine does know the business. It does only
 * when the clause it introduces is about the business: "..., but they are
 * well reviewed" rescues. "..., but Roto-Rooter is a solid option" is about
 * a competitor and "..., but most plumbers charge $100 to $200" is about
 * the trade, so neither does.
 */
function contrastRescues(answer: string, after: string, afterStart: number, known: Compiled[]): boolean {
  const contrast = CONTRAST.exec(after);
  if (!contrast) return false;
  const clauseStart = contrast.index + contrast[0].length;
  const lead = CLAUSE_LEAD.exec(after.slice(clauseStart))?.[0].length ?? 0;
  const at = afterStart + clauseStart + lead;
  for (const name of known) {
    name.at.lastIndex = at;
    if (name.at.test(answer)) return false;
  }
  return ABOUT_THE_BUSINESS.test(answer.slice(at));
}

/**
 * Whether the occurrence at [start, end) only echoes the question: inside
 * its sentence a no-knowledge phrase is linked to it by a preposition (or the
 * name is the label of a "Name: I don't know it" line), and nothing says the
 * engine does know the business (a possessive attribute after the name, or a
 * contrast clause about the business later in the sentence). `known` are the
 * other names a contrast clause may be about instead: the rest of the list
 * being matched and the caller's `others`.
 */
function isEcho(answer: string, start: number, end: number, sentences: Range[], known: Compiled[]): boolean {
  const sentence = sentences.find(s => start >= s.start && start < s.end);
  if (!sentence) return false;

  const after = answer.slice(end, Math.max(end, sentence.end));
  if (ATTRIBUTE_POSSESSIVE.test(after) || contrastRescues(answer, after, end, known)) return false;

  const before = answer.slice(sentence.start, start);
  NO_KNOWLEDGE.lastIndex = 0;
  let phrase: RegExpExecArray | null;
  while ((phrase = NO_KNOWLEDGE.exec(before)) !== null) {
    const phraseEnd = sentence.start + phrase.index + phrase[0].length;
    if (start - phraseEnd > ECHO_WINDOW) continue;
    const between = answer.slice(phraseEnd, start);
    // "limited information on pricing, but Harbor Plumbing is highly rated":
    // the contrast breaks the link.
    if (CONTRAST.test(between)) continue;
    if (LINKED.test(between)) return true;
    if (PHRASE_OWN_PREPOSITION.test(phrase[0]) && !ALNUM.test(between)) return true;
  }

  const colon = LABEL_COLON.exec(after);
  if (colon && LABEL_NO_KNOWLEDGE.test(after.slice(colon[0].length))) return true;
  return false;
}

// --- Scanning --------------------------------------------------------------

/**
 * The accepted occurrences of `all[i]`, skipping occurrences the guard
 * rejects and, when `sentences` is given, echoes: the first one, or every
 * one when `every` is set. `echoed` says whether an echo was skipped, which
 * `mentionKind` needs to tell "echo" from "absent".
 */
function occurrences(
  answer: string, all: (Compiled | null)[], i: number, sentences: Range[] | null, others: Compiled[], every: boolean,
): { matches: Match[]; echoed: boolean } {
  const compiled = all[i];
  const matches: Match[] = [];
  let echoed = false;
  if (!compiled) return { matches, echoed };
  const known = [...all.filter((c): c is Compiled => c !== null), ...others];
  compiled.scan.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = compiled.scan.exec(answer)) !== null) {
    if (m[0].length === 0) {
      compiled.scan.lastIndex++;
      continue;
    }
    const start = m.index;
    const end = start + m[0].length;
    if (rejectedAsLongerName(answer, all, i, start, end, others)) continue;
    if (sentences && isEcho(answer, start, end, sentences, known)) {
      echoed = true;
      continue;
    }
    matches.push({ name: compiled.name, start, end });
    if (!every) break;
  }
  return { matches, echoed };
}

function analyse(
  answer: string, names: string[], filterEchoes: boolean, otherNames: string[], every = false,
): { matches: Match[]; echoed: boolean } {
  const all = names.map(compileMatcher);
  const others = compileAll(otherNames);
  // Split once per answer, not once per occurrence.
  const sentences = filterEchoes ? splitSentences(answer) : null;
  const matches: Match[] = [];
  let echoed = false;
  for (let i = 0; i < all.length; i++) {
    const found = occurrences(answer, all, i, sentences, others, every);
    matches.push(...found.matches);
    echoed = echoed || found.echoed;
  }
  matches.sort((a, b) => a.start - b.start || a.end - b.end);
  return { matches, echoed };
}

// --- API -------------------------------------------------------------------

/**
 * Every name's first occurrence that the longer-name guard accepts, sorted by
 * position. No echo filtering: this is the call for competitor names.
 * `others` are the names that may follow a conjunction without making the
 * match a longer name (see `rejectedAsLongerName`).
 */
export function findMatches(answer: string, names: string[], others: string[] = []): Match[] {
  return analyse(answer, names, false, others).matches;
}

/**
 * Like `findMatches`, skipping occurrences that only echo the question. This
 * is the call for the practice's own names.
 */
export function findMentions(answer: string, practiceNames: string[], others: string[] = []): Match[] {
  return analyse(answer, practiceNames, true, others).matches;
}

/**
 * Every accepted occurrence of every name, not only the first, sorted by
 * position. The guard applies, echoes are kept. `classifyPosition` needs
 * every occurrence so that one swallowed by a longer competitor span does
 * not hide a later real one.
 */
export function findAllMatches(answer: string, names: string[], others: string[] = []): Match[] {
  return analyse(answer, names, false, others, true).matches;
}

/** Like `findAllMatches`, skipping echoes: the practice's own names. */
export function findAllMentions(answer: string, practiceNames: string[], others: string[] = []): Match[] {
  return analyse(answer, practiceNames, true, others, true).matches;
}

/**
 * "named" when some variation has a real mention, "echo" when every
 * occurrence only echoes the question, "absent" when none occurs.
 */
export function mentionKind(answer: string, practiceNames: string[], others: string[] = []): MentionKind {
  const { matches, echoed } = analyse(answer, practiceNames, true, others);
  if (matches.length > 0) return "named";
  return echoed ? "echo" : "absent";
}

export function detectMention(answer: string, variations: string[], others: string[] = []): boolean {
  return findMentions(answer, variations, others).length > 0;
}

/** Names with a real mention, in order of first appearance. */
export function detectNames(answer: string, names: string[], others: string[] = []): string[] {
  return findMentions(answer, names, others).map(m => m.name);
}

/**
 * Very small "best sentence" heuristic: finds the earliest real mention of
 * any of `names` in `answer` (via `findMentions`, the same semantics as
 * `checks.mentioned`), then returns the ". "-delimited sentence that contains
 * it, truncated to ~160 chars. Not NLP, just good enough to surface a
 * relevant verbatim snippet (weekly Pulse email, monthly client report)
 * without another judge/LLM round trip. Falls back to `null` when none of
 * `names` is really mentioned in `answer`.
 */
export function extractSnippet(answer: string, names: string[], others: string[] = []): string | null {
  const matches = findMentions(answer, names, others);
  if (matches.length === 0) return null;
  const earliestStart = matches[0].start;

  const sentences = answer.split(". ");
  let offset = 0;
  for (const sentence of sentences) {
    const end = offset + sentence.length;
    if (earliestStart >= offset && earliestStart < end) {
      return sentence.length > 160 ? `${sentence.slice(0, 160)}…` : sentence;
    }
    offset = end + 2; // 2 == length of the ". " delimiter split() consumed
  }
  return null;
}

/**
 * Every occurrence (not just the first) of any variation in `answer`, with
 * overlapping/adjacent ranges merged so a caller can highlight without
 * double-wrapping text (e.g. one variation's name containing another's,
 * "Glow" inside "Glow MedSpa"). Sorted by start. Echoes are kept, because
 * highlighting is for reading an answer and the name is there to read; a
 * longer business name that merely starts with ours is not highlighted.
 */
export function highlightRanges(answer: string, variations: string[], others: string[] = []): Range[] {
  const ranges: Range[] = findAllMatches(answer, variations, others);

  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ start: range.start, end: range.end });
    }
  }
  return merged;
}
