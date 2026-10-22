import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import { runWeeklyScans, dispatchWeeklyScans, makeScanTrigger, staggerSeconds } from "@/services/weekly-scan";
import { EngineError } from "@/engines/types";
import type { EngineAdapter } from "@/engines/types";

const fakeAdapter = (name: string, answer: string): EngineAdapter =>
  ({ name: name as EngineAdapter["name"], run: async () => ({ answer, citations: ["https://x.example"] }) });

// Hoisted to the top of the module by Vitest regardless of where it's
// written (see the vi.mock docs), so it's placed here at top level to match
// actual execution order. Only the "runs the scan loop" test below relies on
// these. The route's own getAdapters()/judgeAnswer are replaced with fakes
// so the test never calls a real LLM vendor.
vi.mock("@/engines", () => ({
  getAdapters: () => [fakeAdapter("openai", "Glow MedSpa is great.")],
}));
vi.mock("@/services/hallucination-judge", () => ({
  judgeAnswer: async () => ({ wrong: [], right: [] }),
}));

describe("runWeeklyScans", () => {
  it("scans every active practice, creates a scan row, and offers each one to the alert sender", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
    });

    const fakeSend = vi.fn().mockResolvedValue(undefined);
    const results = await runWeeklyScans(
      db,
      [fakeAdapter("openai", "Glow MedSpa is great.")],
      async () => ({ wrong: [], right: [] }),
      async () => [],
      fakeSend,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ practice: expect.any(String), score: expect.any(Number) });

    const scans = await db.select().from(schema.scans).where(eq(schema.scans.practiceId, practiceId));
    expect(scans).toHaveLength(1);
    expect(scans[0].status).toBe("complete");

    expect(fakeSend).toHaveBeenCalledTimes(1);
    expect(fakeSend).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: practiceId, name: "Glow MedSpa" }),
      [],
    );
  });

  // The client-facing Pulse must not ride along with the scan; it runs on its
  // own cron the next morning so the operator has a window to fix what the
  // scan found. Guards against someone folding sendPulse back into this loop.
  it("does not send the client Pulse", async () => {
    const db = await makeTestDb();
    await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
    });

    const pulse = await import("@/services/pulse-email");
    const spy = vi.spyOn(pulse, "sendPulse");

    await runWeeklyScans(
      db,
      [fakeAdapter("openai", "Glow MedSpa is great.")],
      async () => ({ wrong: [], right: [] }),
      async () => [],
      vi.fn().mockResolvedValue(undefined),
    );

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("reports how many findings were alertable, not how many were opened", async () => {
    const db = await makeTestDb();
    await seedPractice(db, {
      name: "Glow MedSpa",
      facts: [{ label: "Botox price", value: "$14/unit", category: "pricing" }],
      prompts: [{ text: "How much is Botox at Glow MedSpa?", kind: "branded" }],
    });

    const results = await runWeeklyScans(
      db,
      [fakeAdapter("openai", "Glow MedSpa charges $9/unit and closes at 3pm.")],
      async () => ({ wrong: [
        { claim: "Botox is $9/unit", severity: "critical" as const, factLabel: "Botox price" },
        { claim: "Closes at 3pm", severity: "minor" as const, factLabel: null },
      ], right: [] }),
      async () => [],
      vi.fn().mockResolvedValue(undefined),
    );

    // Two findings opened, but only the critical one pages the operator.
    expect(results[0]).toMatchObject({ alerted: 1 });
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

    const fakeSend = vi.fn().mockImplementation(async (_db, practice: { id: string }) => {
      // Fail the send for the second practice scanned; runScan itself always
      // succeeds here, so this exercises the "send fails, loop continues"
      // path distinctly from a scan failure.
      if (practice.id !== okId) throw new Error("send boom");
    });

    const results = await runWeeklyScans(
      db,
      [fakeAdapter("openai", "hello")],
      async () => ({ wrong: [], right: [] }),
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
    // registry, because a statically-imported "@/db" at file scope would be a
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

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/cron/weekly-scan/route");
    const res = await GET(new Request("http://localhost/api/cron/weekly-scan", {
      headers: { authorization: "Bearer the-secret" },
    }));
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([expect.objectContaining({ dispatched: true })]);
    // One request per practice to the per-practice scan route, with the secret.
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^http:\/\/localhost:3000\/api\/cron\/scan-practice\?id=/);
    expect(init.headers.authorization).toBe("Bearer the-secret");
  });

  it("scan-practice rejects a bad token and an unknown practice", async () => {
    const { setDbForTests } = await import("@/db");
    setDbForTests(await makeTestDb());
    const { GET } = await import("@/app/api/cron/scan-practice/route");
    expect((await GET(new Request("http://localhost/api/cron/scan-practice?id=x"))).status).toBe(401);
    const res = await GET(new Request("http://localhost/api/cron/scan-practice?id=00000000-0000-0000-0000-000000000000", {
      headers: { authorization: "Bearer the-secret" },
    }));
    expect(res.status).toBe(404);
  });

  it("scan-step rejects a bad token and an unknown scan", async () => {
    const { setDbForTests } = await import("@/db");
    setDbForTests(await makeTestDb());
    const { GET } = await import("@/app/api/cron/scan-step/route");
    expect((await GET(new Request("http://localhost/api/cron/scan-step?scan=x&step=2"))).status).toBe(401);
    const res = await GET(new Request("http://localhost/api/cron/scan-step?scan=00000000-0000-0000-0000-000000000000&step=2", {
      headers: { authorization: "Bearer the-secret" },
    }));
    expect(res.status).toBe(404);
  });

  it("sends the blocked alert, not the findings alert, when a scan is blocked", async () => {
    const db = await makeTestDb();
    await seedPractice(db, { name: "Glow MedSpa", prompts: [{ text: "Best", kind: "category" }] });
    const down: EngineAdapter = { name: "openai", run: async () => { throw new EngineError("openai", 503, "down"); } };
    const send = vi.fn().mockResolvedValue(undefined);
    const sendBlocked = vi.fn().mockResolvedValue(undefined);
    const results = await runWeeklyScans(db, [down], async () => ({ wrong: [], right: [] }), async () => [], send,
      { retryDelaysMs: [], finalRetryDelayMs: 0 }, sendBlocked);
    expect(results[0]).toMatchObject({ blocked: true });
    expect(send).not.toHaveBeenCalled();
    expect(sendBlocked).toHaveBeenCalledTimes(1);
  });
});

describe("dispatchWeeklyScans", () => {
  it("starts one scan per active practice and keeps going past a failure", async () => {
    const db = await makeTestDb();
    const a = await seedPractice(db, { name: "Glow MedSpa" });
    const b = await seedPractice(db, { name: "Skin Bar LA" });
    const c = await seedPractice(db, { name: "Closed Spa" });
    await db.update(schema.practices).set({ active: false }).where(eq(schema.practices.id, c.practiceId));
    const started: string[] = [];
    const results = await dispatchWeeklyScans(db, async id => {
      started.push(id);
      if (id === a.practiceId) throw new Error("scan-practice 500");
    });
    expect(started.sort()).toEqual([a.practiceId, b.practiceId].sort());
    expect(results.find(r => !r.dispatched)?.error).toMatch(/500/);
    expect(results.filter(r => r.dispatched)).toHaveLength(1);
  });
});

describe("makeScanTrigger", () => {
  it("calls the per-practice route with the secret, a stagger, a timeout and the bypass header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const trigger = makeScanTrigger({ appUrl: "https://app.example/", cronSecret: "s3", bypassSecret: "bp", fetchImpl });
    await trigger("p-1", 2);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://app.example/api/cron/scan-practice?id=p-1&delay=${staggerSeconds(2)}`);
    expect(init.headers).toMatchObject({ authorization: "Bearer s3", "x-vercel-protection-bypass": "bp" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it("fails loudly on a non-2xx answer", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("no", { status: 401 }));
    const trigger = makeScanTrigger({ appUrl: "https://app.example", cronSecret: "s", fetchImpl });
    await expect(trigger("p", 0)).rejects.toThrow(/401/);
  });
  it("spreads starts out but keeps every scan inside its time budget", () => {
    expect(staggerSeconds(0)).toBe(0);
    expect(staggerSeconds(1)).toBeGreaterThan(0);
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => staggerSeconds(i)))).toBeLessThanOrEqual(60);
  });
});
