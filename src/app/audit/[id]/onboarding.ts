import type { AuditStage } from "@/services/audit-progress";

/**
 * Where a visitor is in the steps they take while their audit runs:
 * their details, then a login, then the optional call, then a short wait
 * for the result, which opens in their dashboard.
 */
export type OnboardingStep = "details" | "login" | "call" | "waiting" | "has-login" | "stopped";

/**
 * The step to show, from what is already on file. Nothing here is taken on
 * trust from the address: `stepParam` only chooses between the call and the
 * wait, and only for someone signed in to this business.
 */
export function onboardingStep(args: {
  stage: AuditStage;
  hasEmail: boolean;
  /** The business already has a client login. */
  hasLogin: boolean;
  /** The person looking is signed in as a member of this business. */
  signedInAsMember: boolean;
  stepParam?: string;
  hasCalendly: boolean;
}): OnboardingStep {
  // An audit that didn't start, or broke, has nothing to sign up for yet.
  if (args.stage === "failed" || args.stage === "not-started") return "stopped";
  if (args.signedInAsMember) return args.stepParam === "call" && args.hasCalendly ? "call" : "waiting";
  if (args.hasLogin) return "has-login";
  return args.hasEmail ? "login" : "details";
}
