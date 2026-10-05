import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.DATABASE_URL = "postgres://x";
  process.env.OPENAI_API_KEY = "k";
  process.env.ANTHROPIC_API_KEY = "k";
  process.env.GEMINI_API_KEY = "k";
  process.env.PERPLEXITY_API_KEY = "k";
  process.env.RESEND_API_KEY = "k";
  process.env.CRON_SECRET = "s";
  process.env.AUTH_SECRET = "s";
  process.env.APP_URL = "http://localhost:3000";
});

afterEach(() => vi.unstubAllGlobals());

describe("perplexity adapter", () => {
  it("maps answer and citations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Glow MedSpa is popular." } }],
            citations: ["https://yelp.com/biz/glow"],
          }),
          { status: 200 },
        ),
      ),
    );
    const { perplexityAdapter } = await import("@/engines/perplexity");
    const r = await perplexityAdapter.run("best med spa santa monica");
    expect(r).toEqual({
      answer: "Glow MedSpa is popular.",
      citations: ["https://yelp.com/biz/glow"],
    });
  });

  it("throws EngineError on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );
    const { perplexityAdapter } = await import("@/engines/perplexity");
    await expect(perplexityAdapter.run("x")).rejects.toThrow(/perplexity.*429/);
  });

  it.each(["AbortError", "TimeoutError"])(
    "throws EngineError(408, timeout) when fetch rejects with %s",
    async (errorName) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(Object.assign(new Error("timed out"), { name: errorName })),
      );
      const { perplexityAdapter } = await import("@/engines/perplexity");
      await expect(perplexityAdapter.run("x")).rejects.toThrow(/perplexity 408: timeout/);
    },
  );
});

describe("openai adapter", () => {
  it("maps answer and citations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            output: [
              { type: "reasoning", id: "r1" },
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: "Glow MedSpa is popular.",
                    annotations: [
                      { type: "url_citation", url: "https://yelp.com/biz/glow" },
                      { type: "other", url: "https://ignored.example" },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const { openaiAdapter } = await import("@/engines/openai");
    const r = await openaiAdapter.run("best med spa santa monica");
    expect(r).toEqual({
      answer: "Glow MedSpa is popular.",
      citations: ["https://yelp.com/biz/glow"],
      searchQueries: [],
    });
  });

  it("throws EngineError on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );
    const { openaiAdapter } = await import("@/engines/openai");
    await expect(openaiAdapter.run("x")).rejects.toThrow(/openai.*429/);
  });
});

describe("anthropic adapter", () => {
  it("maps answer and citations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: "Glow MedSpa is popular.",
                citations: [{ url: "https://yelp.com/biz/glow" }],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const { anthropicAdapter } = await import("@/engines/anthropic");
    const r = await anthropicAdapter.run("best med spa santa monica");
    expect(r).toEqual({
      answer: "Glow MedSpa is popular.",
      citations: ["https://yelp.com/biz/glow"],
      searchQueries: [],
    });
  });

  it("throws EngineError on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );
    const { anthropicAdapter } = await import("@/engines/anthropic");
    await expect(anthropicAdapter.run("x")).rejects.toThrow(/anthropic.*429/);
  });
});

describe("gemini adapter", () => {
  it("maps answer and citations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: "Glow MedSpa is popular." }] },
                groundingMetadata: {
                  groundingChunks: [{ web: { uri: "https://yelp.com/biz/glow" } }],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const { geminiAdapter } = await import("@/engines/gemini");
    const r = await geminiAdapter.run("best med spa santa monica");
    expect(r).toEqual({
      answer: "Glow MedSpa is popular.",
      citations: ["https://yelp.com/biz/glow"],
      searchQueries: [],
    });
  });

  it("replaces Google's grounding redirect with the real site named in the title", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{
              content: { parts: [{ text: "x" }] },
              groundingMetadata: {
                groundingChunks: [
                  { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "Yelp.com" } },
                  { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/def", title: "Best med spas" } },
                ],
              },
            }],
          }),
          { status: 200 },
        ),
      ),
    );
    const { geminiAdapter } = await import("@/engines/gemini");
    const r = await geminiAdapter.run("x");
    expect(r.citations).toEqual([
      "https://yelp.com",
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/def",
    ]);
  });

  it("throws EngineError on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );
    const { geminiAdapter } = await import("@/engines/gemini");
    await expect(geminiAdapter.run("x")).rejects.toThrow(/gemini.*429/);
  });
});

describe("search queries", () => {
  const stub = (body: unknown) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));

  it("reads ChatGPT's web_search_call queries, de-duplicated", async () => {
    stub({ output: [
      { type: "web_search_call", action: { type: "search", query: "best med spa santa monica" } },
      { type: "web_search_call", action: { type: "search", queries: ["med spa reviews", "best med spa santa monica"] } },
      { type: "message", content: [{ text: "x", annotations: [] }] },
    ] });
    const { openaiAdapter } = await import("@/engines/openai");
    expect((await openaiAdapter.run("x")).searchQueries).toEqual(["best med spa santa monica", "med spa reviews"]);
  });

  it("reads Claude's web_search tool inputs", async () => {
    stub({ content: [
      { type: "server_tool_use", name: "web_search", input: { query: "glow medspa botox price" } },
      { type: "text", text: "x" },
    ] });
    const { anthropicAdapter } = await import("@/engines/anthropic");
    expect((await anthropicAdapter.run("x")).searchQueries).toEqual(["glow medspa botox price"]);
  });

  it("reads Gemini's webSearchQueries", async () => {
    stub({ candidates: [{ content: { parts: [{ text: "x" }] }, groundingMetadata: { webSearchQueries: ["med spa near me"] } }] });
    const { geminiAdapter } = await import("@/engines/gemini");
    expect((await geminiAdapter.run("x")).searchQueries).toEqual(["med spa near me"]);
  });
});

describe("grok adapter", () => {
  it("maps answer, annotated and top-level citations, and web and X searches", async () => {
    process.env.XAI_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output: [
        { type: "web_search_call", action: { query: "best med spa santa monica" } },
        { type: "x_search_call", action: { query: "glow medspa" } },
        { type: "message", content: [{ text: "Glow MedSpa is popular.", annotations: [
          { type: "url_citation", url: "https://yelp.com/biz/glow" },
        ] }] },
      ],
      citations: ["https://x.com/glow/status/1", "https://yelp.com/biz/glow"],
    }), { status: 200 })));
    const { grokAdapter } = await import("@/engines/grok");
    expect(await grokAdapter.run("x")).toEqual({
      answer: "Glow MedSpa is popular.",
      citations: ["https://yelp.com/biz/glow", "https://x.com/glow/status/1"],
      searchQueries: ["best med spa santa monica", "glow medspa"],
    });
  });

  it("throws EngineError on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("slow", { status: 429 })));
    const { grokAdapter } = await import("@/engines/grok");
    await expect(grokAdapter.run("x")).rejects.toThrow(/grok.*429/);
  });
});

describe("getAdapters", () => {
  it("adds Grok only when its key is set", async () => {
    const { getAdapters } = await import("@/engines");
    delete process.env.XAI_API_KEY;
    expect(getAdapters().map(a => a.name)).not.toContain("grok");
    process.env.XAI_API_KEY = "k";
    expect(getAdapters().map(a => a.name)).toContain("grok");
    delete process.env.XAI_API_KEY;
  });
});
