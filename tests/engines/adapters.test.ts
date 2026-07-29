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
    });
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
