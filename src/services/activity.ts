import type { Db } from "@/db";
import { activities, activityVisibilityEnum } from "@/db/schema";

export type ActivityVisibility = (typeof activityVisibilityEnum.enumValues)[number];

/**
 * Records a practice-scoped activity-log entry.
 *
 * Defaults to `internal`, the operator's diagnostic trail. Publishing a line
 * to the client's work log is opt-in per call site, so a warning added in some
 * future code path cannot reach a client by accident.
 */
export async function logActivity(
  db: Db,
  practiceId: string,
  description: string,
  visibility: ActivityVisibility = "internal",
): Promise<void> {
  await db.insert(activities).values({ practiceId, description, visibility });
}
