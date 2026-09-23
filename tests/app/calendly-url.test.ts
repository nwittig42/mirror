import { describe, it, expect } from "vitest";
import { buildCalendlyUrl } from "@/app/book/calendly-embed";

const BASE = "https://calendly.com/mirror/15min";

describe("buildCalendlyUrl", () => {
  it("prefills the name and email the visitor just typed", () => {
    const url = new URL(buildCalendlyUrl(BASE, { contactName: "Nicholas", email: "nick@example.com" }));
    expect(url.searchParams.get("name")).toBe("Nicholas");
    expect(url.searchParams.get("email")).toBe("nick@example.com");
  });

  // Sending an empty string would prefill Calendly's field with nothing while
  // still marking it as answered, so blanks must be omitted entirely.
  it("omits fields the visitor left blank rather than sending empty values", () => {
    const url = new URL(buildCalendlyUrl(BASE, { contactName: "", email: undefined }));
    expect(url.searchParams.has("name")).toBe(false);
    expect(url.searchParams.has("email")).toBe(false);
  });

  it("carries the practice and website so the booking alert identifies the lead", () => {
    const url = new URL(
      buildCalendlyUrl(BASE, { practiceName: "Offerloop", websiteUrl: "https://offerloop.ai" }),
    );
    expect(url.searchParams.get("utm_source")).toBe("mirror-book");
    expect(url.searchParams.get("utm_content")).toBe("Offerloop - https://offerloop.ai");
  });

  it("still attributes when only one of practice or website is present", () => {
    const url = new URL(buildCalendlyUrl(BASE, { practiceName: "Offerloop" }));
    expect(url.searchParams.get("utm_content")).toBe("Offerloop");
  });

  it("sets no attribution when there is nothing to attribute", () => {
    const url = new URL(buildCalendlyUrl(BASE, {}));
    expect(url.searchParams.has("utm_source")).toBe(false);
    expect(url.searchParams.has("utm_content")).toBe(false);
  });

  it("hides the consent banner that would otherwise cover the embed", () => {
    expect(new URL(buildCalendlyUrl(BASE)).searchParams.get("hide_gdpr_banner")).toBe("1");
  });

  // Operators paste whatever Calendly hands them, which can already carry
  // query params (e.g. a chosen month). Those must survive.
  it("preserves query parameters already on the configured link", () => {
    const url = new URL(buildCalendlyUrl(`${BASE}?month=2026-09`, { contactName: "Nicholas" }));
    expect(url.searchParams.get("month")).toBe("2026-09");
    expect(url.searchParams.get("name")).toBe("Nicholas");
    expect(url.pathname).toBe("/mirror/15min");
  });

  it("percent-encodes values so a name with an ampersand can't inject a parameter", () => {
    const raw = buildCalendlyUrl(BASE, { contactName: "A&email=evil@x.com" });
    expect(raw).not.toContain("&email=evil");
    expect(new URL(raw).searchParams.get("email")).toBeNull();
  });
});
