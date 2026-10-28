"use server";

import { auth, requirePracticeAccess } from "@/lib/auth";
import { getDb } from "@/db";
import { isPlan, PLAN_LABELS } from "@/core/plan";
import { PLAN_OFFERS } from "@/core/plan-offer";
import { createSupportRequest } from "@/services/support";
import { ADMIN_READ_ONLY_MESSAGE, isAdminViewer } from "@/lib/admin-view";

export interface StartPlanState {
  status: "idle" | "sent" | "error";
  message?: string;
}

/**
 * "Start Pulse" or "Start Partner" from the dashboard's plans page. Billing
 * isn't connected, so this files the request in the support queue (stored
 * first, then emailed to us with a receipt to them) and we set the plan up by
 * hand. An operator viewing the dashboard can't start one for the customer.
 */
export async function startPlan(slug: string, _prev: StartPlanState, formData: FormData): Promise<StartPlanState> {
  const practice = await requirePracticeAccess(slug);
  const session = await auth();
  if (isAdminViewer(session?.user?.role)) return { status: "error", message: ADMIN_READ_ONLY_MESSAGE };
  const email = session?.user?.email;
  if (!email) return { status: "error", message: "Sign in again, then try once more." };
  const plan = formData.get("plan");
  if (!isPlan(plan)) return { status: "error", message: "Pick a plan." };
  const offer = PLAN_OFFERS.find(o => o.plan === plan)!;

  try {
    await createSupportRequest(getDb(), {
      practiceId: practice.id,
      userId: session.user.id ?? null,
      email,
      topic: "start_plan",
      message: `${practice.name} wants to start ${PLAN_LABELS[plan]} (${offer.amt} a month, first month free). Current plan: ${practice.plan ? PLAN_LABELS[practice.plan] : "free audit"}.`,
    });
  } catch {
    return { status: "error", message: "We couldn't send that just now. Please try again." };
  }
  return { status: "sent", message: `You're on the list for ${PLAN_LABELS[plan]}. We'll email ${email} within one business day to get you set up, and your first month is free.` };
}
