import { loadEnv } from "@/lib/env";
import type { Engine } from "@/core/types";
import { EngineError, engineFetch } from "@/engines/types";

/**
 * DataForSEO's live Google SERP API, which is how the scan reads what Google's
 * own AI says: Google has no API for AI Mode or AI Overviews, and this is the
 * answer a person sees in the browser, not a developer model's.
 *
 * DataForSEO answers HTTP 200 for almost everything and puts the real outcome
 * in a status code of its own, once for the request and once for the task.
 * Those are mapped onto the HTTP statuses the scan runner already retries on,
 * so a rate limit or a slow Google is retried and a bad login is not.
 */
const HOST = "https://api.dataforseo.com/v3/serp/google";
/** United States. The questions name the city themselves. */
const LOCATION_CODE = 2840;
const MAX_KEYWORD = 700;

const OK = 20000;
const AS_HTTP: Record<number, number> = {
  40100: 401, // bad login
  40104: 401, // account not verified yet
  40200: 402, 40210: 402, // out of balance
  40202: 429, 40209: 429, // per-minute limit, too many at once
  40101: 503, 40103: 503, // Google errored, or the task failed: try again
  50401: 408, // not answered inside DataForSEO's 120 seconds
};

/** A DataForSEO status as the nearest HTTP status: known ones by table, other 5xxxx as 503, the rest as 400. */
function asHttp(code: number): number {
  return AS_HTTP[code] ?? (code >= 50000 ? 503 : 400);
}

export interface Reference { url?: string | null }
/** A piece of an AI answer: the whole answer, a paragraph of it, or a part of an expanded section. */
export interface Block {
  type?: string;
  markdown?: string | null;
  text?: string | null;
  references?: Reference[] | null;
  components?: Block[] | null;
  items?: Block[] | null;
}

/** Whether DataForSEO is configured, so Google's AI can be asked at all. */
export function hasDataForSeo(): boolean {
  return !!process.env.DATAFORSEO_LOGIN && !!process.env.DATAFORSEO_PASSWORD;
}

/**
 * One live search. `path` picks the result page ("ai_mode" or "organic");
 * returns the items Google showed, empty when it showed none. Throws
 * EngineError under `engine`'s name for anything that went wrong.
 */
export async function searchGoogle(
  engine: Engine, path: "ai_mode" | "organic", question: string, extra: Record<string, unknown> = {},
): Promise<Block[]> {
  const env = loadEnv();
  const login = `${env.DATAFORSEO_LOGIN ?? ""}:${env.DATAFORSEO_PASSWORD ?? ""}`;
  // DataForSEO decodes "%xx" and reads "+" as a space inside a keyword.
  const keyword = question.replace(/%/g, "%25").replace(/\+/g, "%2B").slice(0, MAX_KEYWORD);
  const res = await engineFetch(engine, `${HOST}/${path}/live/advanced`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(login).toString("base64")}`, "Content-Type": "application/json" },
    // One task per live call.
    body: JSON.stringify([{ keyword, location_code: LOCATION_CODE, language_code: "en", ...extra }]),
  });
  if (!res.ok) throw new EngineError(engine, res.status, await res.text());
  const data = await res.json();
  const task = data.tasks?.[0];
  const failed = [data, task].find(level => level && level.status_code !== OK);
  if (failed) throw new EngineError(engine, asHttp(failed.status_code), `${failed.status_code} ${failed.status_message ?? ""}`);
  return (task?.result?.[0]?.items ?? []) as Block[];
}

/** Every source under an answer: its side panel, each paragraph, and each part of an expanded section. */
function referencesOf(block: Block): Reference[] {
  return [
    ...(block.references ?? []),
    ...[...(block.items ?? []), ...(block.components ?? [])].flatMap(referencesOf),
  ];
}

/**
 * The answer as a person reads it. The markdown carries a numbered link after
 * every sourced sentence ("[[1]](https://...)") and product pictures; both
 * would drown the text and neither is something the answer says.
 */
export function readableAnswer(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)[ \t]*/g, "")
    .replace(/\[\[\d+\]\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Google points a source at the sentence it used ("#:~:text=..."); the page itself is the citation. */
function pageUrl(url: string): string {
  return url.replace(/#:~:text=.*$/, "");
}

/** Google's own panel for a map listing or a search, which it lists among the sources. Not a page anyone can earn a place on. */
function isGoogleViewer(url: string): boolean {
  return /^https?:\/\/(?:www\.)?google\.[a-z.]+\/(?:searchviewer|search)\b/i.test(url);
}

/** The pages an AI answer cites, each once, in the order Google lists them. */
export function citationsOf(answer: Block): string[] {
  return [...new Set(
    referencesOf(answer).map(r => r.url).filter((url): url is string => !!url && !isGoogleViewer(url)).map(pageUrl),
  )];
}

/**
 * An AI answer's text: its own markdown when it has one, otherwise its
 * paragraphs joined, since a page of results carries some overviews only in
 * pieces.
 */
export function answerText(answer: Block): string {
  const whole = readableAnswer(answer.markdown ?? "");
  if (whole) return whole;
  const parts = [...(answer.items ?? []), ...(answer.components ?? [])];
  return parts.map(part => readableAnswer(part.markdown ?? "") || (part.text ?? "").trim() || answerText(part))
    .filter(Boolean).join("\n\n");
}
