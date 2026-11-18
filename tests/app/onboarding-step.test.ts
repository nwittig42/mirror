import { describe, it, expect } from "vitest";
import { onboardingStep } from "@/app/audit/[id]/onboarding";

const base = { stage: "asking" as const, hasEmail: false, hasLogin: false, signedInAsMember: false, hasCalendly: true };

describe("onboardingStep", () => {
  it("starts at details", () => {
    expect(onboardingStep(base)).toBe("details");
  });

  it("goes to the login once the email is in", () => {
    expect(onboardingStep({ ...base, hasEmail: true })).toBe("login");
  });

  it("offers the login on an old link whose audit is ready", () => {
    expect(onboardingStep({ ...base, stage: "done", hasEmail: true })).toBe("login");
  });

  it("shows the call after signing up", () => {
    expect(onboardingStep({ ...base, hasEmail: true, hasLogin: true, signedInAsMember: true, stepParam: "call" })).toBe("call");
  });

  it("skips the call with no scheduling link", () => {
    expect(onboardingStep({ ...base, hasEmail: true, hasLogin: true, signedInAsMember: true, stepParam: "call", hasCalendly: false }))
      .toBe("waiting");
  });

  it("waits after the call step", () => {
    expect(onboardingStep({ ...base, hasEmail: true, hasLogin: true, signedInAsMember: true, stepParam: "done" })).toBe("waiting");
  });

  it("waits when a signed-in visitor comes back to the link", () => {
    expect(onboardingStep({ ...base, stage: "done", hasEmail: true, hasLogin: true, signedInAsMember: true })).toBe("waiting");
  });

  it("points a returning visitor with a login at the login page", () => {
    expect(onboardingStep({ ...base, hasEmail: true, hasLogin: true })).toBe("has-login");
  });

  it("never offers the call to someone who isn't signed in, whatever the address says", () => {
    expect(onboardingStep({ ...base, hasEmail: true, stepParam: "call" })).toBe("login");
    expect(onboardingStep({ ...base, stepParam: "done" })).toBe("details");
  });

  it.each(["failed", "not-started"] as const)("stops at details when the audit is %s", stage => {
    expect(onboardingStep({ ...base, stage })).toBe("stopped");
    expect(onboardingStep({ ...base, stage, hasEmail: true, hasLogin: true, signedInAsMember: true, stepParam: "call" })).toBe("stopped");
  });
});
