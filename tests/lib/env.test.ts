import { describe, it, expect, beforeEach, vi } from "vitest";

describe("env", () => {
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

  it("applies model defaults when unset", async () => {
    delete process.env.OPENAI_MODEL;
    const { loadEnv } = await import("@/lib/env");
    const env = loadEnv();
    expect(env.OPENAI_MODEL).toBe("gpt-5.1");
    expect(env.JUDGE_MODEL).toBe("claude-haiku-4-5-20251001");
    expect(env.NEXT_PUBLIC_APP_NAME).toBe("Mirror");
  });

  it("throws on missing required key", async () => {
    delete process.env.DATABASE_URL;
    const { loadEnv } = await import("@/lib/env");
    expect(() => loadEnv()).toThrow(/DATABASE_URL/);
  });
});
