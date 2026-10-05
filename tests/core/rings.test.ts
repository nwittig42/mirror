import { describe, it, expect } from "vitest";
import { ringDash } from "@/components/score-rings";

describe("ringDash", () => {
  const circ = 2 * Math.PI * 40;
  it("fills the ring to the score's share of 100", () => {
    const [filled, gap] = ringDash(25, 40).split(" ").map(Number);
    expect(filled).toBeCloseTo(circ * 0.25, 1);
    expect(filled + gap).toBeCloseTo(circ, 1);
  });
  it("draws nothing for a missing score and caps at a full ring", () => {
    expect(Number(ringDash(null, 40).split(" ")[0])).toBe(0);
    expect(Number(ringDash(140, 40).split(" ")[0])).toBeCloseTo(circ, 1);
  });
});
