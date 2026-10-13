import { describe, it, expect } from "vitest";
import {
  detectMention, detectNames, extractSnippet, findAllMatches, findAllMentions, findMatches, findMentions,
  highlightRanges, mentionKind, nameTokens,
} from "@/core/mention";

describe("detectMention", () => {
  it("matches case-insensitively", () =>
    expect(detectMention("I recommend GLOW medspa.", ["Glow MedSpa"])).toBe(true));
  it("matches any variation", () =>
    expect(detectMention("Dr. Kim's clinic is popular", ["Glow MedSpa", "Dr. Kim"])).toBe(true));
  it("requires word boundaries (no substring false positives)", () =>
    expect(detectMention("The glowing reviews mention nothing", ["Glow"])).toBe(false));
  it("tolerates punctuation and possessives", () =>
    expect(detectMention("Try Glow MedSpa's injectors.", ["Glow MedSpa"])).toBe(true));
  it("handles markdown bold", () =>
    expect(detectMention("1. **Glow MedSpa** – Santa Monica", ["Glow MedSpa"])).toBe(true));
});

describe("detectMention tolerant matching", () => {
  it("drops a trailing legal suffix when two distinctive tokens remain", () => {
    expect(detectMention("Harbor Plumbing is well reviewed.", ["Harbor Plumbing LLC"])).toBe(true);
    expect(detectMention("Harbor Plumbing is well reviewed.", ["Harbor Plumbing, L.L.C."])).toBe(true);
    expect(detectMention("Harbor Plumbing is well reviewed.", ["Harbor Plumbing Inc."])).toBe(true);
    expect(detectMention("John Smith is well reviewed.", ["John Smith, DDS, PC"])).toBe(true);
    expect(detectMention("Harbor Plumbing LLC is well reviewed.", ["Harbor Plumbing"])).toBe(true);
  });

  it("keeps the suffix when only one distinctive token would remain", () => {
    expect(detectMention("The best place for pasta is downtown.", ["The Pasta Co"])).toBe(false);
    expect(detectMention("Try The Pasta Co. on Main Street.", ["The Pasta Co"])).toBe(true);
    expect(detectMention("Try Pasta Co downtown.", ["The Pasta Co"])).toBe(true);
    expect(detectMention("Ava is a common name.", ["Ava MD"])).toBe(false);
    expect(detectMention("Ava MD is a dermatologist.", ["Ava MD"])).toBe(true);
    expect(detectMention("Kim is a common name.", ["Kim MD"])).toBe(false);
    expect(detectMention("Dr. Kim MD is a dermatologist.", ["Kim MD"])).toBe(true);
  });

  it("tolerates a missing, added or curly apostrophe", () => {
    expect(detectMention("Joes Pizza is the best slice.", ["Joe's Pizza"])).toBe(true);
    expect(detectMention("Joe's Pizza is the best slice.", ["Joes Pizza"])).toBe(true);
    expect(detectMention("Joes' Pizza is the best slice.", ["Joe's Pizza"])).toBe(true);
    expect(detectMention("Joe’s Pizza is the best slice.", ["Joe's Pizza"])).toBe(true);
    expect(detectMention("Joe's Pizza is the best slice.", ["Joe Pizza"])).toBe(true);
    expect(detectMention("Joe Pizza is the best slice.", ["Joe's Pizza"])).toBe(false);
  });

  it("splits a name on its inner case boundary and allows up to four non-alphanumerics between tokens", () => {
    for (const text of ["Skin Lab", "Skin-Lab", "Skin & Lab", "SkinLab", "SKINLAB", "Skin, Lab"]) {
      expect(detectMention(`${text} is popular.`, ["SkinLab"]), text).toBe(true);
    }
    expect(detectMention("SkinLab is popular.", ["Skin Lab"])).toBe(true);
    expect(detectMention("Skin ---- Lab is popular.", ["SkinLab"])).toBe(false);
  });

  it("keeps an all-caps name as one token", () => {
    expect(detectMention("NakedMD is in Santa Monica.", ["NAKEDMD"])).toBe(true);
    expect(detectMention("Naked MD is in Santa Monica.", ["NAKEDMD"])).toBe(false);
    expect(detectMention("NAKEDMD is in Santa Monica.", ["Naked MD"])).toBe(true);
  });

  it("splits a lower-to-upper boundary even after a single letter", () => {
    expect(detectMention("The iphone repair shop downtown.", ["iPhone Repair"])).toBe(true);
    expect(detectMention("The i-Phone repair shop downtown.", ["iPhone Repair"])).toBe(true);
  });

  it("makes a leading article optional", () => {
    expect(detectMention("Rusty Anchor has great fish and chips.", ["The Rusty Anchor"])).toBe(true);
    expect(detectMention("The Rusty Anchor has great fish and chips.", ["The Rusty Anchor"])).toBe(true);
    expect(detectMention("The Rusty Anchor has great fish and chips.", ["Rusty Anchor"])).toBe(true);
    expect(detectMention("A Cut Above is the best barber.", ["A Cut Above"])).toBe(true);
    expect(detectMention("Cut Above is the best barber.", ["A Cut Above"])).toBe(true);
  });

  it("requires every generic token", () => {
    expect(detectMention("Main Street Dental Associates is the top choice.", ["Main Street Dental Group"])).toBe(false);
    expect(detectMention("Main Street Dental Group is the top choice.", ["Main Street Dental Group"])).toBe(true);
    expect(detectMention("Glow is the top choice.", ["Glow MedSpa"])).toBe(false);
  });

  it("never matches inside a longer word", () => {
    expect(detectMention("The glowing reviews mention nothing", ["Glow"])).toBe(false);
    expect(detectMention("SkinLabs is a chain.", ["SkinLab"])).toBe(false);
    expect(detectMention("Harbor Plumbings is a chain.", ["Harbor Plumbing"])).toBe(false);
    expect(detectMention("Reglow is a chain.", ["Glow"])).toBe(false);
  });

  it("uses Unicode letters and digits as boundaries", () => {
    expect(detectMention("Café Lumière's injectors are great.", ["Café Lumière"])).toBe(true);
    expect(detectMention("CAFÉ LUMIÈRE is great.", ["Café Lumière"])).toBe(true);
    expect(detectMention("Lumières are great.", ["Lumière"])).toBe(false);
    expect(detectMention("éGlow is great.", ["Glow"])).toBe(false);
    expect(detectMention("Glow2 is great.", ["Glow"])).toBe(false);
    expect(detectMention("Call 7-Eleven or 7 Eleven.", ["7-Eleven"])).toBe(true);
  });

  it("never matches a variation with nothing distinctive left", () => {
    expect(detectMention("The LLC is registered.", ["LLC"])).toBe(false);
    expect(detectMention("The LLC is registered.", ["The"])).toBe(false);
    expect(detectMention("The LLC is registered.", [""])).toBe(false);
    expect(detectMention("The LLC is registered.", ["  , "])).toBe(false);
    expect(detectMention("The Co is registered.", ["The Co"])).toBe(false);
    expect(detectMention("The LLC is registered.", [])).toBe(false);
    expect(detectMention("Smith & Co is registered.", ["&"])).toBe(false);
  });

  it("reads &, + and the word and as the same conjunction", () => {
    expect(detectMention("Crumb and Crust Bakery is the best.", ["Crumb & Crust Bakery"])).toBe(true);
    expect(detectMention("Smith and Associates handles DUI cases.", ["Smith & Associates"])).toBe(true);
    expect(detectMention("Crumb & Crust Bakery is best.", ["Crumb and Crust Bakery"])).toBe(true);
    expect(detectMention("Crumb + Crust Bakery is best.", ["Crumb and Crust Bakery"])).toBe(true);
    expect(detectMention("Smith & Associates handles DUI cases.", ["Smith and Associates"])).toBe(true);
    // The conjunction is never required: the separator rule still joins the words.
    expect(detectMention("Crumb Crust Bakery is best.", ["Crumb & Crust Bakery"])).toBe(true);
    expect(detectMention("SkinLab is popular.", ["Skin & Lab"])).toBe(true);
    // The word needs its own boundaries.
    expect(detectMention("The sandwich shop is popular.", ["S & Wich"])).toBe(false);
    // The conjunction is not distinctive, so a one-word name keeps its suffix.
    expect(detectMention("Crumb & Sons is best.", ["Crumb & Co"])).toBe(false);
    expect(detectMention("Pasta & Vino is best.", ["Pasta & Co"])).toBe(false);
    expect(detectMention("Crumb & Co is best.", ["Crumb & Co"])).toBe(true);
    // The longer-name guard still reads the conjunction.
    expect(detectMention("Smith & Associates and Partners is good.", ["Smith and Associates"])).toBe(false);
    expect(detectMention("I couldn't find any information about Smith and Associates.", ["Smith & Associates"])).toBe(false);
    expect(mentionKind("I couldn't find any information about Smith and Associates.", ["Smith & Associates"])).toBe("echo");
  });

  it("requires the leading article unless two other words follow it", () => {
    expect(detectMention("Hire a licensed plumber in Portland.", ["The Plumber"])).toBe(false);
    expect(detectMention("Any good spa will offer facials.", ["The Spa"])).toBe(false);
    expect(detectMention("Join a gym near downtown.", ["The Gym"])).toBe(false);
    expect(detectMention("Rated W for great.", ["A&W"])).toBe(false);
    expect(detectMention("Hire a licensed plumber in Portland.", ["A Plumber"])).toBe(false);
    expect(detectMention("The Spa on Main is great.", ["The Spa"])).toBe(true);
    expect(detectMention("A&W serves root beer.", ["A&W"])).toBe(true);
    expect(detectMention("A & W serves root beer.", ["A&W"])).toBe(true);
    expect(detectMention("Try Pasta Co downtown.", ["The Pasta Co"])).toBe(true);
    expect(detectMention("Rusty Anchor has great fish and chips.", ["The Rusty Anchor"])).toBe(true);
  });

  it("never joins two tokens across a sentence end or a line break", () => {
    expect(mentionKind("Several licensed companies serve Portland. Plumbing rates there run $120 to $200 per hour.", ["Portland Plumbing"])).toBe("absent");
    expect(detectMention("Try the bread in Rose City. Bakery prices are rising.", ["Rose City Bakery"])).toBe(false);
    expect(detectMention("Visit Harbor\n\nPlumbing is a trade.", ["Harbor Plumbing"])).toBe(false);
    expect(detectMention("Visit Harbor\nPlumbing is a trade.", ["Harbor Plumbing"])).toBe(false);
    expect(detectMention("Call Harbor! Plumbing is hard.", ["Harbor Plumbing"])).toBe(false);
    expect(detectMention("Harbor? Plumbing is hard.", ["Harbor Plumbing"])).toBe(false);
    expect(detectMention("Harbor:\n- Plumbing\n", ["Harbor Plumbing"])).toBe(false);
    expect(highlightRanges("Visit Harbor\n\nPlumbing is a trade.", ["Harbor Plumbing"])).toEqual([]);
  });

  it("allows a period only after an abbreviation of three letters or fewer", () => {
    expect(detectMention("Dr. Kim's clinic is popular", ["Dr Kim"])).toBe(true);
    expect(detectMention("Dr. Kim's clinic is popular", ["Dr. Kim"])).toBe(true);
    expect(detectMention("Dr Kim's clinic is popular", ["Dr. Kim"])).toBe(true);
    expect(detectMention("Try St. Mary's Bakery on 5th.", ["St. Mary's Bakery"])).toBe(true);
    expect(detectMention("Mt. Hood Plumbing is open.", ["Mt Hood Plumbing"])).toBe(true);
    expect(detectMention("Call A.B. Plumbing today.", ["A.B. Plumbing"])).toBe(true);
    expect(detectMention("Call Mr. Rooter today.", ["Mr. Rooter"])).toBe(true);
    // "!" and "?" never join, whatever the token length.
    expect(detectMention("Dr! Kim is popular", ["Dr. Kim"])).toBe(false);
  });

  it("matches a decomposed (NFD) answer against a composed (NFC) variation and vice versa", () => {
    const nfc = "Café Lumière";
    const nfd = nfc.normalize("NFD");
    expect(nfd).not.toBe(nfc);
    expect(detectMention(`${nfd} is great.`, [nfc])).toBe(true);
    expect(detectMention(`${nfc} is great.`, [nfd])).toBe(true);
    expect(detectMention(`${nfd} is great.`, [nfd])).toBe(true);
    expect(mentionKind(`${nfd} is great.`, [nfc])).toBe("named");
    expect(highlightRanges(`${nfd} is great.`, [nfc])).toEqual([{ start: 0, end: nfd.length }]);
    expect(findMatches(`Try ${nfd} today.`, [nfc])).toEqual([{ name: nfc, start: 4, end: 4 + nfd.length }]);
    // Combining marks are part of the word on either side.
    expect(detectMention(`${"Lumières".normalize("NFD")} are great.`, ["Lumière"])).toBe(false);
    expect(detectMention(`${"éGlow".normalize("NFD")} is great.`, ["Glow"])).toBe(false);
    // An accented letter in a variation also matches its bare base letter.
    expect(detectMention("Cafe Lumiere is great.", [nfc])).toBe(true);
  });
});

describe("longer-name guard", () => {
  it("rejects a match that is the start of a longer business name", () => {
    expect(detectMention("Harbor Plumbing & Heating is top rated.", ["Harbor Plumbing"])).toBe(false);
    expect(detectMention("Harbor Plumbing + Heating is top rated.", ["Harbor Plumbing"])).toBe(false);
    expect(detectMention("Harbor Plumbing and Heating is top rated.", ["Harbor Plumbing"])).toBe(false);
    expect(detectMention("Glow and Grace Aesthetics is top rated.", ["Glow"])).toBe(false);
    expect(detectMention("**Harbor Plumbing** & Heating is top rated.", ["Harbor Plumbing"])).toBe(false);
  });

  it("keeps a match when the conjunction joins it to another known name (a list, not a longer name)", () => {
    expect(detectMention("Harbor Plumbing and Rose City Plumbing are both good.", ["Harbor Plumbing"], ["Rose City Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing & Rose City Plumbing are both good.", ["Harbor Plumbing"], ["Rose City Plumbing"])).toBe(true);
    // With the second business unknown, the plural verb still marks a list of two.
    expect(detectMention("Harbor Plumbing and Rose City Plumbing are both good.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Both Harbor Plumbing and Rose City Plumbing have good reviews.", ["Harbor Plumbing"])).toBe(true);
    // Without one it may be a single longer name, and stays rejected.
    expect(detectMention("Harbor Plumbing and Rose City Plumbing is top rated.", ["Harbor Plumbing"])).toBe(false);
    expect(detectMention("Top picks: Harbor Plumbing & Rose City Plumbing.", ["Harbor Plumbing"])).toBe(false);
    // Another variation of the same business counts as a known name too.
    expect(detectMention("Glow and Glow MedSpa are the same place.", ["Glow", "Glow MedSpa"])).toBe(true);
  });

  it("keeps a match before an Oxford comma, whatever follows", () => {
    expect(detectMention("Skin Bar LA, Harbor Plumbing, and Someplace Else.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing; and Someplace Else.", ["Harbor Plumbing"])).toBe(true);
  });

  it("keeps a match followed by a conjunction and a lower-case word", () => {
    expect(detectMention("Harbor Plumbing and the rest of the field.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing & co-workers.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing. Heating is separate.", ["Harbor Plumbing"])).toBe(true);
  });

  it("keeps the match when the longer text is another variation of the same business", () => {
    const names = ["Harbor Plumbing", "Harbor Plumbing & Heating"];
    expect(findMatches("Harbor Plumbing & Heating is top rated.", names)).toEqual([
      { name: "Harbor Plumbing", start: 0, end: 15 },
      { name: "Harbor Plumbing & Heating", start: 0, end: 25 },
    ]);
  });

  it("does not exempt through a longer variation that the guard rejects itself", () => {
    const names = ["Harbor Plumbing", "Harbor Plumbing & Heating"];
    expect(findMatches("Harbor Plumbing & Heating and Cooling Inc is top rated.", names)).toEqual([]);
  });

  it("moves on to a later occurrence that is the business itself", () => {
    const answer = "Harbor Plumbing & Heating is top rated, though Harbor Plumbing is cheaper.";
    expect(findMatches(answer, ["Harbor Plumbing"])).toEqual([
      { name: "Harbor Plumbing", start: answer.lastIndexOf("Harbor Plumbing"), end: answer.lastIndexOf("Harbor Plumbing") + 15 },
    ]);
  });

  it("applies to competitor names too", () => {
    expect(findMatches("Roto-Rooter & Sons is top rated.", ["Roto-Rooter"])).toEqual([]);
  });

  it("keeps the spec's list examples", () => {
    expect(detectMention("Lumière, and Glow MedSpa", ["Lumière"])).toBe(true);
    expect(detectMention("Skin Bar LA and Glow MedSpa are both good", ["Skin Bar LA"], ["Glow MedSpa"])).toBe(true);
    expect(detectMention("Skin Bar LA and Glow MedSpa are both good", ["Skin Bar LA"])).toBe(true);
    expect(detectMention("Skin Bar LA and Glow MedSpa is a good choice", ["Skin Bar LA"])).toBe(false);
  });

  it("never reads a conjunction after a sentence end, a line break or a dash as a longer name", () => {
    expect(detectMention("Call Harbor Plumbing. And Portland has many others.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Go with Harbor Plumbing! And Mr. Rooter if they are booked.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing? And Portland agrees.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing — and Portland agrees — is best.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing – and Portland agrees – is best.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing\nAnd Portland agrees.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("I recommend Harbor Plumbing. And I also like their pricing.", ["Harbor Plumbing"])).toBe(true);
    // A hyphen or bold marker is still inside a name.
    expect(detectMention("Harbor Plumbing - and Heating is top rated.", ["Harbor Plumbing"])).toBe(false);
    expect(detectMention("**Harbor Plumbing** & Heating is top rated.", ["Harbor Plumbing"])).toBe(false);
  });

  it("lets I and a platform name follow the conjunction", () => {
    expect(detectMention("Harbor Plumbing and I have worked together.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing and I'd say they are good.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing and Yelp reviewers agree.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing and Google both list the hours.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing and Google Maps both list the hours.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing and Angi both list it.", ["Harbor Plumbing"])).toBe(true);
    expect(detectMention("Harbor Plumbing & TripAdvisor both list it.", ["Harbor Plumbing"])).toBe(true);
    expect(findMatches("Roto-Rooter and Yelp both list it.", ["Roto-Rooter"])).toEqual([{ name: "Roto-Rooter", start: 0, end: 11 }]);
    // "I" is the word, not the start of another capitalised word.
    expect(detectMention("Harbor Plumbing and Instaplumb is a good choice.", ["Harbor Plumbing"])).toBe(false);
    expect(detectMention("Harbor Plumbing and Portland Water Bureau is a good choice.", ["Harbor Plumbing"])).toBe(false);
  });

  it("lets a pronoun or a title follow the conjunction", () => {
    expect(detectMention("I'd go with Glow MedSpa and Dr. Kim there is excellent.", ["Glow MedSpa"])).toBe(true);
    expect(detectMention("Call Harbor Plumbing and They will quote you for free.", ["Harbor Plumbing"])).toBe(true);
    // The word, not the start of another capitalised word.
    expect(detectMention("Harbor Plumbing and Theydon Heating is top rated.", ["Harbor Plumbing"])).toBe(false);
  });
});

describe("echo detection", () => {
  const names = ["Harbor Plumbing"];

  it.each([
    "I couldn't find any information about Harbor Plumbing",
    "I don't have details on Harbor Plumbing",
    "Harbor Plumbing: I'm not aware of this business",
    "- Harbor Plumbing: I'm not aware of this business",
    "Harbor Plumbing: I'm not aware of this business.",
    "Some options:\n- Roto-Rooter: well reviewed.\n- **Harbor Plumbing**: I'm not aware of this business.",
    "1. Harbor Plumbing: I don't have details on this one.",
    "I could not find any record of Harbor Plumbing.",
    "I'm not aware of Harbor Plumbing.",
    "I'm not familiar with Harbor Plumbing.",
    "There is no reliable information regarding Harbor Plumbing in Portland.",
    "Unfortunately I wasn’t able to find reviews for Harbor Plumbing.",
    "I did not find much ON Harbor Plumbing specifically.",
  ])("treats %j as an echo", answer => {
    expect(mentionKind(answer, names)).toBe("echo");
    expect(detectMention(answer, names)).toBe(false);
    expect(findMentions(answer, names)).toEqual([]);
  });

  it.each([
    "I couldn't be happier with Harbor Plumbing",
    "Harbor Plumbing has no long-term contracts, and its reviews are excellent",
    "I couldn't verify whether Harbor Plumbing is licensed",
    "I couldn't find information about Harbor Plumbing's pricing",
    "I couldn't find information about Harbor Plumbing’s hours",
    "Not much information on Harbor Plumbing, but they are well reviewed",
    "I couldn't find much about Harbor Plumbing, but they are well reviewed",
    "I couldn't find much about Harbor Plumbing; however, they are well reviewed",
    "I couldn't find much about Harbor Plumbing, that said they are well reviewed",
    "I couldn't find much about Harbor Plumbing, although they are well reviewed",
    "I couldn't find anything wrong with Harbor Plumbing",
    "Harbor Plumbing is a company I'm not familiar with",
    "I couldn't find Harbor Plumbing's licence number",
  ])("keeps %j as a mention", answer => {
    expect(mentionKind(answer, names)).toBe("named");
    expect(detectMention(answer, names)).toBe(true);
  });

  it("links a phrase only within 60 characters of the name", () => {
    // The padding is a filler word: the link rule now allows only fillers
    // between the phrase and the link word, so "really" would break the link
    // before the window did.
    const near = "I couldn't find any specific information about Harbor Plumbing";
    const far = `I couldn't find ${"specific ".repeat(8)}information about Harbor Plumbing`;
    expect(mentionKind(near, names)).toBe("echo");
    expect(mentionKind(far, names)).toBe("named");
  });

  it("looks for the phrase in the name's own sentence only", () => {
    expect(mentionKind("I couldn't find much. Harbor Plumbing is on Yelp with 4.8 stars.", names)).toBe("named");
    expect(mentionKind("I couldn't find much about the first one!\n- Harbor Plumbing: 4.8 stars on Yelp", names)).toBe("named");
    expect(mentionKind("Harbor Plumbing is on Yelp. I couldn't find anything about the others.", names)).toBe("named");
  });

  it("does not let a contrast word in the next sentence rescue an echo", () => {
    expect(mentionKind("I couldn't find much about Harbor Plumbing. That said, Portland has good plumbers.", names)).toBe("echo");
    expect(mentionKind("I couldn't find much about Harbor Plumbing. Portland has good plumbers, but prices vary.", names)).toBe("echo");
  });

  it("counts a real mention that comes after an echo", () => {
    const answer = "I couldn't find any information about Harbor Plumbing. Harbor Plumbing is listed on Yelp.";
    expect(mentionKind(answer, names)).toBe("named");
    expect(findMentions(answer, names)).toEqual([
      { name: "Harbor Plumbing", start: answer.lastIndexOf("Harbor Plumbing"), end: answer.lastIndexOf("Harbor Plumbing") + 15 },
    ]);
  });

  it("reports absent when the name never occurs", () => {
    expect(mentionKind("Try Roto-Rooter.", names)).toBe("absent");
    expect(mentionKind("Harbor Plumbing & Heating is top rated.", names)).toBe("absent");
    expect(mentionKind("", names)).toBe("absent");
  });

  it("does not echo-filter a different name in the same list unless it is linked itself", () => {
    expect(detectNames("I don't have details on Harbor Plumbing. Roto-Rooter is well reviewed.", ["Harbor Plumbing", "Roto-Rooter"]))
      .toEqual(["Roto-Rooter"]);
  });

  it("does not let a contrast clause about another known business rescue an echo", () => {
    const others = ["Roto-Rooter", "Mr. Rooter"];
    expect(mentionKind("I couldn't find any information about Harbor Plumbing, but Roto-Rooter and Mr. Rooter are solid options.", names, others)).toBe("echo");
    expect(mentionKind("I don't have details on Harbor Plumbing; however, Mr. Rooter is well known.", names, others)).toBe("echo");
    expect(mentionKind("I don't have details on Harbor Plumbing, but **Roto-Rooter** is well known.", names, others)).toBe("echo");
    expect(mentionKind("I don't have details on Harbor Plumbing, though Roto-Rooter is well known.", names, others)).toBe("echo");
    // The other names in the same list count too.
    expect(detectNames("I don't have details on Harbor Plumbing, but Roto-Rooter is well known.", ["Harbor Plumbing", "Roto-Rooter"]))
      .toEqual(["Roto-Rooter"]);
    // A clause about the business stays a mention, whatever it goes on to compare with.
    expect(mentionKind("I couldn't find much about Harbor Plumbing, but they are cheaper than Roto-Rooter.", names, others)).toBe("named");
    expect(mentionKind("Not much information on Harbor Plumbing, but they beat Roto-Rooter on price.", names, others)).toBe("named");
    expect(mentionKind("I couldn't find much about Harbor Plumbing, but they are well reviewed.", names, others)).toBe("named");
    // Only a clause that is about the business rescues: one about a competitor the matcher does not know, or about
    // the trade in general, leaves the echo an echo.
    expect(mentionKind("I couldn't find any information about Harbor Plumbing, but Roto-Rooter is a solid option.", names)).toBe("echo");
    expect(mentionKind("I couldn't find any information about Harbor Plumbing, but most plumbers charge $100 to $200.", names)).toBe("echo");
    expect(mentionKind("I couldn't find much about Harbor Plumbing, but reviews are positive.", names)).toBe("named");
  });

  it("links the phrase to the name only through a directly following link word", () => {
    for (const answer of [
      "The BBB has no record of complaints for Harbor Plumbing.",
      "There is limited information on pricing, but Harbor Plumbing is highly rated.",
      "If you don't have time to shop around, go for Harbor Plumbing.",
      "I don't have a favorite, but for drain work Harbor Plumbing is excellent.",
      "You don't have to search for long: Harbor Plumbing is the go-to.",
      "I couldn't find a better option for drain work than Harbor Plumbing.",
    ]) {
      expect(mentionKind(answer, names), answer).toBe("named");
      expect(detectMention(answer, names), answer).toBe(true);
    }
    for (const answer of [
      "I couldn't find any information about Harbor Plumbing",
      "I didn't find much about Harbor Plumbing",
      "I have no details on Harbor Plumbing",
      "I'm not aware of Harbor Plumbing",
      "I couldn't find any reviews or details about Harbor Plumbing",
      "I couldn't find any customer reviews for Harbor Plumbing",
      "I don't have current information about a business called Harbor Plumbing",
      "I couldn't find any information about \"Harbor Plumbing\"",
    ]) {
      expect(mentionKind(answer, names), answer).toBe("echo");
    }
  });

  it("reads a label as an echo only when the no-knowledge phrase starts its content", () => {
    for (const answer of [
      "- Roto-Rooter: 24/7 emergency.\n- Harbor Plumbing: well reviewed on Yelp; no details on pricing.",
      "- Harbor Plumbing: licensed and insured, 24/7 service, though I don't have pricing details.",
      "- Harbor Plumbing: top rated; no record of complaints on BBB.",
      "Harbor Plumbing: 4.8 stars; no details on pricing.",
    ]) {
      expect(mentionKind(answer, names), answer).toBe("named");
    }
    for (const answer of [
      "* Harbor Plumbing: Sorry, I couldn't find anything.",
      "Harbor Plumbing: Unfortunately, I don't have details on this one.",
      "Harbor Plumbing: I'm sorry, I'm not familiar with them.",
      "Harbor Plumbing: There is no reliable information on this one.",
      "Harbor Plumbing: I have no information on this one.",
      "- **Harbor Plumbing**: **I'm not aware of this business**",
      "Harbor Plumbing: no information available.",
    ]) {
      expect(mentionKind(answer, names), answer).toBe("echo");
    }
  });
});

describe("findAllMatches and findAllMentions", () => {
  it("returns every accepted occurrence of every name, sorted by position", () => {
    const answer = "Glow MedSpa is great. Visit Glow MedSpa today; Skin Bar LA is fine.";
    expect(findAllMatches(answer, ["Skin Bar LA", "Glow MedSpa"])).toEqual([
      { name: "Glow MedSpa", start: 0, end: 11 },
      { name: "Glow MedSpa", start: 28, end: 39 },
      { name: "Skin Bar LA", start: 47, end: 58 },
    ]);
  });

  it("applies the guard to each occurrence and keeps echoes in findAllMatches only", () => {
    const answer = "I couldn't find anything about Harbor Plumbing. Harbor Plumbing & Heating is a chain; Harbor Plumbing is local.";
    const last = answer.lastIndexOf("Harbor Plumbing");
    expect(findAllMatches(answer, ["Harbor Plumbing"])).toEqual([
      { name: "Harbor Plumbing", start: 31, end: 46 },
      { name: "Harbor Plumbing", start: last, end: last + 15 },
    ]);
    expect(findAllMentions(answer, ["Harbor Plumbing"])).toEqual([{ name: "Harbor Plumbing", start: last, end: last + 15 }]);
  });
});

describe("nameTokens", () => {
  it("normalises a name the way the matcher does", () => {
    expect(nameTokens("Harbor Plumbing, LLC")).toEqual(["harbor", "plumbing"]);
    expect(nameTokens("Harbor Plumbing, Inc.")).toEqual(["harbor", "plumbing"]);
    expect(nameTokens("Harbor Plumbing's")).toEqual(["harbor", "plumbing"]);
    expect(nameTokens("Harbor Plumbing-Portland")).toEqual(["harbor", "plumbing", "portland"]);
    expect(nameTokens("Harbor Plumbing & Heating")).toEqual(["harbor", "plumbing", "and", "heating"]);
    expect(nameTokens("Harbor Plumbing + Heating")).toEqual(["harbor", "plumbing", "and", "heating"]);
    expect(nameTokens("Harbor Plumbing and Drain")).toEqual(["harbor", "plumbing", "and", "drain"]);
    expect(nameTokens("The Rusty Anchor")).toEqual(["rusty", "anchor"]);
    expect(nameTokens("The Pasta Co")).toEqual(["pasta", "co"]);
    expect(nameTokens("The Spa")).toEqual(["the", "spa"]);
    expect(nameTokens("Joe's Pizza")).toEqual(["joes", "pizza"]);
    expect(nameTokens("SkinLab")).toEqual(["skin", "lab"]);
    expect(nameTokens("Café Lumière".normalize("NFD"))).toEqual(["café", "lumière"]);
    expect(nameTokens("LLC")).toEqual([]);
    expect(nameTokens("")).toEqual([]);
  });
});

describe("detectNames", () => {
  it("returns names in order of first appearance", () =>
    expect(detectNames("B Clinic is great; A Spa is fine too", ["A Spa", "B Clinic", "C Derm"]))
      .toEqual(["B Clinic", "A Spa"]));

  it("takes the names that may follow a conjunction", () => {
    expect(detectNames("Glow MedSpa and Derm House is a good choice.", ["Glow MedSpa"])).toEqual([]);
    expect(detectNames("Glow MedSpa and Derm House is a good choice.", ["Glow MedSpa"], ["Derm House"])).toEqual(["Glow MedSpa"]);
  });
});

describe("findMatches", () => {
  it("returns match objects with name, start, and end positions", () => {
    // "Glow MedSpa and Derm House" is a list of two known names, so the
    // longer-name guard leaves both alone.
    const matches = findMatches("Glow MedSpa and Derm House", ["Glow MedSpa", "Derm House"]);
    expect(matches).toEqual([
      { name: "Glow MedSpa", start: 0, end: 11 },
      { name: "Derm House", start: 16, end: 26 }
    ]);
  });

  it("rejects a name a conjunction joins to a capitalised word that is not a known name", () => {
    expect(findMatches("Glow MedSpa and Derm House", ["Glow MedSpa"])).toEqual([]);
    expect(findMatches("Glow MedSpa and Derm House", ["Glow MedSpa"], ["Derm House"]))
      .toEqual([{ name: "Glow MedSpa", start: 0, end: 11 }]);
  });

  it("keeps echoes, being the call for competitor names", () => {
    expect(findMatches("I couldn't find anything about Roto-Rooter.", ["Roto-Rooter"]))
      .toEqual([{ name: "Roto-Rooter", start: 31, end: 42 }]);
  });

  it("spans the text as written, not the variation as typed", () => {
    expect(findMatches("Visit Joes Pizza today.", ["Joe's Pizza LLC"])).toEqual([{ name: "Joe's Pizza LLC", start: 6, end: 16 }]);
    expect(findMatches("The Rusty Anchor is fun.", ["Rusty Anchor"])).toEqual([{ name: "Rusty Anchor", start: 4, end: 16 }]);
  });
});

describe("extractSnippet", () => {
  it("returns the sentence of the earliest real mention", () => {
    expect(extractSnippet("Harbor Plumbing is top rated. It also offers drain cleaning.", ["Harbor Plumbing LLC"]))
      .toBe("Harbor Plumbing is top rated");
  });

  it("skips an echo", () => {
    expect(extractSnippet("I couldn't find any information about Harbor Plumbing. Nothing else.", ["Harbor Plumbing"])).toBeNull();
    expect(extractSnippet("I couldn't find any information about Harbor Plumbing. Harbor Plumbing is on Yelp.", ["Harbor Plumbing"]))
      .toBe("Harbor Plumbing is on Yelp.");
  });

  it("takes the names that may follow a conjunction", () => {
    const answer = "Harbor Plumbing & Rose City Plumbing top most lists. Harbor Plumbing is cheaper.";
    expect(extractSnippet(answer, ["Harbor Plumbing"])).toBe("Harbor Plumbing is cheaper.");
    expect(extractSnippet(answer, ["Harbor Plumbing"], ["Rose City Plumbing"])).toBe("Harbor Plumbing & Rose City Plumbing top most lists");
  });
});

describe("highlightRanges", () => {
  it("returns every occurrence of a variation, not just the first", () => {
    const ranges = highlightRanges(
      "Glow MedSpa is great. Visit Glow MedSpa today for Glow MedSpa specials.",
      ["Glow MedSpa"],
    );
    expect(ranges).toEqual([
      { start: 0, end: 11 },
      { start: 28, end: 39 },
      { start: 50, end: 61 },
    ]);
  });

  it("matches multiple variations across the answer", () => {
    const ranges = highlightRanges("Dr. Kim runs Glow MedSpa downtown.", ["Glow MedSpa", "Dr. Kim"]);
    expect(ranges).toEqual([
      { start: 0, end: 7 },
      { start: 13, end: 24 },
    ]);
  });

  it("merges overlapping ranges from different variations (name contained in another)", () => {
    const ranges = highlightRanges("Glow MedSpa is downtown.", ["Glow MedSpa", "Glow"]);
    expect(ranges).toEqual([{ start: 0, end: 11 }]);
  });

  it("requires word boundaries (no substring false positives)", () => {
    expect(highlightRanges("The glowing reviews mention nothing", ["Glow"])).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(highlightRanges("Nothing here.", ["Glow MedSpa"])).toEqual([]);
  });

  it("highlights tolerant matches as written in the answer", () => {
    expect(highlightRanges("Try Joes Pizza or Skin Lab.", ["Joe's Pizza", "SkinLab"])).toEqual([
      { start: 4, end: 14 },
      { start: 18, end: 26 },
    ]);
  });

  it("keeps echoes: highlighting is for reading an answer", () => {
    expect(highlightRanges("I couldn't find any information about Harbor Plumbing.", ["Harbor Plumbing"]))
      .toEqual([{ start: 38, end: 53 }]);
  });

  it("leaves out a longer business name that only starts with ours", () => {
    expect(highlightRanges("Harbor Plumbing & Heating is top rated.", ["Harbor Plumbing"])).toEqual([]);
  });
});
