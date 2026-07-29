import type { Db } from "@/db";
import { activities } from "@/db/schema";

/** Records a practice-scoped activity-log entry (scan results, warnings, etc). */
export async function logActivity(db: Db, practiceId: string, description: string): Promise<void> {
  await db.insert(activities).values({ practiceId, description });
}
