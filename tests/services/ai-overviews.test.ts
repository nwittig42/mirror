import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readOverview, summarizeOverviews } from "@/core/ai-overview";
import { checkAiOverviews } from "@/services/ai-overviews";

const names = ["Harbor Plumbing"];
const rivals = ["Rose City Plumbing", "Roto-Rooter"];
const shown = (answer: string, citations: string[] = []) => ({ shown: true, answer, citations });
const none = { shown: false, answer: "", citations: [] };

describe("readOverview", () => {
  it("says whether the business and which competitors an overview names", () => {
    expect(readOverview("Best plumber in Portland",
      shown("Roto-Rooter and Harbor Plumbing LLC are both well reviewed.", ["https://yelp.com/x"]), names, rivals))
      .toEqual({
        question: "Best plumber in Portland", shown: true, named: true, competitors: ["Roto-Rooter"],
        citations: ["https://yelp.com/x"], answer: "Roto-Rooter and Harbor Plumbing LLC are both well reviewed.",
      });
  });

  it("does not count an echo of the name, or an overview that was never shown", () => {
    const echo = readOverview("Is Harbor Plumbing good?",
      shown("I couldn't find any information about Harbor Plumbing. Rose City Plumbing is an option."), names, rivals);
    expect(echo).toMatchObject({ shown: true, named: false, competitors: ["Rose City Plumbing"] });
    expect(readOverview("Best plumber in Portland", none, names, rivals))
      .toEqual({ question: "Best plumber in Portland", shown: false, named: false, competitors: [], citations: [], answer: "" });
  });
});

describe("checkAiOverviews", () => {
  it("counts overviews shown and named in, and keeps a failed search out of both", async () => {
    const answers: Record<string, () => ReturnType<typeof shown>> = {
      a: () => shown("Harbor Plumbing is a top pick."),
      b: () => shown("Rose City Plumbing is a top pick."),
      c: () => none,
      d: () => { throw new Error("google 429"); },
    };
    let flaky = 0;
    answers.e = () => { if (++flaky === 1) throw new Error("google 503"); return shown("Harbor Plumbing is good."); };
    const summary = await checkAiOverviews({
      questions: ["a", "b", "c", "d", "e"], practiceNames: names, competitorNames: rivals, fetch: async q => answers[q](),
    });
    // "d" fails twice and is left out; "e" fails once and is read on the second try.
    expect(summary).toMatchObject({ asked: 4, shown: 3, namedIn: 2, failed: 1 });
    expect(summary.results.map(r => r.question)).toEqual(["a", "b", "c", "e"]);
    expect(summarizeOverviews([])).toEqual({ asked: 0, shown: 0, namedIn: 0, failed: 0, results: [] });
  });
});

describe("fetchAiOverview", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const key of ["DATABASE_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "PERPLEXITY_API_KEY", "RESEND_API_KEY", "CRON_SECRET", "AUTH_SECRET"]) process.env[key] = "k";
    process.env.APP_URL = "http://localhost:3000";
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());
  const page = (items: unknown[]) => new Response(JSON.stringify({
    status_code: 20000, tasks: [{ status_code: 20000, result: [{ type: "organic", items }] }],
  }), { status: 200 });

  it("asks for the organic page with the overview loaded, and reads it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(page([
      { type: "organic", url: "https://harbor.example" },
      {
        type: "ai_overview", markdown: null,
        items: [
          { type: "ai_overview_element", markdown: "**Harbor Plumbing** is well reviewed.[[1]](https://yelp.com/biz/harbor)", references: [{ url: "https://yelp.com/biz/harbor#:~:text=x" }] },
          { type: "ai_overview_element", markdown: null, text: "Rose City Plumbing is another option." },
        ],
        references: [{ url: "https://angi.com/harbor" }],
      },
    ]));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAiOverview } = await import("@/engines/google-overview");
    expect(await fetchAiOverview("best plumber portland")).toEqual({
      shown: true,
      answer: "**Harbor Plumbing** is well reviewed.\n\nRose City Plumbing is another option.",
      citations: ["https://angi.com/harbor", "https://yelp.com/biz/harbor"],
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.dataforseo.com/v3/serp/google/organic/live/advanced");
    expect(JSON.parse(init.body)).toEqual([{ keyword: "best plumber portland", location_code: 2840, language_code: "en", load_async_ai_overview: true }]);
  });

  it("reports no overview when Google showed none, and throws when the search itself failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([{ type: "organic", url: "https://harbor.example" }])));
    const { fetchAiOverview } = await import("@/engines/google-overview");
    expect(await fetchAiOverview("x")).toEqual({ shown: false, answer: "", citations: [] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status_code: 40202, status_message: "rate" }), { status: 200 })));
    await expect(fetchAiOverview("x")).rejects.toThrow(/google 429/);
    // The box is on the page with nothing in it: Google showed one, we just don't have it.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([{ type: "ai_overview", asynchronous_ai_overview: true, markdown: "", items: [], references: [] }])));
    await expect(fetchAiOverview("x")).rejects.toThrow(/shown but not loaded/);
  });
});
