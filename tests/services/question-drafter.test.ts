import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("draftQuestionsFromPages", () => {
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

  it("sends the business and its pages, and returns the parsed questions", async () => {
    const reply = { category: "Med spa", location: "Austin, TX", questions: [{ text: "Best med spa in Austin?", kind: "category" }] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: JSON.stringify(reply) }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { draftQuestionsFromPages } = await import("@/services/question-drafter");
    const out = await draftQuestionsFromPages({
      businessName: "Glow MedSpa",
      pages: [{ url: "https://glow.example", title: "Glow MedSpa Austin", text: "Botox and fillers in Austin, TX" }],
    });
    expect(out).toEqual(reply);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Glow MedSpa");
    expect(body.messages[0].content).toContain("Botox and fillers in Austin");
  });
});
