import { describe, it, expect } from "vitest";
import { confirmedByScan, fixAdvice, fixProgress, fixState, storedFor, supersededIds } from "@/core/fix-list";

const row = (id: string, status: "open" | "fixed" | "verified" | "dismissed", factId: string | null, claim = "Open Sundays") =>
  ({ id, status, factId, claim });

describe("fix list states", () => {
  it("reads the customer-facing state from the stored status and whether work has started", () => {
    expect(fixState({ status: "open", workStartedAt: null })).toBe("todo");
    expect(fixState({ status: "open", workStartedAt: new Date() })).toBe("in_progress");
    expect(fixState({ status: "fixed", workStartedAt: null })).toBe("fixed");
    expect(fixState({ status: "verified", workStartedAt: null })).toBe("confirmed");
    expect(fixState({ status: "dismissed", workStartedAt: new Date() })).toBe("dismissed");
  });

  it("keeps an in-progress fact open, because AI is still saying it", () => {
    expect(storedFor("in_progress")).toEqual({ status: "open", started: true });
    expect(storedFor("todo")).toEqual({ status: "open", started: false });
    expect(storedFor("fixed").status).toBe("fixed");
    expect(storedFor("confirmed").status).toBe("verified");
  });
});

describe("fixAdvice", () => {
  it("points at the business's own site first when AI read it there", () => {
    const fix = fixAdvice(["https://www.harbor.example/hours", "https://yelp.com/biz/harbor"], "harbor.example");
    expect(fix.onOwnSite).toBe(true);
    expect(fix.sources).toEqual(["harbor.example", "yelp.com"]);
    expect(fix.advice).toContain("your own website first");
  });

  it("names the outside site to ask, or falls back when the tool cited nothing", () => {
    expect(fixAdvice(["https://yelp.com/biz/harbor"], "https://harbor.example").advice).toBe(
      "Ask yelp.com to correct it, and state the right version on your site.");
    expect(fixAdvice([], null).advice).toBe("State the correct version plainly on your website so AI has it.");
    expect(fixAdvice(["not a url", "ftp://x.example/a"], null).sources).toEqual([]);
  });
});

describe("fixProgress", () => {
  it("counts fixed and confirmed as done and leaves dismissed facts out", () => {
    const p = fixProgress(["todo", "todo", "todo", "in_progress", "fixed", "confirmed", "confirmed", "dismissed"]);
    expect(p).toMatchObject({ total: 7, todo: 3, inProgress: 1, fixed: 1, confirmed: 2, percentDone: 43 });
    expect(p.sentence).toBe("7 wrong facts: 3 fixed, 1 in progress, 3 to do.");
  });

  it("reads naturally for one fact and for none", () => {
    expect(fixProgress(["todo"]).sentence).toBe("1 wrong fact: 1 to do.");
    expect(fixProgress([]).sentence).toBe("No wrong facts found.");
    expect(fixProgress(["dismissed"]).total).toBe(0);
  });
});

describe("supersededIds", () => {
  it("hides a fixed fact that came back as a new open one, and nothing else", () => {
    const stale = supersededIds([
      row("old", "fixed", "fact-1"), row("new", "open", "fact-1"),
      row("other-fixed", "fixed", "fact-2"), row("done", "verified", "fact-1"),
    ]);
    expect([...stale]).toEqual(["old"]);
  });
});

describe("confirmedByScan", () => {
  it("confirms a fixed fact the scan did not see again", () => {
    expect(confirmedByScan([row("a", "fixed", "fact-1"), row("b", "fixed", "fact-2")], [{ factId: "fact-2", claim: "x" }], 5)).toEqual(["a"]);
  });

  it("confirms nothing when the scan checked no answers", () => {
    expect(confirmedByScan([row("a", "fixed", "fact-1")], [], 0)).toEqual([]);
  });

  it("does not confirm while the same mistake is open, or still said in the same words", () => {
    expect(confirmedByScan([row("a", "fixed", "fact-1"), row("b", "open", "fact-1")], [], 5)).toEqual([]);
    // An older finding saved without a fact, and AI still says it, now tied to a fact.
    expect(confirmedByScan([row("legacy", "fixed", null, "Open Sundays!")], [{ factId: "fact-9", claim: "open sundays" }], 5)).toEqual([]);
  });

  it("leaves open, confirmed and dismissed facts alone", () => {
    expect(confirmedByScan([row("a", "open", "f1"), row("b", "verified", "f2"), row("c", "dismissed", "f3")], [], 5)).toEqual([]);
  });
});
