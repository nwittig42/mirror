import { and, eq, ne, or, sql, type SQL } from "drizzle-orm";
import { scans } from "@/db/schema";

/**
 * The purpose of the quick first look a new audit runs before its full scan:
 * two tools, each question asked once. It stands in for the full scan only
 * until one exists.
 */
export const QUICK_PURPOSE = "quick";

/** A practice's complete scans that are not quick looks. What reports and emails are built from. */
export function fullScanWhere(practiceId: string): SQL {
  return and(eq(scans.practiceId, practiceId), eq(scans.status, "complete"), ne(scans.purpose, QUICK_PURPOSE))!;
}

/**
 * A practice's complete scans as its dashboard shows them: a quick look
 * counts only while no full scan is complete. After that it is left out of
 * the latest scan, the history and the trends, so the full audit never reads
 * as a change against the quick one.
 */
export function shownScanWhere(practiceId: string): SQL {
  const hasFull = sql`exists (select 1 from scans full_scan where full_scan.practice_id = ${practiceId} and full_scan.status = 'complete' and full_scan.purpose <> ${QUICK_PURPOSE})`;
  return and(
    eq(scans.practiceId, practiceId),
    eq(scans.status, "complete"),
    or(ne(scans.purpose, QUICK_PURPOSE), sql`not ${hasFull}`),
  )!;
}
