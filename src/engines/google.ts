import { loadEnv } from "@/lib/env";
import type { EngineAdapter } from "@/engines/types";
import { EngineError, engineFetch } from "@/engines/types";

/**
 * Google AI Mode, through DataForSEO's live SERP API. Google has no API of
 * its own for AI Mode, and this is the answer a person sees in the browser,
 * not a developer model's.
 *
 * DataForSEO answers HTTP 200 for almost everything and puts the real outcome
 * in a status code of its own, once for the request and once for the task.
 * Those are mapped onto the HTTP statuses the scan runner already retries on,
 * so a rate limit or a slow Google is retried and a bad login is not.
 */
const ENDPOINT = "https://api.dataforseo.com/v3/serp/google/ai_mode/live/advanced";
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

interface Reference { url?: string | null }
interface Block { references?: Reference[] | null; components?: Block[] | null; items?: Block[] | null }
interface Overview extends Block { type: string; markdown?: string | null }

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

export const googleAdapter: EngineAdapter = {
  name: "google",
  async run(prompt) {
    const env = loadEnv();
    const login = `${env.DATAFORSEO_LOGIN ?? ""}:${env.DATAFORSEO_PASSWORD ?? ""}`;
    // DataForSEO decodes "%xx" and reads "+" as a space inside a keyword.
    const keyword = prompt.replace(/%/g, "%25").replace(/\+/g, "%2B").slice(0, MAX_KEYWORD);
    const res = await engineFetch("google", ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(login).toString("base64")}`, "Content-Type": "application/json" },
      // One task per live call.
      body: JSON.stringify([{ keyword, location_code: LOCATION_CODE, language_code: "en" }]),
    });
    if (!res.ok) throw new EngineError("google", res.status, await res.text());
    const data = await res.json();
    const task = data.tasks?.[0];
    const failed = [data, task].find(level => level && level.status_code !== OK);
    if (failed) throw new EngineError("google", asHttp(failed.status_code), `${failed.status_code} ${failed.status_message ?? ""}`);

    const overview = ((task?.result?.[0]?.items ?? []) as Overview[]).find(item => item.type === "ai_overview");
    const answer = readableAnswer(overview?.markdown ?? "");
    // No answer is not "they didn't name you": it is an answer we don't
    // have, so it counts against coverage like any other failed call.
    if (!overview || !answer) throw new EngineError("google", 502, "no AI Mode answer");

    const citations = [...new Set(
      referencesOf(overview).map(r => r.url).filter((url): url is string => !!url && !isGoogleViewer(url)).map(pageUrl),
    )];
    return { answer, citations };
  },
};
