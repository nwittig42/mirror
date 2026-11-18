import { count, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { leads, prompts, scanAnswers, scans } from "@/db/schema";
import { NOT_PREPARED_NOTE } from "@/services/leads";
import { QUICK_PURPOSE } from "@/lib/published-scan";
import { quickToolsLabel } from "@/services/quick-scan";

export type AuditStage = "reading" | "asking" | "writing" | "done" | "failed" | "not-started";

export type AuditProgress = {
  stage: AuditStage;
  percent: number;
  answers: number;
  total: number | null;
  businessName: string | null;
  hasEmail: boolean;
  email: string | null;
  /** Who the "asking" stage names: the quick look's tools while it runs, otherwise every tool. */
  asking: string;
};

/** What the asking stage says when it isn't the quick look's own two tools. */
const EVERY_TOOL = "the AI tools";

/** A preparing lead with nothing under way after this long has lost its setup. */
const STALE_MS = 15 * 60_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids come from the URL, and a bad one would make the database error instead of answering "not found". */
export const isUuid = (value: string): boolean => UUID.test(value);

/**
 * Where a lead's audit stands, for the page that shows it being prepared.
 * Worked out from the rows alone: the lead's status, then its scans and how
 * many answers the one under way has saved. Null for an unknown lead.
 */
export async function auditProgress(db: Db, leadId: string): Promise<AuditProgress | null> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return null;
  const base = { businessName: lead.practiceName, hasEmail: !!lead.email, email: lead.email };
  const at = (
    stage: AuditStage, percent: number, answers = 0, total: number | null = null, asking: string = EVERY_TOOL,
  ): AuditProgress => ({ stage, percent, answers, total, asking, ...base });

  // Newest first. A new audit is two scans: a quick look, then the full one.
  const practiceScans = lead.practiceId
    ? await db.select().from(scans).where(eq(scans.practiceId, lead.practiceId)).orderBy(desc(scans.startedAt))
    : [];
  // Any finished scan is a result to show, whatever became of the other one:
  // a full audit still running behind a quick look, or one that failed after it.
  if (practiceScans.some(s => s.status === "complete")) return at("done", 100);

  // Not scanned at all (the daily cap or a repeat, which markNotPrepared
  // notes) vs. a setup that broke, before or after the business existed.
  if (lead.status === "needs_attention") {
    return !lead.practiceId && lead.note?.startsWith(NOT_PREPARED_NOTE) ? at("not-started", 0) : at("failed", 0);
  }
  if (lead.status === "ready") return at("done", 100);
  // Setup runs in the background of the start request, and a killed one never
  // marks the lead. Past this long with nothing under way, it isn't coming.
  const stale = Date.now() - lead.createdAt.getTime() > STALE_MS;
  if (!lead.practiceId) return stale ? at("failed", 0) : at("reading", 5);

  const scan = practiceScans[0];
  if (stale && scan?.status !== "running") return at("failed", 0);
  if (!scan) {
    const [{ n }] = await db.select({ n: count() }).from(prompts).where(eq(prompts.practiceId, lead.practiceId));
    return at("reading", n > 0 ? 15 : 8);
  }
  if (scan.status !== "running") {
    // A quick look that was blocked or failed is not the audit failing: the
    // full audit starts next, and the visitor waits on that one.
    return scan.purpose === QUICK_PURPOSE ? at("asking", 20) : at("failed", 0);
  }

  const asking = scan.purpose === QUICK_PURPOSE ? quickToolsLabel() || EVERY_TOOL : EVERY_TOOL;
  const [{ n: answers }] = await db.select({ n: count() }).from(scanAnswers).where(eq(scanAnswers.scanId, scan.id));
  const total = scan.totalTasks;
  if (!total) return at("reading", 15, answers, null, asking);
  if (answers >= total) return at("writing", 95, answers, total, asking);
  return at("asking", Math.round(15 + 75 * (answers / total)), answers, total, asking);
}
