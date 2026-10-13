/** The paid plans a business can be on. Null (no plan) is a prospect or a free audit. */
export type Plan = "pulse" | "partner";

export const PLANS: Plan[] = ["pulse", "partner"];

export const PLAN_LABELS: Record<Plan, string> = { pulse: "Pulse", partner: "Partner" };

export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && (PLANS as string[]).includes(value);
}
