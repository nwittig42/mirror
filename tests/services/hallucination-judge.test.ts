import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("hallucination-judge", () => {
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

  it("sends facts and answer, returns parsed findings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: `[{"claim":"Botox is $9/unit","factLabel":"Botox price","severity":"major"}]` }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { judgeAnswer } = await import("@/services/hallucination-judge");
    const findings = await judgeAnswer({
      answer: "At Glow MedSpa, Botox is $9/unit.",
      facts: [{ label: "Botox price", value: "$13/unit", category: "pricing" }],
    });
    expect(findings[0].severity).toBe("major");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("$13/unit");   // facts made it into the prompt
  });
});
