"use server";

import { revalidatePath } from "next/cache";
import { auth, requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { setTick } from "@/services/action-ticks";
import { loadActionPlan } from "@/lib/action-plan";
import { ADMIN_READ_ONLY_MESSAGE, isAdminViewer } from "@/lib/admin-view";

export interface TickState {
  /** Whether the item is ticked off now. */
  done: boolean;
  error?: string;
}

/**
 * Ticks an action plan item off, or back on. Anyone who can see the business
 * may tick, a free account included, since the whole plan is theirs. An
 * operator viewing the dashboard can't: the ticks are the customer's own.
 * Only a step in the business's current plan can be ticked or unticked;
 * anything else posted is ignored, so no stray rows are saved. Works as a
 * plain form post too, so a box ticks without any script.
 */
export async function toggleTick(slug: string, prev: TickState, formData: FormData): Promise<TickState> {
  const { practice } = await requirePracticeView(slug);
  const session = await auth();
  if (isAdminViewer(session?.user?.role)) return { done: prev.done, error: ADMIN_READ_ONLY_MESSAGE };
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return { done: prev.done };
  const db = getDb();
  const done = formData.get("done") === "1";
  try {
    // The plan's steps only; whether each is ticked doesn't matter here.
    const loaded = await loadActionPlan(db, practice.id, { ticks: false });
    if (!loaded?.plan.groups.some(g => g.items.some(i => i.key === key))) return { done: prev.done };
    await setTick(db, practice.id, key, done, session?.user?.id);
  } catch {
    return { done: prev.done, error: "We couldn't save that just now. Please try again." };
  }
  revalidatePath(`/dashboard/${slug}/fixes`);
  return { done };
}
