import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("competitor-extractor", () => {
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
    process.env.JUDGE_MODEL = "claude-haiku-4-5-20251001";
  });

  afterEach(() => vi.unstubAllGlobals());

  it("sends the answer and returns the businesses named, in order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: `["Skin Bar LA", "Nuvo Aesthetics"]` }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { extractCompetitors } = await import("@/services/competitor-extractor");
    const names = await extractCompetitors({
      answer: "Try Skin Bar LA or Nuvo Aesthetics. Yelp lists both.",
      businessNames: ["Glow MedSpa"],
      knownCompetitors: ["Skin Bar LA"],
    });
    expect(names).toEqual(["Skin Bar LA", "Nuvo Aesthetics"]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
    expect(body.messages[0].content).toContain("Nuvo Aesthetics");   // the answer made it into the prompt
    expect(body.messages[0].content).toContain("Glow MedSpa");       // so the model knows whom to exclude
    expect(body.messages[0].content).toContain("KNOWN COMPETITORS:\nSkin Bar LA"); // and which spellings to reuse
  });

  it("throws on a non-2xx response instead of returning an empty list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    const { extractCompetitors } = await import("@/services/competitor-extractor");
    await expect(extractCompetitors({ answer: "x", businessNames: ["Glow MedSpa"], knownCompetitors: [] }))
      .rejects.toThrow(/extractor 429/);
  });
});
