import { describe, it, expect } from "vitest";
import { factsBlock, pageGuide, questionGuide, reputationGuide, sourceGuide, websiteGuide, type GuideStep } from "@/core/move-guides";
import type { WebsiteCheckRow } from "@/core/website-check";

const business = { name: "Blue Box Bakery", category: "Bakery", location: "Bothell, WA", website: "https://blueboxbakery.com" };
const links = (steps: GuideStep[]) => steps.flatMap(s => s.links ?? []);
const text = (steps: GuideStep[]) => JSON.stringify(steps);

describe("move guides", () => {
  it("fills the facts block with the business, and brackets what only the owner knows", () => {
    const facts = factsBlock(business);
    expect(facts).toContain("Blue Box Bakery is a bakery in Bothell, WA.");
    expect(facts).toContain("Website: https://blueboxbakery.com");
    expect(facts).toContain("[your phone number]");
  });

  it("sends a Google step to the business profile, with a review request naming the business", () => {
    const steps = sourceGuide({ business, domain: "google.com", kind: "google", onIt: false, pages: [], named: [], questions: [] });
    expect(links(steps).map(l => l.url)).toContain("https://business.google.com");
    expect(text(steps)).toContain("thank you for choosing Blue Box Bakery");
  });

  it("links a known directory's business page and the exact pages AI read", () => {
    const steps = sourceGuide({
      business, domain: "yelp.com", kind: "reviews", onIt: true,
      pages: ["https://www.yelp.com/search?find_desc=cakes"], named: ["Honey Crumb Cake Studio"], questions: ["Best wedding cakes in Bothell?"],
    });
    const urls = links(steps).map(l => l.url);
    expect(urls).toContain("https://business.yelp.com");
    expect(urls).toContain("https://www.yelp.com/search?find_desc=cakes");
    expect(text(steps)).toContain("Honey Crumb Cake Studio");
    expect(text(steps)).toContain("“Best wedding cakes in Bothell?”");
  });

  it("pitches the writer for an article, not a listing", () => {
    const steps = sourceGuide({ business, domain: "seattlemag.com", kind: "other", onIt: false, pages: ["https://seattlemag.com/best-cakes"], named: ["Lady Grey"], questions: [] });
    expect(text(steps)).toContain("Find who wrote it");
    expect(text(steps)).toContain("Subject: A bakery in Bothell, WA for your list");
    expect(text(steps)).not.toContain("Claim this business");
  });

  it("drafts the answer to a lost question, without naming the competitors in it", () => {
    const steps = questionGuide({ business, question: "Who makes the best sugar flower cakes?", named: ["Honey Crumb Cake Studio"], getOnto: ["yelp.com"], standOut: [] });
    const draft = steps[0].copy!.text;
    expect(draft.startsWith("Who makes the best sugar flower cakes?")).toBe(true);
    expect(draft).toContain("Blue Box Bakery is a bakery in Bothell, WA");
    expect(draft).not.toContain("Honey Crumb");
    expect(links(steps).map(l => l.url)).toContain("https://business.yelp.com");
  });

  it("has a guide for every website check, ending with marking it done", () => {
    const ids: WebsiteCheckRow["id"][] = ["ai_allowed", "readable_text", "facts_page", "machine_labels", "sitemap", "business_schema", "contact_visible"];
    for (const id of ids) {
      const steps = websiteGuide(id, business);
      expect(steps.length).toBeGreaterThan(1);
      expect(steps[steps.length - 1].title).toBe("Mark this step done");
    }
    expect(websiteGuide("ai_allowed", business).find(s => s.copy)!.copy!.text).toContain("User-agent: GPTBot\nAllow: /");
    expect(websiteGuide("business_schema", business).find(s => s.copy)!.copy!.text).toContain('"name": "Blue Box Bakery"');
  });

  it("dates pages with this month, and has a reply for a caveat", () => {
    expect(text(pageGuide({ business, pageKey: "pages-with-this-year-s-details", searches: [], updated: "October 2026" }))).toContain("Updated October 2026");
    expect(text(reputationGuide(business, ["“slow to reply”"]))).toContain("AI added: “slow to reply”.");
  });

  it("only ever links https addresses", () => {
    const all = [
      sourceGuide({ business, domain: "theknot.com", kind: "reviews", onIt: false, pages: [], named: [], questions: [] }),
      sourceGuide({ business, domain: "reddit.com", kind: "social", onIt: false, pages: ["https://reddit.com/r/x"], named: [], questions: [] }),
      sourceGuide({ business, domain: "instagram.com", kind: "social", onIt: false, pages: [], named: [], questions: [] }),
      websiteGuide("sitemap", business),
    ];
    for (const steps of all) for (const l of links(steps)) expect(l.url).toMatch(/^https:\/\//);
  });
});
