import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import { runWeeklyPulses } from "@/services/weekly-pulse";

describe("runWeeklyPulses", () => {
  beforeEach(() => {
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

  it("sends one pulse per active practice", async () => {
    const db = await makeTestDb();
    const { practiceId: a } = await seedPractice(db, { name: "Glow MedSpa" });
    const { practiceId: b } = await seedPractice(db, { name: "Skin Bar LA" });

    const send = vi.fn().mockResolvedValue(undefined);
    const results = await runWeeklyPulses(db, send);

    expect(results).toHaveLength(2);
    expect(send.mock.calls.map(c => c[1]).sort()).toEqual([a, b].sort());
  });

  it("skips inactive practices", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Churned Spa" });
    await db.update(schema.practices).set({ active: false });

    const send = vi.fn().mockResolvedValue(undefined);
    const results = await runWeeklyPulses(db, send);

    expect(results).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
    expect(practiceId).toBeTruthy();
  });

  it("one failing send doesn't stop the rest", async () => {
    const db = await makeTestDb();
    const { practiceId: ok } = await seedPractice(db, { name: "Glow MedSpa" });
    await seedPractice(db, { name: "Skin Bar LA" });

    const send = vi.fn().mockImplementation(async (_db, practiceId: string) => {
      if (practiceId !== ok) throw new Error("send boom");
    });
    const results = await runWeeklyPulses(db, send);

    expect(results).toHaveLength(2);
    expect(results.some(r => "error" in r)).toBe(true);
    expect(results.some(r => "sent" in r)).toBe(true);
  });
});

describe("GET /api/cron/weekly-pulse", () => {
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
    const { GET } = await import("@/app/api/cron/weekly-pulse/route");
    const res = await GET(new Request("http://localhost/api/cron/weekly-pulse"));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("nope");
  });

  it("rejects a wrong bearer token", async () => {
    const { GET } = await import("@/app/api/cron/weekly-pulse/route");
    const res = await GET(new Request("http://localhost/api/cron/weekly-pulse", {
      headers: { authorization: "Bearer wrong" },
    }));
    expect(res.status).toBe(401);
  });

  it("runs the pulse loop when the bearer token matches", async () => {
    const { setDbForTests } = await import("@/db");
    const db = await makeTestDb();
    setDbForTests(db);
    // No complete scan and no members, so sendPulse no-ops per practice; this
    // asserts the route is wired and authorized, not the email itself.
    await seedPractice(db, { name: "Glow MedSpa" });

    const { GET } = await import("@/app/api/cron/weekly-pulse/route");
    const res = await GET(new Request("http://localhost/api/cron/weekly-pulse", {
      headers: { authorization: "Bearer the-secret" },
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
  });
});
