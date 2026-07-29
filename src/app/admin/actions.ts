"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getDb } from "@/db";
import {
  practices, practiceMembers, nameVariations, competitors, facts, prompts, findings, users,
  factCategoryEnum, promptKindEnum, findingStatusEnum,
} from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { runScan } from "@/services/scan-runner";
import { getAdapters } from "@/engines";
import { judgeAnswer } from "@/services/hallucination-judge";
import { logActivity } from "@/services/activity";

type FactCategory = (typeof factCategoryEnum.enumValues)[number];
type PromptKind = (typeof promptKindEnum.enumValues)[number];
type FindingStatus = (typeof findingStatusEnum.enumValues)[number];

const MAX_ACTIVE_PROMPTS = 10;
const RESOLVED_STATUSES: FindingStatus[] = ["fixed", "verified", "dismissed"];
const STATUS_ACTIVITY_LABEL: Partial<Record<FindingStatus, string>> = {
  fixed: "Fixed",
  verified: "Verified",
  dismissed: "Dismissed",
};

/** Operators only: creates a new monitored practice. */
export async function createPractice(input: { name: string; slug: string; website?: string }): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.insert(practices).values({ name: input.name, slug: input.slug, website: input.website || null });
  revalidatePath("/admin");
}

/** Operators only: adds an active fact-sheet entry for a practice. */
export async function addFact(
  practiceId: string,
  input: { category: FactCategory; label: string; value: string },
): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.insert(facts).values({
    practiceId, category: input.category, label: input.label, value: input.value,
  });
  revalidatePath(`/admin/practices/${practiceId}`);
}

/** Operators only: archives a fact (soft delete — findings may still reference it). */
export async function archiveFact(factId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [fact] = await db.update(facts)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(facts.id, factId))
    .returning();
  if (fact) revalidatePath(`/admin/practices/${fact.practiceId}`);
}

/**
 * Operators only: adds a monitoring prompt. Caps a practice at 10 *active*
 * prompts (each active prompt is run against every engine on every scan) —
 * beyond that, an operator must deactivate one first.
 */
export async function addPrompt(
  practiceId: string,
  input: { text: string; kind: PromptKind },
): Promise<void> {
  await requireOperator();
  const db = getDb();
  const activePrompts = await db.select().from(prompts)
    .where(and(eq(prompts.practiceId, practiceId), eq(prompts.active, true)));
  if (activePrompts.length >= MAX_ACTIVE_PROMPTS) {
    throw new Error("Deactivate a prompt first");
  }
  await db.insert(prompts).values({ practiceId, text: input.text, kind: input.kind });
  revalidatePath(`/admin/practices/${practiceId}`);
}

/** Operators only: flips a prompt between active and inactive. */
export async function togglePrompt(promptId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [prompt] = await db.select().from(prompts).where(eq(prompts.id, promptId));
  if (!prompt) return;
  await db.update(prompts).set({ active: !prompt.active }).where(eq(prompts.id, promptId));
  revalidatePath(`/admin/practices/${prompt.practiceId}`);
}

/** Operators only: adds a named competitor to watch for in scan answers. */
export async function addCompetitor(practiceId: string, name: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.insert(competitors).values({ practiceId, name });
  revalidatePath(`/admin/practices/${practiceId}`);
}

/** Operators only: adds an alternate spelling/name the practice may be mentioned by. */
export async function addNameVariation(practiceId: string, text: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.insert(nameVariations).values({ practiceId, text });
  revalidatePath(`/admin/practices/${practiceId}`);
}

/**
 * Operators only: grants a client dashboard access to a practice. Creates the
 * `users` row (role `client`) if the email hasn't signed in before, then
 * links it via `practice_members` (a no-op if already linked). This does NOT
 * send a magic link — Resend sends one automatically the next time the
 * client signs in at /login with this email.
 */
export async function inviteClient(practiceId: string, email: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  const user = existing ?? (await db.insert(users).values({ email, role: "client" }).returning())[0];
  await db.insert(practiceMembers).values({ userId: user.id, practiceId }).onConflictDoNothing();
  revalidatePath(`/admin/practices/${practiceId}`);
}

/**
 * Operators only: kicks off a scan in the background and returns immediately
 * — a scan takes ~2 minutes (four engines × up to ten prompts), far longer
 * than the request should stay open. Failures are swallowed here and
 * recorded as an activity instead of surfacing to the caller, since nothing
 * is awaiting this action's result by the time the scan finishes.
 */
export async function triggerScan(practiceId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  // Scan runs post-response via after(); on plain Node servers it runs in-process.
  after(() =>
    runScan(db, practiceId, getAdapters(), judgeAnswer).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      void logActivity(db, practiceId, `scan failed: ${message}`);
    }),
  );
  revalidatePath(`/admin/practices/${practiceId}`);
}

/**
 * Operators only: transitions a finding's triage status. `resolvedAt` is
 * stamped when it moves to a resolved state (fixed/verified/dismissed) and
 * cleared on reopen. Every transition is recorded as an activity — resolved
 * states log "Fixed/Verified/Dismissed: <claim>", reopening logs
 * "Reopened: <claim>".
 */
export async function updateFindingStatus(findingId: string, status: FindingStatus): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [finding] = await db.select().from(findings).where(eq(findings.id, findingId));
  if (!finding) return;

  const resolved = RESOLVED_STATUSES.includes(status);
  await db.update(findings)
    .set({ status, resolvedAt: resolved ? new Date() : null })
    .where(eq(findings.id, findingId));

  const label = status === "open" ? "Reopened" : STATUS_ACTIVITY_LABEL[status];
  if (label) {
    await logActivity(db, finding.practiceId, `${label}: ${finding.claim}`);
  }

  revalidatePath(`/admin/practices/${finding.practiceId}`);
}
