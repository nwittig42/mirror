import { describe, it, expect } from "vitest";
import { changeWords, shareForecast } from "@/core/share-forecast";

const c = (mentioned: boolean, competitors: string[], promptKind = "category") => ({ promptKind, mentioned, competitorsMentioned: competitors });

describe("shareForecast", () => {
  it("measures today's share from buyer answers and adds three quarters of the answers lost to a competitor", () => {
    // 10 buyer answers: named in 2, a competitor instead in 6, nobody in 2. A branded one is left out.
    const checks = [
      c(true, []), c(true, ["A"]),
      ...Array.from({ length: 4 }, () => c(false, ["A"])), c(false, ["B"]), c(false, ["B"]),
      c(false, []), c(false, []),
      c(true, ["A"], "branded"),
    ];
    const f = shareForecast(checks)!;
    expect(f.answers).toBe(10);
    expect(f.now).toBe(20);
    expect(f.then).toEqual({ low: 50, likely: 65, high: 74 });
    expect(f.competitors[0]).toEqual({ name: "A", share: 50 });
    expect(f.rankNow).toBe(2);
    // Ahead of A at 50%, so first place.
    expect(f.rankThen).toBe(1);
  });

  it("is null with no buyer answers", () => {
    expect(shareForecast([c(true, [], "branded")])).toBeNull();
  });
});

describe("changeWords", () => {
  it("says the change in words, never a bare percentage jump", () => {
    expect(changeWords(22, 45)).toBe("more than twice as often");
    expect(changeWords(10, 35)).toBe("about 3 times as often");
    expect(changeWords(20, 30)).toBe("about half again as often");
    expect(changeWords(40, 50)).toBe("about 25% more often");
    expect(changeWords(30, 30)).toBeNull();
  });
});
