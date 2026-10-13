import { describe, it, expect } from "vitest";
import { brandDomains } from "@/core/brand-domain";

describe("brandDomains", () => {
  it("pairs a name with the cited website that carries it", () => {
    const got = brandDomains(["LinkedIn", "Apollo", "Hunter"], ["reddit.com", "linkedin.com", "apollo.io", "hunter.io"]);
    expect([...got]).toEqual([["LinkedIn", "linkedin.com"], ["Apollo", "apollo.io"], ["Hunter", "hunter.io"]]);
  });
  it("reads past spaces, punctuation and a typed ending in the name", () => {
    const got = brandDomains(["Pure Dermatology", "Apollo.io", "Skin-Tastic"], ["puredermatology.com", "apollo.io", "skintastic.com"]);
    expect(got.get("Pure Dermatology")).toBe("puredermatology.com");
    expect(got.get("Apollo.io")).toBe("apollo.io");
    expect(got.get("Skin-Tastic")).toBe("skintastic.com");
  });
  it("matches a website that adds get, try or hq to the name", () => {
    const got = brandDomains(["Lemlist", "Clay"], ["getlemlist.com", "clayhq.com"]);
    expect(got.get("Lemlist")).toBe("getlemlist.com");
    expect(got.get("Clay")).toBe("clayhq.com");
  });
  it("takes the brand from the part before the ending, and the first website that fits", () => {
    const got = brandDomains(["Google", "Yale"], ["mail.google.com", "google.com", "ocs.yale.edu"]);
    expect(got.get("Google")).toBe("mail.google.com");
    expect(got.get("Yale")).toBe("ocs.yale.edu");
  });
  it("leaves a name unmatched when no cited website fits", () => {
    const got = brandDomains(["Gmail", "Handshake", "AI"], ["mail.google.com", "handshakes.org", "ai.com"]);
    expect(got.size).toBe(0);
  });
});
