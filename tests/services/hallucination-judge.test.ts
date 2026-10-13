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
    // A fresh Response each time: the judge is asked twice, and a body reads once.
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: `{"wrong":[{"claim":"Botox is $9/unit","factLabel":"Botox price","severity":"major"}],"right":[]}` }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { judgeAnswer } = await import("@/services/hallucination-judge");
    const verdict = await judgeAnswer({
      answer: "At Glow MedSpa, Botox is $9/unit.",
      facts: [{ label: "Botox price", value: "$13/unit", category: "pricing" }],
    });
    expect(verdict.wrong[0].severity).toBe("major");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("$13/unit");   // facts made it into the prompt
  });

  const facts = [
    { label: "Botox price", value: "$13/unit", category: "pricing" },
    { label: "Mobile app", value: "No mobile app yet", category: "not_offered" },
  ];
  const reply = (text: string) => new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
  const flagged = JSON.stringify({
    wrong: [
      { claim: "Botox is $9/unit", factLabel: "Botox price", why: "The sheet says $13; the answer says $9.", severity: "major" },
      { claim: "There is no app to download", factLabel: "Mobile app", why: "x", severity: "critical" },
      { claim: "They won a 2024 award", factLabel: null, severity: "minor" },
      { claim: "Open Sundays", factLabel: "Sunday hours", severity: "major" },
    ],
    right: ["Botox price"],
  });

  it("drops a claim it could not pin to a fact on the sheet, before asking for a second opinion", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(flagged)).mockResolvedValueOnce(reply(`["conflict","conflict"]`));
    vi.stubGlobal("fetch", fetchMock);
    const { judgeAnswer } = await import("@/services/hallucination-judge");
    const verdict = await judgeAnswer({ answer: "x", facts });
    expect(verdict.wrong.map(w => w.factLabel)).toEqual(["Botox price", "Mobile app"]);
    expect(verdict.right).toEqual(["Botox price"]);
    // The second opinion sees each claim next to its fact alone, not the answer or the rest of the sheet.
    const second = JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content;
    expect(second).toBe("1. FACT: $13/unit\n   CLAIM: Botox is $9/unit\n2. FACT: No mobile app yet\n   CLAIM: There is no app to download");
  });

  it("keeps only the claims the second opinion still calls a conflict", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(flagged)).mockResolvedValueOnce(reply(`["conflict","compatible"]`)));
    const { judgeAnswer } = await import("@/services/hallucination-judge");
    const verdict = await judgeAnswer({ answer: "x", facts });
    expect(verdict.wrong.map(w => w.claim)).toEqual(["Botox is $9/unit"]);
  });

  it("keeps every pinned claim when the second opinion can't be read, and skips it when nothing was flagged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(flagged)).mockResolvedValueOnce(reply("I think the first one conflicts.")));
    const { judgeAnswer } = await import("@/services/hallucination-judge");
    expect((await judgeAnswer({ answer: "x", facts })).wrong).toHaveLength(2);

    const clean = vi.fn().mockResolvedValue(reply(`{"wrong":[],"right":[]}`));
    vi.stubGlobal("fetch", clean);
    expect((await judgeAnswer({ answer: "x", facts })).wrong).toEqual([]);
    expect(clean).toHaveBeenCalledTimes(1);
  });
});
