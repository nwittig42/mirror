import { describe, it, expect } from "vitest";
import { namesakeVeto, parseToneOutput, summarizeTone } from "@/core/tone";

describe("parseToneOutput", () => {
  it("reads a fenced array", () => {
    // Spec section 2: a rater that omits the namesake fields yields
    // sameBusiness null, so the guard never fires on its say-so.
    expect(parseToneOutput('```json\n[{"tone":"mixed","reason":"Good, but long waits."}]\n```'))
      .toEqual({ tone: "mixed", reason: "Good, but long waits.", sameBusiness: null, evidence: null });
  });
  it("rejects an unknown tone", () => {
    expect(() => parseToneOutput('[{"tone":"great","reason":"x"}]')).toThrow();
  });
  it("reads the namesake fields when the rater returns them", () => {
    expect(parseToneOutput('[{"tone":"positive","reason":"Recommended","same_business":false,"evidence":" in Denver, CO "}]'))
      .toEqual({ tone: "positive", reason: "Recommended", sameBusiness: false, evidence: "in Denver, CO" });
    expect(parseToneOutput('[{"tone":"neutral","reason":"Listed","same_business":true,"evidence":null}]'))
      .toMatchObject({ sameBusiness: true, evidence: null });
    expect(parseToneOutput('[{"tone":"neutral","reason":"Listed","same_business":null}]'))
      .toMatchObject({ sameBusiness: null, evidence: null });
  });
  it("treats an empty evidence string as none", () => {
    expect(parseToneOutput('[{"tone":"neutral","reason":"Listed","same_business":false,"evidence":"  "}]').evidence).toBeNull();
  });
});

describe("namesakeVeto", () => {
  const names = ["Harbor Plumbing", "Harbor Plumbing LLC"];
  const denver = { tone: "positive" as const, reason: "Recommended", sameBusiness: false, evidence: "in Denver, CO" };
  const answer = "Harbor Plumbing is a well-reviewed plumber in Denver, CO. Call them for drain work.";
  const portland = "Portland, OR";

  it("fires when every condition holds, returning the evidence", () => {
    expect(namesakeVeto({ answer, practiceNames: names, location: portland, rating: denver })).toBe("in Denver, CO");
  });

  it("needs a location on record", () => {
    expect(namesakeVeto({ answer, practiceNames: names, location: null, rating: denver })).toBeNull();
    expect(namesakeVeto({ answer, practiceNames: names, location: undefined, rating: denver })).toBeNull();
    expect(namesakeVeto({ answer, practiceNames: names, location: "   ", rating: denver })).toBeNull();
  });

  it("needs the rater to say false", () => {
    expect(namesakeVeto({ answer, practiceNames: names, location: portland, rating: { ...denver, sameBusiness: true } })).toBeNull();
    expect(namesakeVeto({ answer, practiceNames: names, location: portland, rating: { ...denver, sameBusiness: null } })).toBeNull();
    expect(namesakeVeto({ answer, practiceNames: names, location: portland, rating: { tone: "positive", reason: "x" } })).toBeNull();
    expect(namesakeVeto({ answer, practiceNames: names, location: portland, rating: null })).toBeNull();
  });

  it("needs the evidence to be in the answer", () => {
    expect(namesakeVeto({ answer, practiceNames: names, location: portland, rating: { ...denver, evidence: "in Boise, ID" } })).toBeNull();
    expect(namesakeVeto({ answer, practiceNames: names, location: portland, rating: { ...denver, evidence: null } })).toBeNull();
    expect(namesakeVeto({ answer, practiceNames: names, location: portland, rating: { ...denver, evidence: "" } })).toBeNull();
  });

  it("finds the evidence across whitespace and case differences", () => {
    const wrapped = "Harbor Plumbing is a well-reviewed plumber\nin   Denver,\nCO.";
    expect(namesakeVeto({ answer: wrapped, practiceNames: names, location: portland, rating: { ...denver, evidence: "IN DENVER, co" } }))
      .toBe("IN DENVER, co");
  });

  it("does not fire when the sentence naming the business names the city", () => {
    const both = "Harbor Plumbing serves Portland and has a second crew in Denver, CO. Prices are fair.";
    expect(namesakeVeto({ answer: both, practiceNames: names, location: portland, rating: denver })).toBeNull();
    // The city is the part of the location before the first comma, matched case-insensitively.
    const shouted = "harbor plumbing of PORTLAND also works in Denver, CO.";
    expect(namesakeVeto({ answer: shouted, practiceNames: names, location: portland, rating: denver })).toBeNull();
  });

  it("keeps the mention when any sentence naming the business names the city", () => {
    const later = "Harbor Plumbing is based in Denver, CO. Harbor Plumbing also serves Portland on weekdays.";
    expect(namesakeVeto({ answer: later, practiceNames: names, location: portland, rating: denver })).toBeNull();
  });

  it("looks only at the sentences that name the business", () => {
    const apart = "Harbor Plumbing is a Denver, CO outfit. Portland has other options.";
    expect(namesakeVeto({ answer: apart, practiceNames: names, location: portland, rating: { ...denver, evidence: "Denver, CO" } }))
      .toBe("Denver, CO");
    const listed = "Options:\n- Harbor Plumbing: based in Denver, CO\n- Portland Drain Pros: local";
    expect(namesakeVeto({ answer: listed, practiceNames: names, location: portland, rating: { ...denver, evidence: "based in Denver, CO" } }))
      .toBe("based in Denver, CO");
  });

  it("does nothing when the business is not named", () => {
    expect(namesakeVeto({ answer: "Roto-Rooter in Denver, CO is fine.", practiceNames: names, location: portland, rating: denver })).toBeNull();
  });

  // Review finding #11: the guard must see the same known names as the
  // record phase. "Harbor Plumbing and Rose City Plumbing" is one longer
  // business name until Rose City Plumbing is passed as `others`; then it is
  // a list of two, the occurrence is found and the veto can fire.
  it("fires on '<namesake> and <known competitor>' once the competitor is passed as others", () => {
    const listed = "Harbor Plumbing & Rose City Plumbing serve Denver, CO. Harbor charges $49 per call.";
    const rating = { ...denver, evidence: "serve Denver, CO" };
    expect(namesakeVeto({ answer: listed, practiceNames: names, location: portland, rating, others: ["Rose City Plumbing"] }))
      .toBe("serve Denver, CO");
    // Without the competitor list there is no occurrence to judge, so the
    // rater's opinion is ignored: this is why the scan runner passes it.
    expect(namesakeVeto({ answer: listed, practiceNames: names, location: portland, rating })).toBeNull();
    expect(namesakeVeto({ answer: listed, practiceNames: names, location: portland, rating, others: [] })).toBeNull();
  });

  it("still does not fire for a longer name or an unknown continuation, even with others", () => {
    const others = ["Rose City Plumbing"];
    const rating = { ...denver, evidence: "Denver, CO" };
    // A longer business name that starts with the client's is not the client.
    expect(namesakeVeto({ answer: "Harbor Plumbing & Heating serves Denver, CO.", practiceNames: names, location: portland, rating, others }))
      .toBeNull();
    // A continuation that is not a known name may still be a longer name.
    expect(namesakeVeto({ answer: "Harbor Plumbing and Drain Masters serve Denver, CO.", practiceNames: names, location: portland, rating, others }))
      .toBeNull();
    // The city rule is unchanged: the naming sentence names Portland.
    expect(namesakeVeto({
      answer: "Harbor Plumbing and Rose City Plumbing serve Portland and Denver, CO.",
      practiceNames: names, location: portland, rating, others,
    })).toBeNull();
  });
});

describe("summarizeTone", () => {
  it("counts rated mentions only and lists concerns worst first", () => {
    const s = summarizeTone([
      { mentioned: true, tone: "positive", toneReason: "Top pick" },
      { mentioned: true, tone: "mixed", toneReason: "Pricey" },
      { mentioned: true, tone: "negative", toneReason: "Bad reviews" },
      { mentioned: true, tone: null, toneReason: null },
      { mentioned: false, tone: "positive", toneReason: "ignored" },
    ]);
    expect(s.rated).toBe(3);
    expect(s.counts).toEqual({ positive: 1, neutral: 0, mixed: 1, negative: 1 });
    expect(s.concerns.map(c => c.reason)).toEqual(["Bad reviews", "Pricey"]);
  });
});
