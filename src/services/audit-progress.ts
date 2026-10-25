import { count, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { leads, prompts, scanAnswers, scans } from "@/db/schema";

export type AuditStage = "reading" | "asking" | "writing" | "done" | "failed" | "not-started";

export type AuditProgress = {
  stage: AuditStage;
  percent: number;
  answers: number;
  total: number | null;
  businessName: string | null;
  hasEmail: boolean;
  email: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids come from the URL, and a bad one would make the database error instead of answering "not found". */
export const isUuid = (value: string): boolean => UUID.test(value);

/**
 * Where a lead's audit stands, for the page that shows it being prepared.
 * Worked out from the rows alone: the lead's status, then its latest scan and
 * how many answers that scan has saved. Null for an unknown lead.
 */
export async function auditProgress(db: Db, leadId: string): Promise<AuditProgress | null> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return null;
  const base = { businessName: lead.practiceName, hasEmail: !!lead.email, email: lead.email };
  const at = (stage: AuditStage, percent: number, answers = 0, total: number | null = null): AuditProgress =>
    ({ stage, percent, answers, total, ...base });

  // Not scanned at all (the daily cap or a repeat) vs. set up but broken.
  if (lead.status === "needs_attention") return lead.practiceId ? at("failed", 0) : at("not-started", 0);
  if (lead.status === "ready") return at("done", 100);
  if (!lead.practiceId) return at("reading", 5);

  const [scan] = await db.select().from(scans).where(eq(scans.practiceId, lead.practiceId))
    .orderBy(desc(scans.startedAt)).limit(1);
  if (!scan) {
    const [{ n }] = await db.select({ n: count() }).from(prompts).where(eq(prompts.practiceId, lead.practiceId));
    return at("reading", n > 0 ? 15 : 8);
  }
  if (scan.status === "complete") return at("done", 100);
  if (scan.status !== "running") return at("failed", 0);

  const [{ n: answers }] = await db.select({ n: count() }).from(scanAnswers).where(eq(scanAnswers.scanId, scan.id));
  const total = scan.totalTasks;
  if (!total) return at("reading", 15, answers);
  if (answers >= total) return at("writing", 95, answers, total);
  return at("asking", Math.round(15 + 75 * (answers / total)), answers, total);
}
