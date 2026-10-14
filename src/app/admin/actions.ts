"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getDb } from "@/db";
import {
  practices, nameVariations, competitors, facts, prompts, findings,
  activities, factCategoryEnum, promptKindEnum, findingStatusEnum,
} from "@/db/schema";
import { cleanSection } from "@/core/fact-sections";
import { FIX_STATE_LABEL, fixState, storedFor, type FixState } from "@/core/fix-list";
import { requireOperator } from "@/lib/auth";
import { grantClientLogin } from "@/services/client-access";
import { runScan, SCAN_DEADLINE_MS, SCAN_STUCK_AFTER_MS } from "@/services/scan-runner";
import { scanStartedWithin } from "@/lib/queries";
import { getAdapters } from "@/engines";
import { judgeAnswer } from "@/services/hallucination-judge";
import { extractCompetitors } from "@/services/competitor-extractor";
import { logActivity } from "@/services/activity";
import { loadEnv } from "@/lib/env";
import { fetchSitePages, draftFactsFromPages, saveDraftFacts } from "@/services/fact-drafter";
import { setSupportStatus } from "@/services/support";
import { rateTone } from "@/services/tone-rater";
import { runWebsiteCheck } from "@/services/website-check";
import { fetchLogo } from "@/services/logo";
import { isPlan } from "@/core/plan";
import { aiOverviewCheck } from "@/services/ai-overviews";
import { draftForecastSetup } from "@/services/forecast";

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

/**
 * Operators only: creates a new monitored business. The category and
 * location are optional and share `updateReportDetails`' caps, so a business
 * the operator creates by hand has a location on record from the start (the
 * namesake guard does nothing without one).
 */
export async function createPractice(
  input: { name: string; slug: string; website?: string; category?: string; location?: string },
): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.insert(practices).values({
    name: input.name,
    slug: input.slug,
    website: input.website || null,
    category: input.category?.trim().slice(0, 60) || null,
    location: input.location?.trim().slice(0, 80) || null,
    // A site with no usable logo, or one that is down, must not stop the business being created.
    logo: input.website ? await fetchLogo(input.website).catch(() => null) : null,
  });
  revalidatePath("/admin");
}

/**
 * Operators only: reads the business's logo from its website again and saves
 * it. A site with no usable logo leaves the saved one as it is.
 */
export async function refreshLogo(practiceId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [practice] = await db.select({ website: practices.website, slug: practices.slug })
    .from(practices).where(eq(practices.id, practiceId));
  if (!practice?.website) return;
  const logo = await fetchLogo(practice.website).catch(() => null);
  if (logo) await db.update(practices).set({ logo }).where(eq(practices.id, practiceId));
  revalidatePath(`/admin/practices/${practiceId}`);
  revalidatePath(`/dashboard/${practice.slug}`, "layout");
}

/** Operators only: puts the business on a plan, or on none. Billing is not connected, so this charges nothing. */
export async function setPlan(practiceId: string, plan: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [practice] = await db.update(practices).set({ plan: isPlan(plan) ? plan : null })
    .where(eq(practices.id, practiceId)).returning({ slug: practices.slug });
  revalidatePath(`/admin/practices/${practiceId}`);
  if (practice) revalidatePath(`/dashboard/${practice.slug}`, "layout");
}

/** Operators only: takes the logo off the business's dashboard. */
export async function removeLogo(practiceId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [practice] = await db.update(practices).set({ logo: null }).where(eq(practices.id, practiceId)).returning({ slug: practices.slug });
  revalidatePath(`/admin/practices/${practiceId}`);
  if (practice) revalidatePath(`/dashboard/${practice.slug}`, "layout");
}

/**
 * Operators only: reads the practice's website and saves a draft fact sheet
 * for review. Drafts stay out of every scan until approved. Returns how many
 * new drafts were added, or an error message the page can show.
 */
export async function draftFactsFromWebsite(practiceId: string): Promise<{ added: number } | { error: string }> {
  await requireOperator();
  const db = getDb();
  const [practice] = await db.select().from(practices).where(eq(practices.id, practiceId));
  if (!practice) return { error: "Business not found." };
  if (!practice.website) return { error: "Add the business website first." };
  try {
    const pages = await fetchSitePages(practice.website);
    const drafts = await draftFactsFromPages({ businessName: practice.name, pages });
    const added = await saveDraftFacts(db, practiceId, drafts);
    await logActivity(db, practiceId, `fact drafter: ${added} draft facts from ${pages.length} pages of ${practice.website}`);
    // The same read also drafts the forecast setup, unless the operator has already written one.
    if (!practice.forecast?.keywords.length) await draftForecastSetup(db, practiceId).catch(() => false);
    revalidatePath(`/admin/practices/${practiceId}`);
    return { added };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logActivity(db, practiceId, `fact drafter failed: ${message}`);
    return { error: message };
  }
}

/** Operators only: confirms a drafted fact so scans start checking answers against it. */
export async function approveFact(factId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [fact] = await db.update(facts)
    .set({ status: "active", updatedAt: new Date() })
    .where(and(eq(facts.id, factId), eq(facts.status, "draft")))
    .returning();
  if (fact) revalidatePath(`/admin/practices/${fact.practiceId}`);
}

/** Operators only: confirms every draft for a practice at once, after reviewing them on the call. */
export async function approveAllDrafts(practiceId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.update(facts)
    .set({ status: "active", updatedAt: new Date() })
    .where(and(eq(facts.practiceId, practiceId), eq(facts.status, "draft")));
  revalidatePath(`/admin/practices/${practiceId}`);
}

/** Operators only: corrects a fact's value (a draft the client amended, or a price that changed). */
export async function updateFactValue(factId: string, value: string, section?: string): Promise<void> {
  await requireOperator();
  const trimmed = value.trim();
  if (!trimmed) return;
  const db = getDb();
  // The heading is only changed when the form sent one; a blank heading
  // clears it, so the fact falls back to the default for its type.
  const heading = section === undefined ? {} : { section: cleanSection(section) };
  const [fact] = await db.update(facts)
    .set({ value: trimmed, ...heading, updatedAt: new Date() })
    .where(eq(facts.id, factId))
    .returning();
  if (fact) revalidatePath(`/admin/practices/${fact.practiceId}`);
}

/** Operators only: adds an active fact-sheet entry for a practice. */
export async function addFact(
  practiceId: string,
  input: { category: FactCategory; label: string; value: string; section?: string },
): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.insert(facts).values({
    practiceId, category: input.category, section: cleanSection(input.section), label: input.label, value: input.value,
  });
  revalidatePath(`/admin/practices/${practiceId}`);
}

/** Operators only: archives a fact (soft delete; findings may still reference it). */
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
 * prompts (each active prompt is run against every engine on every scan).
 * Beyond that, an operator must deactivate one first.
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

/**
 * Operators only: hides a competitor (usually a wrong discovery such as a
 * directory or a product) so it neither counts in reports nor gets re-added
 * by the next scan's extractor.
 */
export async function hideCompetitor(competitorId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [row] = await db.select().from(competitors).where(eq(competitors.id, competitorId));
  if (!row) return;
  await db.update(competitors).set({ status: "ignored" }).where(eq(competitors.id, competitorId));
  await logActivity(db, row.practiceId, `Hid competitor: ${row.name}`);
  revalidatePath(`/admin/practices/${row.practiceId}`);
}

/** Operators only: undoes hideCompetitor. */
export async function restoreCompetitor(competitorId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [row] = await db.select().from(competitors).where(eq(competitors.id, competitorId));
  if (!row) return;
  await db.update(competitors).set({ status: "active" }).where(eq(competitors.id, competitorId));
  revalidatePath(`/admin/practices/${row.practiceId}`);
}

/** Operators only: adds an alternate spelling/name the practice may be mentioned by. */
export async function addNameVariation(practiceId: string, text: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.insert(nameVariations).values({ practiceId, text });
  revalidatePath(`/admin/practices/${practiceId}`);
}

/**
 * Operators only: grants a client dashboard access to a practice and issues
 * the temporary password read to them on the onboarding call. Creates the
 * `users` row (role `client`) if the email hasn't been seen before, links it
 * via `practice_members` (a no-op if already linked), and flags the account
 * so the client is forced to choose their own password at first sign-in.
 *
 * Returns the plaintext password. It is shown on screen exactly once and is
 * recoverable nowhere: re-running this issues a new one and invalidates the
 * old. No email is sent from here, by design, since the password is spoken
 * aloud on the call rather than put in an inbox.
 */
export async function issueClientPassword(
  practiceId: string,
  email: string,
): Promise<{ email: string; password: string }> {
  await requireOperator();
  const db = getDb();
  const { email: normalized, password } = await grantClientLogin(db, practiceId, email);
  if (password === null) throw new Error("No password was issued.");

  // Deliberately records the address and not the password: the plaintext is
  // shown once on screen and never written anywhere it could be read back.
  await logActivity(db, practiceId, `Issued a temporary password to ${normalized}`);

  revalidatePath(`/admin/practices/${practiceId}`);
  return { email: normalized, password };
}

/**
 * Operators only: starts or stops the weekly scan and the weekly email for a
 * business. A prospect's business starts paused. An active business always
 * has its whole dashboard open; what a paused one's owner sees is decided by
 * `setDashboardUnlocked`.
 */
export async function setPracticeActive(practiceId: string, active: boolean): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.update(practices).set({ active }).where(eq(practices.id, practiceId));
  await logActivity(db, practiceId, active ? "Started weekly scans" : "Paused: weekly scans stopped");
  await revalidateForPractice(db, practiceId);
}

/**
 * Operators only: opens the whole dashboard to a paused business's owner, or
 * locks it back to the summary. For a prospect after their call, once their
 * facts are confirmed: they see everything without being put on the weekly
 * scan, which stays a separate decision (`setPracticeActive`).
 */
export async function setDashboardUnlocked(practiceId: string, unlocked: boolean): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.update(practices).set({ dashboardUnlocked: unlocked }).where(eq(practices.id, practiceId));
  await logActivity(db, practiceId, unlocked ? "Unlocked the full dashboard" : "Locked the dashboard back to the summary");
  await revalidateForPractice(db, practiceId);
}

const MAX_WORK_LOG_LENGTH = 300;

/**
 * Revalidates the client's dashboard as well as the admin page, so a work-log
 * line the operator just wrote is visible to the client on their next load
 * rather than after the cache happens to expire.
 */
async function revalidateForPractice(db: ReturnType<typeof getDb>, practiceId: string): Promise<void> {
  revalidatePath(`/admin/practices/${practiceId}`);
  const [practice] = await db.select().from(practices).where(eq(practices.id, practiceId));
  if (practice) {
    revalidatePath(`/dashboard/${practice.slug}`);
    revalidatePath(`/dashboard/${practice.slug}/report`);
  }
}

/**
 * Operators only: writes a line to the client-visible work log — the answer to
 * "what am I paying for", shown on the client's dashboard and printed in their
 * monthly report.
 *
 * Itemise atomically: "Updated 14 Google service entries", not "updated
 * Google". A month of work should read as fifteen to twenty-five lines.
 */
export async function logWork(practiceId: string, description: string): Promise<void> {
  await requireOperator();
  const trimmed = description.trim();
  if (!trimmed) throw new Error("Describe the work before logging it.");
  if (trimmed.length > MAX_WORK_LOG_LENGTH) {
    throw new Error(`Keep a work-log line under ${MAX_WORK_LOG_LENGTH} characters.`);
  }

  const db = getDb();
  await logActivity(db, practiceId, trimmed, "client");
  await revalidateForPractice(db, practiceId);
}

/**
 * Operators only: removes a work-log line, for the typo that has already been
 * published to a client.
 *
 * Deliberately refuses internal rows: the diagnostic trail is evidence about
 * what the system did, and an operator should not be able to quietly erase a
 * scan failure from it.
 */
export async function deleteWorkLogEntry(activityId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [row] = await db.select().from(activities).where(eq(activities.id, activityId));
  if (!row || row.visibility !== "client") return;
  await db.delete(activities).where(eq(activities.id, activityId));
  await revalidateForPractice(db, row.practiceId);
}

/** Operators only: sets the "next month" note shown on the client's printable monthly report. */
export async function updateReportNotes(practiceId: string, text: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.update(practices).set({ reportNotes: text || null }).where(eq(practices.id, practiceId));
  revalidatePath(`/admin/practices/${practiceId}`);
}

/**
 * Operators only: kicks off a scan in the background and returns immediately
 * because a scan takes ~2 minutes (four engines × up to ten prompts), far longer
 * than the request should stay open. Failures are swallowed here and
 * recorded as an activity instead of surfacing to the caller, since nothing
 * is awaiting this action's result by the time the scan finishes.
 */
export async function triggerScan(practiceId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  // One scan at a time per practice: a second one started mid-scan would
  // record the same new findings twice.
  if (await scanStartedWithin(db, practiceId, SCAN_STUCK_AFTER_MS, ["running"])) {
    revalidatePath(`/admin/practices/${practiceId}`);
    return;
  }
  // Scan runs post-response via after(); on plain Node servers it runs in-process.
  after(() =>
    runScan(db, practiceId, getAdapters(), judgeAnswer, extractCompetitors, {
      runs: loadEnv().SCAN_RUNS, rateTone, checkWebsite: runWebsiteCheck, checkAiOverviews: aiOverviewCheck(), deadline: Date.now() + SCAN_DEADLINE_MS,
    }).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      void logActivity(db, practiceId, `scan failed: ${message}`);
    }),
  );
  revalidatePath(`/admin/practices/${practiceId}`);
}

/**
 * Operators only: transitions a finding's triage status. `resolvedAt` is
 * stamped when it moves to a resolved state (fixed/verified/dismissed) and
 * cleared on reopen. Every transition is recorded as an activity. Resolved
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

const MAX_FIX_NOTE_LENGTH = 300;

/**
 * Operators only: moves a wrong fact through the fix list and sets the note
 * the customer sees beside it. "In progress" keeps the finding open (AI is
 * still saying it, so it still costs points) and only records that work has
 * started. The note is for the customer: a blank one clears it.
 *
 * The customer's work log gets a line when a fact is marked fixed, because
 * that is work done for them; every other move is logged for us only.
 */
export async function updateFix(findingId: string, input: { state: FixState; note?: string }): Promise<void> {
  await requireOperator();
  const db = getDb();
  const [finding] = await db.select().from(findings).where(eq(findings.id, findingId));
  if (!finding) return;

  const { status, started } = storedFor(input.state);
  const before = fixState(finding);
  const note = input.note === undefined ? undefined : input.note.trim().slice(0, MAX_FIX_NOTE_LENGTH) || null;
  const noteChanged = note !== undefined && note !== finding.note;

  await db.update(findings)
    .set({
      status,
      // Keep the day it was first resolved or started when the state did not change.
      resolvedAt: !RESOLVED_STATUSES.includes(status) ? null
        : before === input.state && finding.resolvedAt ? finding.resolvedAt : new Date(),
      workStartedAt: started ? finding.workStartedAt ?? new Date() : null,
      ...(noteChanged ? { note, noteUpdatedAt: note ? new Date() : null } : {}),
    })
    .where(eq(findings.id, findingId));

  if (before !== input.state) {
    const [fact] = finding.factId ? await db.select({ label: facts.label }).from(facts).where(eq(facts.id, finding.factId)) : [];
    const topic = fact?.label ?? finding.claim;
    if (input.state === "fixed") await logActivity(db, finding.practiceId, `Fixed a wrong fact: ${topic}`, "client");
    else await logActivity(db, finding.practiceId, `${FIX_STATE_LABEL[input.state]}: ${finding.claim}`);
  }

  await revalidateForPractice(db, finding.practiceId);
}

/** Operators only: marks a client help request answered, or reopens it. */
export async function setSupportRequestStatus(id: string, status: "open" | "closed"): Promise<void> {
  await requireOperator();
  await setSupportStatus(getDb(), id, status);
  revalidatePath("/admin");
}

/** Operators only: the business category and location used in the audit report's wording. */
export async function updateReportDetails(practiceId: string, input: { category: string; location: string }): Promise<void> {
  await requireOperator();
  const db = getDb();
  await db.update(practices).set({
    category: input.category.trim().slice(0, 60) || null,
    location: input.location.trim().slice(0, 80) || null,
  }).where(eq(practices.id, practiceId));
  revalidatePath(`/admin/practices/${practiceId}`);
}
