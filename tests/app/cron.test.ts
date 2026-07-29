import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import { runWeeklyScans } from "@/services/weekly-scan";
import type { EngineAdapter } from "@/engines/types";

const fakeAdapter = (name: string, answer: string): EngineAdapter =>
  ({ name: name as EngineAdapter["name"], run: async () => ({ answer, citations: ["https://x.example"] }) });

// Hoisted to the top of the module by Vitest regardless of where it's
// written (see the vi.mock docs), so it's placed here at top level to match
// actual execution order. Only the "runs the scan loop" test below relies on
// these — the route's own getAdapters()/judgeAnswer are replaced with fakes
// so the test never calls a real LLM vendor.
vi.mock("@/engines", () => ({
  getAdapters: () => [fakeAdapter("openai", "Glow MedSpa is great.")],
}));
vi.mock("@/services/hallucination-judge", () => ({
  judgeAnswer: async () => [],
}));

describe("runWeeklyScans", () => {
  it("scans every active practice, creates a scan row, and sends a pulse email per practice", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
    });

    const fakeSend = vi.fn().mockResolvedValue(undefined);
    const results = await runWeeklyScans(
      db,
      [fakeAdapter("openai", "Glow MedSpa is great.")],
      async () => [],
      fakeSend,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ practice: expect.any(String), score: expect.any(Number) });

    const scans = await db.select().from(schema.scans).where(eq(schema.scans.practiceId, practiceId));
    expect(scans).toHaveLength(1);
    expect(scans[0].status).toBe("complete");

    expect(fakeSend).toHaveBeenCalledTimes(1);
    expect(fakeSend).toHaveBeenCalledWith(db, practiceId);
  });

  it("a failing practice doesn't abort the loop for the others", async () => {
    const db = await makeTestDb();
    const { practiceId: okId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
    });
    await seedPractice(db, {
      name: "Skin Bar LA",
      prompts: [{ text: "Best med spa downtown", kind: "category" }],
    });

    const fakeSend = vi.fn().mockImplementation(async (_db, practiceId: string) => {
      // Fail the send for the second practice scanned; runScan itself always
      // succeeds here, so this exercises the "send fails, loop continues"
      // path distinctly from a scan failure.
      if (practiceId !== okId) throw new Error("send boom");
    });

    const results = await runWeeklyScans(
      db,
      [fakeAdapter("openai", "hello")],
      async () => [],
      fakeSend,
    );

    expect(results).toHaveLength(2);
    expect(results.some(r => "error" in r)).toBe(true);
    expect(results.some(r => "score" in r)).toBe(true);
    // Both practices still got a scan row created even though one send failed.
    const allScans = await db.select().from(schema.scans);
    expect(allScans).toHaveLength(2);
  });
});

describe("GET /api/cron/weekly-scan", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgres://x";
    process.env.OPENAI_API_KEY = "k";
    process.env.ANTHROPIC_API_KEY = "k";
    process.env.GEMINI_API_KEY = "k";
    process.env.PERPLEXITY_API_KEY = "k";
    process.env.RESEND_API_KEY = "k";
    process.env.CRON_SECRET = "the-secret";
    process.env.AUTH_SECRET = "s";
    process.env.APP_URL = "http://localhost:3000";
  });

  it("rejects a missing authorization header", async () => {
    const { GET } = await import("@/app/api/cron/weekly-scan/route");
    const res = await GET(new Request("http://localhost/api/cron/weekly-scan"));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("nope");
  });

  it("rejects a wrong bearer token", async () => {
    const { GET } = await import("@/app/api/cron/weekly-scan/route");
    const res = await GET(new Request("http://localhost/api/cron/weekly-scan", {
      headers: { authorization: "Bearer wrong" },
    }));
    expect(res.status).toBe(401);
  });

  it("runs the scan loop when the bearer token matches", async () => {
    // `beforeEach` calls vi.resetModules(), which invalidates the module
    // registry — a statically-imported "@/db" at file scope would be a
    // *different* module instance than the one the freshly-`import()`ed
    // route resolves, so `setDbForTests` wouldn't be visible to it. Both
    // sides are re-imported dynamically here to share the same instance.
    const { setDbForTests } = await import("@/db");
    const db = await makeTestDb();
    setDbForTests(db);
    await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
    });

    const { GET } = await import("@/app/api/cron/weekly-scan/route");
    const res = await GET(new Request("http://localhost/api/cron/weekly-scan", {
      headers: { authorization: "Bearer the-secret" },
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
  });
});
