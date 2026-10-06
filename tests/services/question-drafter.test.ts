import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const reply = { category: "Med spa", location: "Austin, TX", questions: [{ text: "Best med spa in Austin?", kind: "category" }] };

// A fresh Response per call: a body can only be read once.
function stubDrafter() {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    content: [{ type: "text", text: JSON.stringify(reply) }],
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

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
    const fetchMock = stubDrafter();
    const { draftQuestionsFromPages } = await import("@/services/question-drafter");
    const out = await draftQuestionsFromPages({
      businessName: "Glow MedSpa",
      pages: [{ url: "https://glow.example", title: "Glow MedSpa Austin", text: "Botox and fillers in Austin, TX" }],
    });
    expect(out).toEqual(reply);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Glow MedSpa");
    expect(body.messages[0].content).toContain("Botox and fillers in Austin");
    // Told nothing about the business, it states nothing as fact.
    expect(body.messages[0].content).not.toContain("The business is");
  });

  it("states the lead's category and location as fact, right under the business name", async () => {
    const fetchMock = stubDrafter();
    const { draftQuestionsFromPages } = await import("@/services/question-drafter");
    await draftQuestionsFromPages({
      businessName: "Harbor Plumbing",
      pages: [{ url: "https://harbor.example", title: null, text: "Drain cleaning and water heaters" }],
      category: "Plumber", location: "Portland, OR",
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("BUSINESS: Harbor Plumbing\nThe business is a Plumber in Portland, OR.");
  });

  it("states only what it was told, and leaves the rest for the model to work out", async () => {
    const fetchMock = stubDrafter();
    const { draftQuestionsFromPages } = await import("@/services/question-drafter");
    await draftQuestionsFromPages({ businessName: "Rose City Bakery", pages: [], category: "Bakery", location: null });
    await draftQuestionsFromPages({ businessName: "Rose City Bakery", pages: [], category: "  ", location: "Portland, OR" });
    const first = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content;
    const second = JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content;
    expect(first).toContain("The business is a Bakery.");
    expect(first).not.toContain("null");
    expect(second).toContain("The business is in Portland, OR.");
    expect(second).not.toContain("The business is a");
    // Facts stay in the user turn; the instructions stay fixed across businesses.
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).system).toBe(JSON.parse(fetchMock.mock.calls[1][1].body).system);
  });

  it("asks for the three category shapes with examples from three trades, the same 5/3/2 split, and never a question about the reader's own location", async () => {
    const fetchMock = stubDrafter();
    const { draftQuestionsFromPages } = await import("@/services/question-drafter");
    await draftQuestionsFromPages({ businessName: "Harbor Plumbing", pages: [], category: "Plumber", location: "Portland, OR" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const system: string = body.system;
    expect(system).toContain('5 "category"');
    expect(system).toContain('3 "informational"');
    expect(system).toContain('2 "branded"');
    expect(system).toMatch(/names the city or area/i);
    expect(system).toMatch(/specific service/i);
    expect(system).toMatch(/comparison \("Who should I go to for .+ in .+\?"\)/i);
    for (const trade of ["plumber", "bakery", "med spa"]) expect(system.toLowerCase()).toContain(trade);
    expect(system).toMatch(/facts: use them as given/i);
    expect(`${system}\n${body.messages[0].content}`).not.toMatch(/near me/i);
    expect(system).toContain('"category|informational|branded"');
  });
});
