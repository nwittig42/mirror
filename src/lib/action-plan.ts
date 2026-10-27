import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { nameVariations, practices } from "@/db/schema";
import { buildActionPlan, type ActionPlan } from "@/core/action-plan";
import { buildSourcesReport } from "@/core/citations";
import { buildSearchReport } from "@/core/search-queries";
import { getChecksForScan, getLatestScan } from "@/lib/queries";
import { getTicks } from "@/services/action-ticks";

/**
 * The action plan for a practice's latest complete scan, with the items it
 * has ticked off. Reads stored data only: the website check is the one saved
 * on the scan, never run here. Null until a scan has finished.
 */
export async function loadActionPlan(
  db: Db, practiceId: string,
): Promise<{ plan: ActionPlan; ticks: Set<string>; scanDate: Date } | null> {
  const scan = await getLatestScan(db, practiceId);
  if (!scan) return null;
  const [[practice], variations, rows, ticks] = await Promise.all([
    db.select().from(practices).where(eq(practices.id, practiceId)),
    db.select().from(nameVariations).where(eq(nameVariations.practiceId, practiceId)),
    getChecksForScan(db, scan.id),
    getTicks(db, practiceId),
  ]);
  const checks = rows.filter(c => c.promptKind !== "branded");
  const plan = buildActionPlan({
    checks,
    sources: buildSourcesReport(checks, practice.website),
    search: buildSearchReport(checks),
    websiteCheck: scan.websiteCheck ?? null,
    website: practice.website,
    names: Array.from(new Set([practice.name, ...variations.map(v => v.text)])),
  });
  return { plan, ticks, scanDate: scan.startedAt };
}
