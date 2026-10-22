import type { Db } from "@/db";
import { SCAN_STUCK_AFTER_MS, type ScanPurpose, type ScanResult } from "@/services/scan-runner";
import { logActivity } from "@/services/activity";
import { and, eq, lt } from "drizzle-orm";
import { scans } from "@/db/schema";
import { weeklyComplete } from "@/services/weekly-scan";
import { finishProspect } from "@/services/prospect-setup";
import { sendProspectAlert } from "@/services/alert-email";
import { sendProspectReportFor } from "@/services/prospect-audit-email";

export interface Completion {
  onComplete: (db: Db, scanId: string, result: ScanResult) => Promise<void>;
  onFailed: (db: Db, scanId: string, reason: string) => Promise<void>;
}

async function practiceOf(db: Db, scanId: string): Promise<string> {
  const [scan] = await db.select({ practiceId: scans.practiceId }).from(scans).where(eq(scans.id, scanId));
  return scan.practiceId;
}

const prospect = { notify: sendProspectAlert, sendAudit: sendProspectReportFor };

const nothing: Completion = { onComplete: async () => undefined, onFailed: async () => undefined };

/**
 * What happens once a scan's last step finishes, by what the scan is for. The
 * function that started the scan is long gone by then, so this is the only
 * place that work can live.
 */
export function completionFor(purpose: ScanPurpose): Completion {
  switch (purpose) {
    case "weekly":
      return { onComplete: (db, scanId, result) => weeklyComplete(db, scanId, result), onFailed: async () => undefined };
    case "prospect":
      return {
        onComplete: async (db, scanId, result) => finishProspect(db, await practiceOf(db, scanId), result, prospect),
        onFailed: async (db, scanId, reason) => finishProspect(db, await practiceOf(db, scanId), { error: reason }, prospect),
      };
    default:
      return nothing;
  }
}

/**
 * Fails every scan still "running" with no progress for longer than any step
 * could take: its chain broke (a step killed at the time limit, a handoff
 * that never ran) and nothing else will ever finish it. Whatever waits on it
 * is told, so a lead never sits in "preparing" forever. Returns how many
 * scans it closed. Cheap, and run wherever scans are touched, since the
 * Hobby plan's crons run at most daily.
 */
export async function sweepStuckScans(
  db: Db, completion: (purpose: ScanPurpose) => Completion = completionFor,
): Promise<number> {
  const stuck = await db.update(scans).set({ status: "failed", finishedAt: new Date() })
    .where(and(eq(scans.status, "running"), lt(scans.updatedAt, new Date(Date.now() - SCAN_STUCK_AFTER_MS))))
    .returning({ id: scans.id, practiceId: scans.practiceId, purpose: scans.purpose });
  for (const s of stuck) {
    await logActivity(db, s.practiceId, "scan failed: it stopped without finishing");
    await completion(s.purpose as ScanPurpose).onFailed(db, s.id, "it stopped without finishing").catch(() => undefined);
  }
  return stuck.length;
}
