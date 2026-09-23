import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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

  // Trigger condition: this only throws when NODE_ENV is "production" AND
  // AUTH_URL is set. The latter is what distinguishes a real deployment
  // (which sets AUTH_URL per .env.example) from `next build`, which also
  // runs with NODE_ENV=production but never sets AUTH_URL. Without the
  // AUTH_URL gate, this guard would break every production build.
  // `vi.stubEnv` is used (rather than direct `process.env.NODE_ENV =`
  // assignment) because @types/node marks NODE_ENV read-only.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws in production when operator credentials are still the dev defaults", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_URL", "https://mirror.example.com");
    delete process.env.OPERATOR_EMAIL;
    delete process.env.OPERATOR_PASSWORD;

    const { loadEnv } = await import("@/lib/env");
    expect(() => loadEnv()).toThrow(/default operator credentials/);
  });

  it("does not throw in production when AUTH_URL is unset (e.g. `next build`)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.AUTH_URL;
    delete process.env.OPERATOR_EMAIL;
    delete process.env.OPERATOR_PASSWORD;

    const { loadEnv } = await import("@/lib/env");
    expect(() => loadEnv()).not.toThrow();
  });

  it("does not throw in production when real operator credentials are set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_URL", "https://mirror.example.com");
    vi.stubEnv("OPERATOR_EMAIL", "ops@realpractice.com");
    vi.stubEnv("OPERATOR_PASSWORD", "a-real-secret");

    const { loadEnv } = await import("@/lib/env");
    expect(() => loadEnv()).not.toThrow();
  });
});
