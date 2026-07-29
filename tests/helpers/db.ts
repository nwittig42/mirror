import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import type { Db } from "@/db";

/**
 * Spins up an in-memory PGlite database and pushes the drizzle schema to it
 * (no migration files needed). Shared by any test that needs a real Postgres
 * dialect to run queries against.
 */
export async function makeTestDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const { pushSchema } = await import("drizzle-kit/api");
  const { apply } = await pushSchema(schema, db as never);
  await apply();
  return db;
}

type FactCategory = (typeof schema.factCategoryEnum.enumValues)[number];
type PromptKind = (typeof schema.promptKindEnum.enumValues)[number];

export interface SeedPracticeInput {
  name: string;
  slug?: string;
  prompts?: { text: string; kind: PromptKind }[];
  facts?: { category: FactCategory; label: string; value: string; status?: string }[];
  competitors?: string[];
  /** Emails of client users to create and link via practice_members. */
  members?: string[];
}

export interface SeedPracticeResult {
  practiceId: string;
  promptIds: string[];
  factIds: string[];
  competitorIds: string[];
  memberIds: string[];
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Seeds a practice with a name variation (the practice name itself), plus
 * optional prompts, facts, and competitors, all scoped to that practice.
 */
export async function seedPractice(db: Db, input: SeedPracticeInput): Promise<SeedPracticeResult> {
  const [practice] = await db.insert(schema.practices)
    .values({ name: input.name, slug: input.slug ?? slugify(input.name) })
    .returning();

  await db.insert(schema.nameVariations).values({ practiceId: practice.id, text: input.name });

  const promptRows = input.prompts?.length
    ? await db.insert(schema.prompts)
        .values(input.prompts.map(p => ({ practiceId: practice.id, text: p.text, kind: p.kind })))
        .returning()
    : [];

  const factRows = input.facts?.length
    ? await db.insert(schema.facts)
        .values(input.facts.map(f => ({
          practiceId: practice.id, category: f.category, label: f.label, value: f.value,
          status: f.status ?? "active",
        })))
        .returning()
    : [];

  const competitorRows = input.competitors?.length
    ? await db.insert(schema.competitors)
        .values(input.competitors.map(name => ({ practiceId: practice.id, name })))
        .returning()
    : [];

  const memberRows = input.members?.length
    ? await db.insert(schema.users).values(input.members.map(email => ({ email }))).returning()
    : [];

  if (memberRows.length > 0) {
    await db.insert(schema.practiceMembers)
      .values(memberRows.map(u => ({ userId: u.id, practiceId: practice.id })));
  }

  return {
    practiceId: practice.id,
    promptIds: promptRows.map(p => p.id),
    factIds: factRows.map(f => f.id),
    competitorIds: competitorRows.map(c => c.id),
    memberIds: memberRows.map(u => u.id),
  };
}
