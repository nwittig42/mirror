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
  return parsed.data;
}
