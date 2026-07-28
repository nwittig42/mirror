# Mirror — AI Visibility Platform for Aesthetic Practices (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the client-facing GEO monitoring platform for the LA med-spa service: fact-sheet ground truth, weekly citation scans across ChatGPT/Claude/Gemini/Perplexity, hallucination detection, an AI Visibility Score, a client dashboard, weekly pulse emails, and a printable monthly report.

**Architecture:** Next.js App Router monolith. Pure-function core (mention detection, position classification, scoring) fully unit-tested; engine adapters wrap the four vendor APIs behind one interface; a scan runner orchestrates prompts × engines into `checks`, runs the hallucination judge against the fact sheet, and snapshots a score per scan. Two roles: `operator` (you — full admin) and `client` (read-mostly dashboard scoped to their practice). Vercel cron triggers weekly scans; Resend sends magic links + pulse emails.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Drizzle ORM + Postgres (Neon in prod, PGlite in tests), Auth.js v5 (Resend magic links + operator credentials), Tailwind CSS, Recharts (trend chart), Resend (email), Vitest (tests), Zod (validation). Engine APIs: OpenAI Responses (`web_search` tool), Anthropic Messages (`web_search` tool), Google `@google/genai` (googleSearch grounding), Perplexity (`sonar-pro`).

## Global Constraints

- **Product working name: "Mirror"** (tagline: "See what AI tells your patients"). Used in the UI header, email from-name, and report header via `NEXT_PUBLIC_APP_NAME` env (default `"Mirror"`). The string "VentureCite" must never appear anywhere in code, UI, tests, or docs. Working name only — check trademark/domain before external branding.
- **ICP vocabulary (locked, client-facing copy):** the domain entity is a **practice** (never "brand" or "business"); readers of AI answers are **patients** (never "buyers"/"users"/"customers"); people at the practice are **providers**; offerings are **treatments**. Internal identifiers follow suit (`practices` table, `practiceId`, etc.).
- Node >= 20; TypeScript `strict: true`; no `any` in `src/core/**`.
- All business logic in `src/core/**` must be pure functions (no I/O) — this is the tested surface.
- Engine model IDs come from env with defaults: `OPENAI_MODEL=gpt-5.1`, `ANTHROPIC_MODEL=claude-sonnet-5`, `GEMINI_MODEL=gemini-2.5-flash`, `PERPLEXITY_MODEL=sonar-pro`, `JUDGE_MODEL=claude-haiku-4-5-20251001`. Never hardcode a model ID outside `src/lib/env.ts`.
- Score formula (locked, from strategy Doc 3): `score = round(100 × (0.50·citationRate + 0.20·positionQuality + 0.15·engineBreadth + 0.15·accuracy))`, then **cap at 70 if any OPEN critical finding exists**.
- Position weights (locked): first = 1.0, top3 = 0.7, mentioned = 0.4, absent = 0. Position is computed over `kind='category'` prompts only.
- Severity bands (locked): `critical` = credentials/safety/fabricated service; `major` = pricing/hours/location; `minor` = stale or incomplete detail.
- Every scan-visible number must trace to a stored `check` row. No estimated metrics anywhere in the UI. Copy rule: the UI never says "rank" or "ranking" — always "named / cited / shortlisted".
- Client role can never see: other practices, operator notes, raw API costs, prompt editing. Enforced server-side (queries filtered by `practice_members`), not just hidden in UI.
- Commits: conventional (`feat:`, `test:`, `chore:`); commit at the end of every task at minimum.
- Known limitation (document, don't fight): API answers approximate but do not exactly equal consumer app answers — same tradeoff every commercial GEO tool makes. README must state this.

## File Structure

```
geo-platform/
  src/
    core/                      # PURE logic — no I/O, fully unit-tested
      mention.ts               # practice/competitor mention detection
      position.ts              # first/top3/mentioned/absent classification
      scoring.ts               # score formula + component breakdown
      judge-parse.ts           # parse/validate judge JSON output
      types.ts                 # shared domain types (Engine, CheckResult, …)
    db/
      schema.ts                # Drizzle schema (all tables)
      index.ts                 # db client (Neon in prod, PGlite in test)
    engines/
      types.ts                 # EngineAdapter interface
      openai.ts  anthropic.ts  gemini.ts  perplexity.ts
      index.ts                 # adapter registry
    services/
      scan-runner.ts           # orchestrates a full practice scan
      hallucination-judge.ts   # LLM judge call (I/O) → core/judge-parse
      pulse-email.ts           # weekly email composition + send
      activity.ts              # activity log writer
    lib/
      env.ts                   # zod-validated env access
      auth.ts                  # Auth.js config (roles, magic links)
    app/
      login/page.tsx
      admin/page.tsx                       # operator: practice list
      admin/practices/[id]/page.tsx           # operator: facts, prompts, scan trigger, findings triage
      dashboard/[slug]/page.tsx            # client: command center
      dashboard/[slug]/answers/page.tsx    # client: verbatim answers per check
      dashboard/[slug]/accuracy/page.tsx   # client: findings ledger
      dashboard/[slug]/report/page.tsx     # client: printable monthly report
      api/cron/weekly-scan/route.ts        # Vercel cron target
    components/
      score-card.tsx  trend-chart.tsx  answer-card.tsx  finding-card.tsx
  scripts/
    seed.ts                    # demo practice + facts + prompts
    smoke-engines.ts           # manual live-API smoke test (real keys)
  tests/                       # mirrors src/ (vitest)
  drizzle/                     # generated migrations
  vercel.json                  # cron config
```

---

### Task 1: Scaffold project, tooling, env

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/lib/env.ts`, `.env.example`, `README.md`
- Test: `tests/lib/env.test.ts`

**Interfaces:**
- Produces: `env` object — `env.DATABASE_URL: string`, `env.OPENAI_API_KEY: string`, `env.OPENAI_MODEL: string` (default `"gpt-5.1"`), same pattern for ANTHROPIC/GEMINI/PERPLEXITY, `env.JUDGE_MODEL` (default `"claude-haiku-4-5-20251001"`), `env.RESEND_API_KEY`, `env.CRON_SECRET`, `env.AUTH_SECRET`, `env.APP_URL`.

- [ ] **Step 1: Scaffold**

```bash
cd ~/geo-platform
npx create-next-app@latest . --ts --tailwind --app --no-src-dir=false --import-alias "@/*" --use-npm
npm i drizzle-orm @neondatabase/serverless zod resend next-auth@beta @auth/drizzle-adapter recharts
npm i -D drizzle-kit vitest @vitest/coverage-v8 @electric-sql/pglite tsx
git init && git add -A && git commit -m "chore: scaffold next.js app"
```

- [ ] **Step 2: Write failing env test**

```ts
// tests/lib/env.test.ts
import { describe, it, expect, beforeEach } from "vitest";

describe("env", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://x";
    process.env.OPENAI_API_KEY = "k"; process.env.ANTHROPIC_API_KEY = "k";
    process.env.GEMINI_API_KEY = "k"; process.env.PERPLEXITY_API_KEY = "k";
    process.env.RESEND_API_KEY = "k"; process.env.CRON_SECRET = "s";
    process.env.AUTH_SECRET = "s"; process.env.APP_URL = "http://localhost:3000";
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
```

- [ ] **Step 3: Run test — expect FAIL** (`npx vitest run tests/lib/env.test.ts`; module not found)

- [ ] **Step 4: Implement `src/lib/env.ts`**

```ts
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
});

export type Env = z.infer<typeof schema>;
export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment: ${missing}`);
  }
  return parsed.data;
}
```

- [ ] **Step 5: Run test — expect PASS.** Write `.env.example` listing every key above with placeholder values, and a README section "Known limitation: API vs consumer answers" (one paragraph: scans call the four vendors' APIs with web search enabled; results closely track but do not exactly equal the consumer apps — the standard tradeoff all GEO monitoring tools make).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: env validation with model defaults"`

---

### Task 2: Domain types + Drizzle schema

**Files:**
- Create: `src/core/types.ts`, `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Produces (types used by every later task):

```ts
// src/core/types.ts
export type Engine = "openai" | "anthropic" | "gemini" | "perplexity";
export const ENGINES: Engine[] = ["openai", "anthropic", "gemini", "perplexity"];
export type PromptKind = "category" | "branded" | "informational";
export type Position = "first" | "top3" | "mentioned" | "absent";
export type Severity = "critical" | "major" | "minor";
export type FindingStatus = "open" | "fixed" | "verified" | "dismissed";
export interface EngineAnswer { answer: string; citations: string[] }
export interface CheckResult {
  engine: Engine; promptId: string; promptKind: PromptKind;
  answer: string; citations: string[];
  mentioned: boolean; position: Position; competitorsMentioned: string[];
}
```

- Produces tables: `users`, `practices`, `practiceMembers`, `nameVariations`, `competitors`, `facts`, `prompts`, `scans`, `checks`, `findings`, `activities` (+ Auth.js tables via adapter).

- [ ] **Step 1: Write failing schema round-trip test (PGlite)**

```ts
// tests/db/schema.test.ts
import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import { sql } from "drizzle-orm";

async function testDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  // push schema DDL directly for tests
  const { pushSchema } = await import("drizzle-kit/api");
  const { apply } = await pushSchema(schema, db as never);
  await apply();
  return db;
}

describe("schema", () => {
  it("stores a practice with facts, prompts, and a scan with checks", async () => {
    const db = await testDb();
    const [practice] = await db.insert(schema.practices)
      .values({ name: "Glow MedSpa", slug: "glow", website: "https://glow.example" }).returning();
    await db.insert(schema.facts).values({
      practiceId: practice.id, category: "pricing", label: "Botox price", value: "$13/unit", status: "active", source: "operator",
    });
    const [prompt] = await db.insert(schema.prompts)
      .values({ practiceId: practice.id, text: "Best med spa in Santa Monica for Botox", kind: "category", active: true }).returning();
    const [scan] = await db.insert(schema.scans)
      .values({ practiceId: practice.id, status: "running" }).returning();
    await db.insert(schema.checks).values({
      scanId: scan.id, promptId: prompt.id, engine: "perplexity",
      answerText: "…Glow MedSpa…", citations: ["https://yelp.com/biz/glow"],
      mentioned: true, position: "top3", competitorsMentioned: [],
    });
    const rows = await db.select().from(schema.checks);
    expect(rows).toHaveLength(1);
    expect(rows[0].citations).toEqual(["https://yelp.com/biz/glow"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (schema module missing)

- [ ] **Step 3: Implement `src/db/schema.ts`**

```ts
import { pgTable, text, uuid, timestamp, boolean, integer, jsonb, pgEnum, primaryKey } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["operator", "client"]);
export const factCategoryEnum = pgEnum("fact_category",
  ["identity", "providers", "services", "not_offered", "pricing", "logistics", "compliance"]);
export const promptKindEnum = pgEnum("prompt_kind", ["category", "branded", "informational"]);
export const engineEnum = pgEnum("engine", ["openai", "anthropic", "gemini", "perplexity"]);
export const positionEnum = pgEnum("position", ["first", "top3", "mentioned", "absent"]);
export const severityEnum = pgEnum("severity", ["critical", "major", "minor"]);
export const findingStatusEnum = pgEnum("finding_status", ["open", "fixed", "verified", "dismissed"]);
export const scanStatusEnum = pgEnum("scan_status", ["running", "complete", "failed"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: roleEnum("role").notNull().default("client"),
  emailVerified: timestamp("email_verified"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const practices = pgTable("practices", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  website: text("website"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const practiceMembers = pgTable("practice_members", {
  userId: uuid("user_id").notNull().references(() => users.id),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
}, t => [primaryKey({ columns: [t.userId, t.practiceId] })]);

export const nameVariations = pgTable("name_variations", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  text: text("text").notNull(),
});

export const competitors = pgTable("competitors", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  name: text("name").notNull(),
});

export const facts = pgTable("facts", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  category: factCategoryEnum("category").notNull(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  status: text("status").notNull().default("active"), // 'active' | 'archived'
  source: text("source").notNull().default("operator"), // 'operator' | 'client'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const prompts = pgTable("prompts", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  text: text("text").notNull(),
  kind: promptKindEnum("kind").notNull(),
  active: boolean("active").notNull().default(true),
});

export const scans = pgTable("scans", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  status: scanStatusEnum("status").notNull().default("running"),
  score: integer("score"),
  citationRate: integer("citation_rate"),      // stored as 0-100
  positionScore: integer("position_score"),    // 0-100
  breadthScore: integer("breadth_score"),      // 0-100
  accuracyScore: integer("accuracy_score"),    // 0-100
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
});

export const checks = pgTable("checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  scanId: uuid("scan_id").notNull().references(() => scans.id),
  promptId: uuid("prompt_id").notNull().references(() => prompts.id),
  engine: engineEnum("engine").notNull(),
  answerText: text("answer_text").notNull(),
  citations: jsonb("citations").$type<string[]>().notNull().default([]),
  mentioned: boolean("mentioned").notNull(),
  position: positionEnum("position").notNull(),
  competitorsMentioned: jsonb("competitors_mentioned").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const findings = pgTable("findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  checkId: uuid("check_id").notNull().references(() => checks.id),
  factId: uuid("fact_id").references(() => facts.id),
  claim: text("claim").notNull(),
  factValue: text("fact_value"),
  severity: severityEnum("severity").notNull(),
  status: findingStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Also create `src/core/types.ts` exactly as in the Interfaces block, `src/db/index.ts` (Neon client via `drizzle-orm/neon-http` using `loadEnv().DATABASE_URL`), and `drizzle.config.ts` pointing at `src/db/schema.ts`, out dir `drizzle/`.

- [ ] **Step 4: Run — expect PASS.** Then `npx drizzle-kit generate` to produce the initial migration.

- [ ] **Step 5: Commit** — `feat: domain types and database schema`

---

### Task 3: Mention detection (`src/core/mention.ts`)

**Files:** Create `src/core/mention.ts`; Test `tests/core/mention.test.ts`

**Interfaces:**
- Produces: `detectMention(answer: string, variations: string[]): boolean` and `detectNames(answer: string, names: string[]): string[]` (returns which of `names` appear, order of first appearance).

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { detectMention, detectNames } from "@/core/mention";

describe("detectMention", () => {
  it("matches case-insensitively", () =>
    expect(detectMention("I recommend GLOW medspa.", ["Glow MedSpa"])).toBe(true));
  it("matches any variation", () =>
    expect(detectMention("Dr. Kim's clinic is popular", ["Glow MedSpa", "Dr. Kim"])).toBe(true));
  it("requires word boundaries (no substring false positives)", () =>
    expect(detectMention("The glowing reviews mention nothing", ["Glow"])).toBe(false));
  it("tolerates punctuation and possessives", () =>
    expect(detectMention("Try Glow MedSpa's injectors.", ["Glow MedSpa"])).toBe(true));
  it("handles markdown bold", () =>
    expect(detectMention("1. **Glow MedSpa** – Santa Monica", ["Glow MedSpa"])).toBe(true));
});

describe("detectNames", () => {
  it("returns names in order of first appearance", () =>
    expect(detectNames("B Clinic is great; A Spa is fine too", ["A Spa", "B Clinic", "C Derm"]))
      .toEqual(["B Clinic", "A Spa"]));
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/core/mention.ts
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function firstIndexOf(answer: string, name: string): number {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(name)}(?![\\p{L}\\p{N}])`, "iu");
  const m = pattern.exec(answer);
  return m ? m.index : -1;
}
export function detectMention(answer: string, variations: string[]): boolean {
  return variations.some(v => firstIndexOf(answer, v) !== -1);
}
export function detectNames(answer: string, names: string[]): string[] {
  return names
    .map(n => ({ n, i: firstIndexOf(answer, n) }))
    .filter(x => x.i !== -1)
    .sort((a, b) => a.i - b.i)
    .map(x => x.n);
}
```

- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** — `feat: mention and name detection`

---

### Task 4: Position classification (`src/core/position.ts`)

**Files:** Create `src/core/position.ts`; Test `tests/core/position.test.ts`

**Interfaces:**
- Consumes: `detectNames` from Task 3.
- Produces: `classifyPosition(answer: string, practiceVariations: string[], competitorNames: string[]): { position: Position; competitorsMentioned: string[] }`. Rule: absent if practice not mentioned; among all mentioned entities (practice counts once, at its earliest variation hit) ordered by first appearance — practice index 0 → `first`, index ≤ 2 → `top3`, else `mentioned`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { classifyPosition } from "@/core/position";

const practiceNames = ["Glow MedSpa", "Glow"];
const comps = ["Lumière Aesthetics", "Skin Bar LA", "Derm House"];

describe("classifyPosition", () => {
  it("absent when practice missing", () => {
    const r = classifyPosition("Try Skin Bar LA or Derm House.", practiceNames, comps);
    expect(r.position).toBe("absent");
    expect(r.competitorsMentioned).toEqual(["Skin Bar LA", "Derm House"]);
  });
  it("first when practice appears before all competitors", () =>
    expect(classifyPosition("Glow MedSpa leads; Derm House follows.", practiceNames, comps).position).toBe("first"));
  it("top3 when practice is 2nd or 3rd entity", () =>
    expect(classifyPosition("Skin Bar LA, then Glow MedSpa, then Derm House.", practiceNames, comps).position).toBe("top3"));
  it("mentioned when practice is 4th+", () =>
    expect(classifyPosition("Skin Bar LA, Derm House, Lumière Aesthetics, and Glow MedSpa.", practiceNames, comps).position).toBe("mentioned"));
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/core/position.ts
import { detectNames } from "@/core/mention";
import type { Position } from "@/core/types";

export function classifyPosition(
  answer: string, practiceVariations: string[], competitorNames: string[],
): { position: Position; competitorsMentioned: string[] } {
  const competitorsMentioned = detectNames(answer, competitorNames);
  const ordered = detectNames(answer, [...practiceVariations, ...competitorNames]);
  // collapse practice-name variations into one entity at earliest hit
  const entities: string[] = [];
  let practiceSeen = false;
  for (const name of ordered) {
    if (practiceVariations.includes(name)) {
      if (!practiceSeen) { entities.push("__PRACTICE__"); practiceSeen = true; }
    } else if (!entities.includes(name)) entities.push(name);
  }
  const idx = entities.indexOf("__PRACTICE__");
  const position: Position = idx === -1 ? "absent" : idx === 0 ? "first" : idx <= 2 ? "top3" : "mentioned";
  return { position, competitorsMentioned };
}
```

- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** — `feat: position classification`

---

### Task 5: Scoring (`src/core/scoring.ts`)

**Files:** Create `src/core/scoring.ts`; Test `tests/core/scoring.test.ts`

**Interfaces:**
- Consumes: `CheckResult`, `Severity`, `FindingStatus` from `core/types`.
- Produces:

```ts
export interface ScoreInput {
  checks: Pick<CheckResult, "engine" | "promptKind" | "mentioned" | "position">[];
  openFindings: { severity: Severity }[];   // findings with status 'open' only
  brandedCheckCount: number;                // checks on kind='branded' prompts
  brandedChecksWithFinding: number;         // of those, how many produced an open critical/major finding
}
export interface ScoreBreakdown {
  score: number; citationRate: number; positionQuality: number;
  engineBreadth: number; accuracy: number; capped: boolean;  // all components 0-1, score 0-100
}
export function computeScore(input: ScoreInput): ScoreBreakdown;
```

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { computeScore } from "@/core/scoring";
import type { ScoreInput } from "@/core/scoring";

const check = (engine: string, kind: string, mentioned: boolean, position: string) =>
  ({ engine, promptKind: kind, mentioned, position }) as ScoreInput["checks"][number];

describe("computeScore", () => {
  it("zero everything → 0", () => {
    const r = computeScore({ checks: [check("openai", "category", false, "absent")],
      openFindings: [], brandedCheckCount: 0, brandedChecksWithFinding: 0 });
    expect(r.score).toBe(0);
  });
  it("perfect single-engine run is held back by breadth", () => {
    const r = computeScore({
      checks: [check("perplexity", "category", true, "first")],
      openFindings: [], brandedCheckCount: 0, brandedChecksWithFinding: 0 });
    // cr=1, pos=1, breadth=0.25, accuracy defaults to 1 when no branded checks
    expect(r.score).toBe(Math.round(100 * (0.5 + 0.2 + 0.15 * 0.25 + 0.15)));
  });
  it("caps at 70 with an open critical finding", () => {
    const r = computeScore({
      checks: ["openai", "anthropic", "gemini", "perplexity"].map(e => check(e, "category", true, "first")),
      openFindings: [{ severity: "critical" }], brandedCheckCount: 4, brandedChecksWithFinding: 1 });
    expect(r.capped).toBe(true);
    expect(r.score).toBe(70);
  });
  it("position quality only counts category prompts", () => {
    const r = computeScore({
      checks: [check("openai", "branded", true, "first"), check("openai", "category", true, "mentioned")],
      openFindings: [], brandedCheckCount: 1, brandedChecksWithFinding: 0 });
    expect(r.positionQuality).toBeCloseTo(0.4);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/core/scoring.ts
import type { CheckResult, Severity } from "@/core/types";

export interface ScoreInput { /* exactly as in Interfaces block */
  checks: Pick<CheckResult, "engine" | "promptKind" | "mentioned" | "position">[];
  openFindings: { severity: Severity }[];
  brandedCheckCount: number;
  brandedChecksWithFinding: number;
}
export interface ScoreBreakdown {
  score: number; citationRate: number; positionQuality: number;
  engineBreadth: number; accuracy: number; capped: boolean;
}

const POSITION_WEIGHT: Record<string, number> = { first: 1, top3: 0.7, mentioned: 0.4, absent: 0 };

export function computeScore(input: ScoreInput): ScoreBreakdown {
  const { checks } = input;
  const citationRate = checks.length ? checks.filter(c => c.mentioned).length / checks.length : 0;
  const category = checks.filter(c => c.promptKind === "category");
  const positionQuality = category.length
    ? category.reduce((s, c) => s + POSITION_WEIGHT[c.position], 0) / category.length : 0;
  const enginesWithMention = new Set(checks.filter(c => c.mentioned).map(c => c.engine));
  const engineBreadth = enginesWithMention.size / 4;
  const accuracy = input.brandedCheckCount
    ? 1 - input.brandedChecksWithFinding / input.brandedCheckCount : 1;
  let score = Math.round(100 * (0.5 * citationRate + 0.2 * positionQuality + 0.15 * engineBreadth + 0.15 * accuracy));
  const capped = input.openFindings.some(f => f.severity === "critical") && score > 70;
  if (capped) score = 70;
  return { score, citationRate, positionQuality, engineBreadth, accuracy, capped };
}
```

- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** — `feat: visibility score formula with accuracy cap`

---

### Task 6: Judge output parsing (`src/core/judge-parse.ts`)

**Files:** Create `src/core/judge-parse.ts`; Test `tests/core/judge-parse.test.ts`

**Interfaces:**
- Produces: `parseJudgeOutput(raw: string): JudgeFinding[]` where `JudgeFinding = { claim: string; factLabel: string | null; severity: Severity }`. Tolerant of the model wrapping JSON in prose/code fences; throws `JudgeParseError` on unrecoverable output.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { parseJudgeOutput, JudgeParseError } from "@/core/judge-parse";

describe("parseJudgeOutput", () => {
  it("parses a clean JSON array", () => {
    const raw = `[{"claim":"Botox costs $9/unit","factLabel":"Botox price","severity":"major"}]`;
    expect(parseJudgeOutput(raw)).toEqual([
      { claim: "Botox costs $9/unit", factLabel: "Botox price", severity: "major" }]);
  });
  it("strips code fences and surrounding prose", () => {
    const raw = "Here are the contradictions:\n```json\n[{\"claim\":\"x\",\"factLabel\":null,\"severity\":\"critical\"}]\n```";
    expect(parseJudgeOutput(raw)).toHaveLength(1);
  });
  it("returns [] for the literal empty array", () =>
    expect(parseJudgeOutput("[]")).toEqual([]));
  it("rejects invalid severities", () =>
    expect(() => parseJudgeOutput(`[{"claim":"x","factLabel":null,"severity":"huge"}]`))
      .toThrow(JudgeParseError));
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/core/judge-parse.ts
import { z } from "zod";
import type { Severity } from "@/core/types";

export class JudgeParseError extends Error {}
export interface JudgeFinding { claim: string; factLabel: string | null; severity: Severity }

const findingSchema = z.array(z.object({
  claim: z.string().min(1),
  factLabel: z.string().nullable(),
  severity: z.enum(["critical", "major", "minor"]),
}));

export function parseJudgeOutput(raw: string): JudgeFinding[] {
  const match = raw.match(/\[[\s\S]*\]/);   // grab outermost JSON array
  if (!match) throw new JudgeParseError(`No JSON array in judge output: ${raw.slice(0, 200)}`);
  let data: unknown;
  try { data = JSON.parse(match[0]); }
  catch { throw new JudgeParseError("Judge output is not valid JSON"); }
  const parsed = findingSchema.safeParse(data);
  if (!parsed.success) throw new JudgeParseError(parsed.error.message);
  return parsed.data;
}
```

- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** — `feat: judge output parser`

---

### Task 7: Engine adapters (4 engines, one interface)

**Files:**
- Create: `src/engines/types.ts`, `src/engines/openai.ts`, `src/engines/anthropic.ts`, `src/engines/gemini.ts`, `src/engines/perplexity.ts`, `src/engines/index.ts`, `scripts/smoke-engines.ts`
- Test: `tests/engines/adapters.test.ts` (response-shape mapping only, mocked fetch)

**Interfaces:**
- Produces:

```ts
// src/engines/types.ts
import type { Engine, EngineAnswer } from "@/core/types";
export interface EngineAdapter { name: Engine; run(prompt: string): Promise<EngineAnswer> }
// src/engines/index.ts
export function getAdapters(): EngineAdapter[]  // all four, order: openai, anthropic, gemini, perplexity
```

All adapters use raw `fetch` (no SDKs — keeps mapping explicit and mockable). Each maps the vendor response to `{ answer, citations }`. On HTTP error, throw `EngineError(engine, status, bodySnippet)`.

- [ ] **Step 1: Failing mapping tests** — mock `fetch` per adapter with a captured real response shape:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("perplexity adapter", () => {
  it("maps answer and citations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "Glow MedSpa is popular." } }],
      citations: ["https://yelp.com/biz/glow"],
    }), { status: 200 })));
    const { perplexityAdapter } = await import("@/engines/perplexity");
    const r = await perplexityAdapter.run("best med spa santa monica");
    expect(r).toEqual({ answer: "Glow MedSpa is popular.", citations: ["https://yelp.com/biz/glow"] });
  });
  it("throws EngineError on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    const { perplexityAdapter } = await import("@/engines/perplexity");
    await expect(perplexityAdapter.run("x")).rejects.toThrow(/perplexity.*429/);
  });
});
// Repeat the same two-test pattern for openai (Responses API: output array →
// find type==="message" → content[0].text; annotations type==="url_citation" → url),
// anthropic (content blocks; web_search citations in content[].citations[].url),
// gemini (candidates[0].content.parts[].text joined; groundingMetadata.groundingChunks[].web.uri).
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement the four adapters.** Reference request bodies (verify against current vendor docs at implementation time — they drift):

```ts
// src/engines/perplexity.ts
import { loadEnv } from "@/lib/env";
import type { EngineAdapter } from "@/engines/types";
import { EngineError } from "@/engines/types";

export const perplexityAdapter: EngineAdapter = {
  name: "perplexity",
  async run(prompt) {
    const env = loadEnv();
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.PERPLEXITY_MODEL,
        messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new EngineError("perplexity", res.status, await res.text());
    const data = await res.json();
    return { answer: data.choices?.[0]?.message?.content ?? "",
             citations: data.citations ?? [] };
  },
};
```

```ts
// src/engines/openai.ts — POST https://api.openai.com/v1/responses
// body: { model: env.OPENAI_MODEL, tools: [{ type: "web_search" }], input: prompt }
// answer: data.output.find(o => o.type === "message")?.content?.[0]?.text ?? ""
// citations: that content[0].annotations?.filter(a => a.type === "url_citation").map(a => a.url) ?? []

// src/engines/anthropic.ts — POST https://api.anthropic.com/v1/messages
// headers: x-api-key, anthropic-version: "2023-06-01"
// body: { model: env.ANTHROPIC_MODEL, max_tokens: 1500,
//   tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
//   messages: [{ role: "user", content: prompt }] }
// answer: data.content.filter(b => b.type === "text").map(b => b.text).join("")
// citations: unique data.content.flatMap(b => (b.citations ?? []).map(c => c.url)).filter(Boolean)

// src/engines/gemini.ts — POST
// https://generativelanguage.googleapis.com/v1beta/models/{env.GEMINI_MODEL}:generateContent?key={env.GEMINI_API_KEY}
// body: { contents: [{ parts: [{ text: prompt }] }], tools: [{ googleSearch: {} }] }
// answer: data.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ?? ""
// citations: data.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web?.uri).filter(Boolean) ?? []
```

Each of those three follows the perplexity file's full structure (env load, fetch, `if (!res.ok) throw new EngineError(...)`, mapping). `EngineError` lives in `src/engines/types.ts`:

```ts
export class EngineError extends Error {
  constructor(public engine: string, public status: number, body: string) {
    super(`${engine} ${status}: ${body.slice(0, 300)}`);
  }
}
```

- [ ] **Step 4: Run mapping tests — PASS.**

- [ ] **Step 5: Write `scripts/smoke-engines.ts`** — iterates `getAdapters()`, runs one live prompt ("best med spa in Santa Monica for Botox"), prints engine name, first 200 chars, citation count. Run manually with real keys: `npx tsx scripts/smoke-engines.ts`. This is the ground-truth check on response shapes; fix any mapping drift found. Do not wire into CI.

- [ ] **Step 6: Commit** — `feat: four engine adapters with unified interface`

---

### Task 8: Hallucination judge service

**Files:** Create `src/services/hallucination-judge.ts`; Test `tests/services/hallucination-judge.test.ts`

**Interfaces:**
- Consumes: `parseJudgeOutput` (Task 6), `loadEnv` (Task 1).
- Produces: `judgeAnswer(args: { answer: string; facts: { label: string; value: string; category: string }[] }): Promise<JudgeFinding[]>`. Only runs meaningfully on branded-prompt answers (caller's responsibility). Uses the Anthropic Messages API with `env.JUDGE_MODEL`.

- [ ] **Step 1: Failing test (mocked fetch)**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
afterEach(() => vi.unstubAllGlobals());

it("sends facts and answer, returns parsed findings", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    content: [{ type: "text", text: `[{"claim":"Botox is $9/unit","factLabel":"Botox price","severity":"major"}]` }],
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const { judgeAnswer } = await import("@/services/hallucination-judge");
  const findings = await judgeAnswer({
    answer: "At Glow MedSpa, Botox is $9/unit.",
    facts: [{ label: "Botox price", value: "$13/unit", category: "pricing" }],
  });
  expect(findings[0].severity).toBe("major");
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.messages[0].content).toContain("$13/unit");   // facts made it into the prompt
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement.** The judge prompt is the product-critical artifact — use exactly this:

```ts
// src/services/hallucination-judge.ts
import { loadEnv } from "@/lib/env";
import { parseJudgeOutput, type JudgeFinding } from "@/core/judge-parse";

const JUDGE_SYSTEM = `You are an accuracy auditor for a medical aesthetics practice.
You receive (1) a FACT SHEET of verified facts about the practice and (2) an AI-generated ANSWER about the practice.
Identify every claim in the ANSWER that CONTRADICTS a fact sheet entry, or asserts a service/credential/price the fact sheet's "not_offered" or other entries rule out.
Do NOT flag: omissions, vague marketing language, information absent from the fact sheet, or subjective opinions.
Severity rules: "critical" = provider credentials, medical safety, or a service the practice does not offer; "major" = pricing, hours, or location errors; "minor" = stale or imprecise detail.
Output ONLY a JSON array (no prose): [{"claim": "<verbatim or tightly paraphrased claim from the ANSWER>", "factLabel": "<label of the contradicted fact, or null>", "severity": "critical|major|minor"}]
If there are no contradictions output [].`;

export async function judgeAnswer(args: {
  answer: string;
  facts: { label: string; value: string; category: string }[];
}): Promise<JudgeFinding[]> {
  const env = loadEnv();
  const factSheet = args.facts.map(f => `- [${f.category}] ${f.label}: ${f.value}`).join("\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
      "content-type": "application/json" },
    body: JSON.stringify({
      model: env.JUDGE_MODEL, max_tokens: 1000, system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: `FACT SHEET:\n${factSheet}\n\nANSWER:\n${args.answer}` }],
    }),
  });
  if (!res.ok) throw new Error(`judge ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("");
  return parseJudgeOutput(text);
}
```

- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** — `feat: hallucination judge with locked audit prompt`

---

### Task 9: Scan runner

**Files:** Create `src/services/scan-runner.ts`; Test `tests/services/scan-runner.test.ts`

**Interfaces:**
- Consumes: adapters (`EngineAdapter[]`), `classifyPosition`, `detectMention`, `computeScore`, `judgeAnswer`, db + schema.
- Produces: `runScan(db: Db, practiceId: string, adapters: EngineAdapter[], judge: typeof judgeAnswer): Promise<{ scanId: string; score: number }>`. Adapters and judge are injected — tests pass fakes; production callers pass `getAdapters()` and `judgeAnswer`.

Behavior spec:
1. Create `scans` row (status `running`).
2. Load active prompts, name variations (practice name always included), competitors, active facts.
3. For each prompt × each adapter (sequentially per engine to respect rate limits; engines in parallel with `Promise.allSettled`): call `run()`, then `detectMention` + `classifyPosition`, insert `checks` row. A rejected engine call inserts nothing and is recorded in the activity log as `"scan warning: <engine> failed on prompt <text>"` — a partial scan is still a scan.
4. For every check on a `branded` prompt that has `answerText`, call the judge; insert `findings` rows (status `open`), deduplicating: skip insert if an `open` finding with the same `claim` already exists for the practice.
5. Compute `computeScore` over this scan's checks + the practice's open findings; update the `scans` row (status `complete`, component scores stored ×100 as integers, `finishedAt`).
6. Write activity: `"Weekly scan complete — score N (M/K checks cited)"`.

- [ ] **Step 1: Failing integration test (PGlite + fake adapters + fake judge)**

```ts
import { describe, it, expect } from "vitest";
// setup helper reused from tests/db/schema.test.ts — extract to tests/helpers/db.ts in this task
import { makeTestDb, seedPractice } from "../helpers/db";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";

const fakeAdapter = (name: string, answer: string): EngineAdapter =>
  ({ name: name as EngineAdapter["name"], run: async () => ({ answer, citations: ["https://x.example"] }) });

it("runs a full scan, stores checks and findings, snapshots score", async () => {
  const db = await makeTestDb();
  const { practiceId } = await seedPractice(db, {
    name: "Glow MedSpa",
    prompts: [
      { text: "Best med spa in Santa Monica for Botox", kind: "category" },
      { text: "How much does Botox cost at Glow MedSpa?", kind: "branded" },
    ],
    facts: [{ category: "pricing", label: "Botox price", value: "$13/unit" }],
    competitors: ["Skin Bar LA"],
  });
  const adapters = [
    fakeAdapter("openai", "Skin Bar LA and Glow MedSpa are both good. Botox at Glow MedSpa is $9/unit."),
    fakeAdapter("perplexity", "Glow MedSpa tops the list."),
  ];
  const fakeJudge = async () =>
    [{ claim: "Botox at Glow MedSpa is $9/unit", factLabel: "Botox price", severity: "major" as const }];
  const { scanId, score } = await runScan(db, practiceId, adapters, fakeJudge);
  const checks = await db.query.checks.findMany();
  expect(checks).toHaveLength(4);                       // 2 prompts × 2 adapters
  const findings = await db.query.findings.findMany();
  expect(findings.length).toBeGreaterThanOrEqual(1);    // judge fired on branded checks
  expect(findings[0].status).toBe("open");
  expect(score).toBeGreaterThan(0);
  const scan = await db.query.scans.findFirst();
  expect(scan?.status).toBe("complete");
});

it("survives one engine failing", async () => {
  const db = await makeTestDb();
  const { practiceId } = await seedPractice(db, { name: "Glow MedSpa",
    prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }], facts: [], competitors: [] });
  const failing: EngineAdapter = { name: "gemini", run: async () => { throw new Error("boom"); } };
  const { score } = await runScan(db, practiceId, [fakeAdapter("openai", "Glow MedSpa"), failing], async () => []);
  expect((await db.query.checks.findMany())).toHaveLength(1);
  expect(score).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Extract `tests/helpers/db.ts`** (`makeTestDb` = the PGlite+pushSchema helper from Task 2; `seedPractice` inserts practice, name variation = practice name, prompts, facts, competitors and returns ids). Run tests — FAIL.

- [ ] **Step 3: Implement `runScan` exactly per the behavior spec above.** Shape:

```ts
export async function runScan(db: Db, practiceId: string, adapters: EngineAdapter[],
  judge: (args: { answer: string; facts: FactRow[] }) => Promise<JudgeFinding[]>) {
  const [scan] = await db.insert(scans).values({ practiceId }).returning();
  const [promptRows, variations, comps, factRows] = await Promise.all([/* queries */]);
  const practiceNames = [practice.name, ...variations.map(v => v.text)];
  for (const prompt of promptRows) {
    const settled = await Promise.allSettled(adapters.map(a => a.run(prompt.text)));
    for (let i = 0; i < adapters.length; i++) {
      const s = settled[i];
      if (s.status === "rejected") { await logActivity(db, practiceId, `scan warning: ${adapters[i].name} failed`); continue; }
      const { position, competitorsMentioned } = classifyPosition(s.value.answer, practiceNames, comps.map(c => c.name));
      await db.insert(checks).values({ scanId: scan.id, promptId: prompt.id, engine: adapters[i].name,
        answerText: s.value.answer, citations: s.value.citations,
        mentioned: detectMention(s.value.answer, practiceNames), position, competitorsMentioned });
    }
  }
  // judge branded checks → insert deduped open findings → computeScore → update scan row → activity
}
```

(Implementer: complete the elided queries and the judge/score/update blocks per the behavior spec — every referenced function already exists from Tasks 3–8.)

- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** — `feat: scan runner orchestration`

---

### Task 10: Auth + role-guarded routing

**Files:**
- Create: `src/lib/auth.ts`, `src/app/login/page.tsx`, `src/middleware.ts`, `src/app/api/auth/[...nextauth]/route.ts`
- Test: `tests/lib/authz.test.ts`

**Interfaces:**
- Produces: `auth()` session helper (Auth.js v5); session user carries `{ id, email, role }`. `requireOperator()` and `requirePracticeAccess(slug)` server helpers in `src/lib/auth.ts` — every admin page calls the first, every dashboard page calls the second. `requirePracticeAccess` returns the practice row if the user is operator OR a `practice_members` row links them; otherwise `notFound()`.

- [ ] **Step 1: Failing test for the pure authorization rule**

```ts
import { describe, it, expect } from "vitest";
import { canAccessPractice } from "@/lib/auth";

describe("canAccessPractice", () => {
  it("operator sees everything", () =>
    expect(canAccessPractice({ role: "operator", memberPracticeIds: [] }, "b1")).toBe(true));
  it("client sees only member practices", () => {
    expect(canAccessPractice({ role: "client", memberPracticeIds: ["b1"] }, "b1")).toBe(true);
    expect(canAccessPractice({ role: "client", memberPracticeIds: ["b1"] }, "b2")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — FAIL.**  **Step 3: Implement** `canAccessPractice` (pure), then Auth.js config: Resend email provider (magic links — clients), Credentials provider checking `OPERATOR_EMAIL`/`OPERATOR_PASSWORD_HASH` env (add both to `env.ts` as optional with defaults for dev), Drizzle adapter, `session.user.role` from `users.role`. `middleware.ts`: redirect unauthenticated to `/login`; `/admin/**` additionally requires `role === "operator"`. Login page: email field → magic link, plus operator password form.

- [ ] **Step 4: Tests PASS + manual check** — `npm run dev`, log in as operator, visit `/admin` (works) and confirm a client session gets 404 on `/admin`.

- [ ] **Step 5: Commit** — `feat: auth with operator and client roles`

---

### Task 11: Admin UI (practices, facts, prompts, scan trigger, findings triage)

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/practices/[id]/page.tsx`, `src/app/admin/actions.ts` (server actions)
- Test: `tests/app/admin-actions.test.ts` (server actions against PGlite)

**Interfaces:**
- Produces server actions (all call `requireOperator()` first): `createPractice(form: { name; slug; website })`, `addFact(practiceId, { category; label; value })`, `archiveFact(factId)`, `addPrompt(practiceId, { text; kind })`, `togglePrompt(promptId)`, `addCompetitor(practiceId, name)`, `addNameVariation(practiceId, text)`, `inviteClient(practiceId, email)` (creates client user + practice_members + sends magic link), `triggerScan(practiceId)` (calls `runScan` with real adapters + judge), `updateFindingStatus(findingId, status)` (sets `resolvedAt` when status ∈ fixed/verified/dismissed, writes activity `"Fixed: <claim>"`).

- [ ] **Step 1: Failing tests** for `addFact`, `updateFindingStatus` (assert row states + activity row written; import actions with a test db injected via a `getDb()` indirection — add `src/db/index.ts` export `setDbForTests(db)` used only under `NODE_ENV=test`).
- [ ] **Step 2: Run — FAIL.**  **Step 3: Implement actions + pages.** Practice detail page sections, in order: Fact Sheet table (category-grouped, add/archive inline), Prompts (10 max active — enforce in `addPrompt`, error "Deactivate a prompt first" beyond 10), Competitors, Name variations, **Run scan now** button (calls `triggerScan`, streams nothing — shows "Scan started; refresh in ~2 min"), Open findings table with status dropdown per row. Plain Tailwind tables; no component library.
- [ ] **Step 4: Tests PASS + manual walkthrough** (create practice → add 2 facts, 2 prompts → trigger scan with real keys → see checks in db via `npx drizzle-kit studio`).
- [ ] **Step 5: Commit** — `feat: admin practice management and scan trigger`

---

### Task 12: Client dashboard (command center + answers + accuracy)

**Files:**
- Create: `src/app/dashboard/[slug]/page.tsx`, `src/app/dashboard/[slug]/answers/page.tsx`, `src/app/dashboard/[slug]/accuracy/page.tsx`, `src/components/score-card.tsx`, `src/components/trend-chart.tsx`, `src/components/answer-card.tsx`, `src/components/finding-card.tsx`, `src/lib/queries.ts`
- Test: `tests/lib/queries.test.ts`

**Interfaces:**
- Consumes: `requirePracticeAccess(slug)`.
- Produces `src/lib/queries.ts`: `getLatestScan(db, practiceId)`, `getScoreTrend(db, practiceId, weeks: number): { date: string; score: number }[]`, `getChecksForScan(db, scanId)` (joined with prompt text), `getOpenFindings(db, practiceId)`, `getActivities(db, practiceId, limit)`, `getCompetitorPressure(db, scanId): { name: string; mentions: number }[]` (count of appearances in `competitorsMentioned` across the scan's checks, desc).

- [ ] **Step 1: Failing tests** for `getScoreTrend` (returns completed scans only, ascending by date) and `getCompetitorPressure` (correct counts/order) against PGlite seeded via `tests/helpers/db.ts`.
- [ ] **Step 2: Run — FAIL.**  **Step 3: Implement queries, then pages:**
  - **Command center** (`/dashboard/[slug]`): verdict line (template: `"AI engines named {practice} in {cited} of {total} checks this week."`), three KPI tiles (Score + delta vs previous scan; This week's cited checks; Open accuracy issues), trend chart (Recharts line, last 12 scans — **invoke the `dataviz` skill before writing this component** and follow its palette/axis rules), competitor pressure list, latest activity (5 rows).
  - **Answers** (`/answers`): every check from the latest scan as an `answer-card`: prompt text, engine badge, full verbatim `answerText` with practice-name mentions `<mark>`-highlighted (reuse the word-boundary regex from `core/mention.ts` — export `highlightRanges(answer, variations): {start,end}[]` there, with a unit test, rather than re-implementing), citation links, position chip.
  - **Accuracy** (`/accuracy`): findings grouped by status — open (red), fixed (amber), verified (green) — each card: claim vs fact side by side, severity, platform, dates. Footer copy (exact): *"Accuracy issues cap your visibility score at 70 until resolved."*
- [ ] **Step 4: Tests PASS; manual walkthrough as a client user** (magic link → dashboard renders with seeded scan; `/admin` 404s).
- [ ] **Step 5: Commit** — `feat: client dashboard with score, answers, accuracy ledger`

---

### Task 13: Weekly cron + pulse email

**Files:**
- Create: `src/app/api/cron/weekly-scan/route.ts`, `src/services/pulse-email.ts`, `vercel.json`
- Test: `tests/services/pulse-email.test.ts`

**Interfaces:**
- Consumes: `runScan`, queries from Task 12, Resend.
- Produces: `composePulse(args: { practiceName: string; score: number; prevScore: number | null; cited: number; total: number; bestQuote: { engine: string; snippet: string } | null; openFindings: number; appUrl: string; slug: string }): { subject: string; html: string }` (pure — testable), and `sendPulse(db, practiceId)` (composes from latest scan + sends to all practice members via Resend).

- [ ] **Step 1: Failing tests for `composePulse`**

```ts
import { describe, it, expect } from "vitest";
import { composePulse } from "@/services/pulse-email";

const base = { practiceName: "Glow MedSpa", score: 42, prevScore: 38, cited: 6, total: 40,
  bestQuote: { engine: "perplexity", snippet: "Glow MedSpa is known for natural results" },
  openFindings: 0, appUrl: "https://app.example", slug: "glow" };

describe("composePulse", () => {
  it("subject follows the locked format", () =>
    expect(composePulse(base).subject).toBe("What AI told patients about Glow MedSpa this week"));
  it("shows delta and check count", () => {
    const { html } = composePulse(base);
    expect(html).toContain("42");
    expect(html).toContain("+4");
    expect(html).toContain("6 of 40 checks");
  });
  it("renders the verbatim quote when present", () =>
    expect(composePulse(base).html).toContain("natural results"));
  it("first scan (no prev) omits delta", () =>
    expect(composePulse({ ...base, prevScore: null }).html).not.toContain("+"));
});
```

- [ ] **Step 2: Run — FAIL.**  **Step 3: Implement** `composePulse` (inline-styled HTML table email, ≤6 content rows, dashboard CTA link `${appUrl}/dashboard/${slug}`), `sendPulse` (Resend `emails.send`, from `pulse@` domain env-configurable — add optional `EMAIL_FROM` to env with dev default `onboarding@resend.dev`), and the cron route:

```ts
// src/app/api/cron/weekly-scan/route.ts
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${loadEnv().CRON_SECRET}`) return new Response("nope", { status: 401 });
  const db = getDb();
  const activePractices = await db.select().from(practices).where(eq(practices.active, true));
  const results = [];
  for (const b of activePractices) {
    try {
      const r = await runScan(db, b.id, getAdapters(), judgeAnswer);
      await sendPulse(db, b.id);
      results.push({ practice: b.slug, score: r.score });
    } catch (e) { results.push({ practice: b.slug, error: String(e).slice(0, 200) }); }
  }
  return Response.json({ results });
}
```

`vercel.json`: `{ "crons": [{ "path": "/api/cron/weekly-scan", "schedule": "0 14 * * 4" }] }` (Thursday 14:00 UTC = 6/7am PT, so Friday-morning pulse emails land after you've reviewed — adjust once live).

- [ ] **Step 4: Tests PASS; manual:** `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/weekly-scan` with one active seeded practice and real keys → verify scan row + email received.
- [ ] **Step 5: Commit** — `feat: weekly cron scan and pulse email`

---

### Task 14: Printable monthly report

**Files:**
- Create: `src/app/dashboard/[slug]/report/page.tsx`, `src/lib/report.ts`
- Test: `tests/lib/report.test.ts`

**Interfaces:**
- Produces `buildReportData(db, practiceId, monthISO: string)` → `{ verdict: string; score: number; prevMonthScore: number | null; trend: {date,score}[]; perEngine: { engine: string; cited: number; total: number }[]; accuracyLedger: { found: number; fixed: number; verified: number; open: number }; activities: string[]; bestQuote: { engine; prompt; snippet } | null }`. Verdict template (locked): `"AI engines named {practice} in {pct}% of patient-question checks in {month}, {direction} from {prevPct}% last month."` (omit comparison clause when no prior month).

- [ ] **Step 1: Failing tests** for `buildReportData`: per-engine cited/total math from seeded checks across two scans in the month; accuracy ledger counts by status; verdict string for both with-prior and no-prior cases.
- [ ] **Step 2: Run — FAIL.**  **Step 3: Implement** `report.ts` + the page: single-column, sections in the locked report order from strategy Doc 3 (verdict → score+trend → accuracy ledger → per-engine table → activity list → next month placeholder text editable via a `reportNotes` column added to `practices` (migrate) → best-quote blockquote). Add `@media print` CSS: hide nav, white background, page margins — the deliverable PDF is browser Print-to-PDF; no PDF library.
- [ ] **Step 4: Tests PASS; manual:** print preview looks clean at A4/Letter.
- [ ] **Step 5: Commit** — `feat: printable monthly report`

---

### Task 15: Seed script, deployment, ship checklist

**Files:** Create `scripts/seed.ts`; Modify `README.md`, `package.json` (scripts)

- [ ] **Step 1: `scripts/seed.ts`** — creates the operator user (from `OPERATOR_EMAIL`), one demo practice ("Glow MedSpa", slug `glow`) with: 8 facts across categories (include one `not_offered`: "Surgical procedures — NOT offered"), the 10-prompt starter battery from strategy Doc 1 §Section-4-derived set (6 category / 2 branded / 2 informational, Santa Monica placeholders), 3 competitors, 2 name variations. Idempotent (upsert by slug). `npm run seed`.
- [ ] **Step 2: `package.json` scripts** — `"test": "vitest run"`, `"seed": "tsx scripts/seed.ts"`, `"smoke": "tsx scripts/smoke-engines.ts"`, `"db:push": "drizzle-kit push"`, `"db:studio": "drizzle-kit studio"`.
- [ ] **Step 3: README ship checklist** (write it as a literal checklist): Neon database created + `DATABASE_URL` set → `npm run db:push` → all 8 env keys in Vercel → `vercel deploy` → cron visible in Vercel dashboard → seed run against prod db → operator login works → `npm run smoke` passes all 4 engines → trigger first real scan from `/admin` → invite first client email. Include the cost note: at 10 prompts × 4 engines × ~weekly, expect roughly 40 search-enabled calls + ~8 judge calls per practice per week — budget a few dollars per practice per month; recheck vendor pricing at deploy time.
- [ ] **Step 4: Full test suite green** — `npm test` (expect ~30 tests passing). Fix anything red.
- [ ] **Step 5: Commit** — `chore: seed, scripts, ship checklist` — then tag `v0.1.0`.

---

## Self-Review (completed during planning)

- **Spec coverage:** fact sheet (T2/T11), 4-engine scans (T7/T9), hallucination detection (T6/T8/T9), score with cap (T5), client dashboard + verbatim answers + accuracy ledger (T12), weekly automation + pulse email (T13), monthly report (T14), roles/multi-tenancy (T10), ops (T15). Reference-platform-guide features deliberately deferred post-MVP: content generation ("Act"), Reddit/HN mention scanning, keywords discovery, auto-competitor discovery, AI tutor, guided tour, score-breakdown modal. These are listed so nobody "helpfully" scope-creeps them in.
- **Type consistency check:** `EngineAnswer`/`EngineAdapter` (T2/T7) flow into `runScan` (T9); `JudgeFinding` (T6) flows T8→T9; `ScoreBreakdown` component names match `scans` columns (T2/T5/T9); `composePulse`/`buildReportData` consume only fields produced by T12 queries.
- **Known risk flagged, not hidden:** vendor API response shapes drift — that's what `scripts/smoke-engines.ts` (T7 step 5) exists for; mapping tests pin our parsing, the smoke script pins reality.
```
