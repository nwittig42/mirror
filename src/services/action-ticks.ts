import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { actionTicks } from "@/db/schema";

/**
 * Which action plan items a business has ticked off. A tick is one row per
 * practice and item key; unticking deletes it.
 */

export async function getTicks(db: Db, practiceId: string): Promise<Set<string>> {
  const rows = await db.select({ itemKey: actionTicks.itemKey }).from(actionTicks)
    .where(eq(actionTicks.practiceId, practiceId));
  return new Set(rows.map(r => r.itemKey));
}

export async function setTick(db: Db, practiceId: string, itemKey: string, done: boolean, userId?: string): Promise<void> {
  if (done) {
    // Ticking an item already ticked keeps the first tick.
    await db.insert(actionTicks).values({ practiceId, itemKey, doneBy: userId ?? null }).onConflictDoNothing();
  } else {
    await db.delete(actionTicks).where(and(eq(actionTicks.practiceId, practiceId), eq(actionTicks.itemKey, itemKey)));
  }
}
