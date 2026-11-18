import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { leads, scans } from "@/db/schema";
import { QUICK_PURPOSE } from "@/lib/published-scan";

/**
 * What a dashboard has to say about the scan it is showing, for a business
 * whose audit is new: a quick look comes first and the full audit replaces it.
 * Null once a full scan is on screen, which is every ordinary day.
 */
export type ScanNotice = "quick-full-running" | "quick-full-failed" | "first-running" | "first-failed" | null;

/** A full audit that hasn't started this long after the quick look ended isn't coming. */
const FULL_AUDIT_OVERDUE_MS = 15 * 60_000;

export async function scanNotice(db: Db, practiceId: string): Promise<ScanNotice> {
  const rows = await db.select({ status: scans.status, purpose: scans.purpose, finishedAt: scans.finishedAt, startedAt: scans.startedAt }).from(scans)
    .where(eq(scans.practiceId, practiceId)).orderBy(desc(scans.startedAt));
  const complete = rows.filter(s => s.status === "complete");
  // A full scan is showing: nothing to explain.
  if (complete.some(s => s.purpose !== QUICK_PURPOSE)) return null;

  const [lead] = await db.select({ status: leads.status }).from(leads).where(eq(leads.practiceId, practiceId)).limit(1);
  const stuck = lead?.status === "needs_attention";
  if (complete.length === 0) return stuck ? "first-failed" : "first-running";

  // Only a quick look is showing. The full audit is the newest scan that isn't one.
  const full = rows.find(s => s.purpose !== QUICK_PURPOSE);
  if (full?.status === "running") return "quick-full-running";
  if (full || stuck) return "quick-full-failed";
  // No full scan yet: it starts moments after the quick look ends. If it
  // still hasn't long after, it never will, and the page stops promising it.
  const ended = complete[0].finishedAt ?? complete[0].startedAt;
  return Date.now() - ended.getTime() > FULL_AUDIT_OVERDUE_MS ? "quick-full-failed" : "quick-full-running";
}

/** The notice in the customer's words. `tools` is the quick look's tools, e.g. "ChatGPT and Claude". */
export function noticeText(notice: Exclude<ScanNotice, null>, tools: string): string {
  const quick = `This is a quick look from ${tools || "two AI tools"}.`;
  switch (notice) {
    case "quick-full-running":
      return `${quick} Your full audit across every AI tool is running and will replace it in a few minutes.`;
    case "quick-full-failed":
      return `${quick} We're finishing your full audit by hand and will email you.`;
    case "first-failed":
      return "Something went wrong on our side. We'll finish your audit by hand and email it to you.";
    case "first-running":
      return "Your first scan is running. Your scores fill in here when it finishes.";
  }
}

/** Whether the dashboard should keep checking for a newer scan by itself. */
export const noticeIsWaiting = (notice: ScanNotice): boolean => notice === "quick-full-running" || notice === "first-running";
