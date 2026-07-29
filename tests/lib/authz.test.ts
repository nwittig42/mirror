import { describe, it, expect } from "vitest";
import { canAccessPractice } from "@/lib/auth";

describe("canAccessPractice", () => {
  it("operator sees everything", () =>
    expect(canAccessPractice({ role: "operator", memberPracticeIds: [] }, "b1")).toBe(true));
  it("client sees only member practices", () => {
    expect(canAccessPractice({ role: "client", memberPracticeIds: ["b1"] }, "b1")).toBe(true);
    expect(canAccessPractice({ role: "client", memberPracticeIds: ["b1"] }, "b2")).toBe(false);
  });
});
