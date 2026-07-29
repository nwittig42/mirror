import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  PERPLEXITY_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  // Pins Auth.js to a canonical URL (magic links, callback URLs) instead of
  // trusting the incoming request's Host header. See the README Security
  // section — trustHost: true in src/lib/auth.ts otherwise trusts Host.
  AUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url(),
  OPENAI_MODEL: z.string().default("gpt-5.1"),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  PERPLEXITY_MODEL: z.string().default("sonar-pro"),
  JUDGE_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Mirror"),
  EMAIL_FROM: z.string().default("onboarding@resend.dev"),
  OPERATOR_EMAIL: z.string().default("operator@example.com"),
  OPERATOR_PASSWORD: z.string().default("change-me-dev-only"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment: ${missing}`);
  }
  const env = parsed.data;

  // Refuses to boot with the dev-default operator credentials in production.
  // Gated on AUTH_URL being set (not just NODE_ENV === "production") because
  // `next build` itself runs with NODE_ENV=production — if this fired on
  // NODE_ENV alone it would break every production build. AUTH_URL is only
  // set by a real deployment (see the env var above and the README Security
  // section), so this only fires when loadEnv() runs at actual runtime
  // against a production deployment, never at build time.
  if (process.env.NODE_ENV === "production" && env.AUTH_URL) {
    if (env.OPERATOR_EMAIL === "operator@example.com" || env.OPERATOR_PASSWORD === "change-me-dev-only") {
      throw new Error(
        "Refusing to start in production with default operator credentials. " +
          "Set OPERATOR_EMAIL and OPERATOR_PASSWORD to real values.",
      );
    }
  }

  return env;
}
