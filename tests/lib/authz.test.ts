import { describe, it, expect } from "vitest";
import { canAccessPractice, isPreviewOnly } from "@/lib/auth";

describe("canAccessPractice", () => {
  it("operator sees everything", () =>
    expect(canAccessPractice({ role: "operator", memberPracticeIds: [] }, "b1")).toBe(true));
  it("client sees only member practices", () => {
    expect(canAccessPractice({ role: "client", memberPracticeIds: ["b1"] }, "b1")).toBe(true);
    expect(canAccessPractice({ role: "client", memberPracticeIds: ["b1"] }, "b2")).toBe(false);
  });
});

describe("isPreviewOnly", () => {
  it("holds a paused business to the summary until the operator unlocks it", () => {
    expect(isPreviewOnly({ active: false, dashboardUnlocked: false })).toBe(true);
    expect(isPreviewOnly({ active: false, dashboardUnlocked: true })).toBe(false);
  });
  it("never locks an active business, whatever the unlock switch says", () => {
    expect(isPreviewOnly({ active: true, dashboardUnlocked: false })).toBe(false);
    expect(isPreviewOnly({ active: true, dashboardUnlocked: true })).toBe(false);
  });
});
