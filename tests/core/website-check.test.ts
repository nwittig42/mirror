import { describe, it, expect } from "vitest";
import {
  blocksWholeSite, checkAiAllowed, checkBusinessSchema, checkContactVisible, checkFactsPage, checkMachineLabels,
  checkReadableText, checkSitemap, isBusinessType, jsonLdNodes, jsonLdTypes, parseRobots, titlesWithoutSiteName,
} from "@/core/website-check";
import { htmlToText } from "@/core/site-text";
import { runWebsiteCheck } from "@/services/website-check";

describe("robots.txt", () => {
  it("applies an agent's own group over the * group", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n");
    expect(blocksWholeSite(robots, "GPTBot")).toBe(false);
    expect(blocksWholeSite(robots, "ClaudeBot")).toBe(true);
  });
  it("handles grouped agents and comments", () => {
    const robots = parseRobots("# hi\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: / # no AI\nSitemap: https://x.example/s.xml");
    expect(blocksWholeSite(robots, "claudebot")).toBe(true);
    expect(robots.sitemaps).toEqual(["https://x.example/s.xml"]);
  });
  it("passes with no robots file, warns on a few blocks, fails when most are blocked", () => {
    expect(checkAiAllowed(null).status).toBe("pass");
    expect(checkAiAllowed("User-agent: GPTBot\nDisallow: /").status).toBe("warn");
    const all = checkAiAllowed("User-agent: *\nDisallow: /");
    expect(all.status).toBe("fail");
    expect(all.fix).toMatch(/robots.txt/);
  });
  it("does not treat a partial disallow as a block", () => {
    expect(checkAiAllowed("User-agent: *\nDisallow: /admin").status).toBe("pass");
  });
});

describe("other checks", () => {
  it("grades readable text by length", () => {
    expect(checkReadableText(800).status).toBe("pass");
    expect(checkReadableText(200).status).toBe("warn");
    expect(checkReadableText(20).status).toBe("fail");
  });
  it("reads schema types, nested and in arrays", () => {
    const html = `<script type="application/ld+json">{"@type":["LocalBusiness"],"makesOffer":{"@type":"Offer"}}</script>
      <script type="application/ld+json">not json</script>`;
    expect(jsonLdTypes(html)).toEqual(["LocalBusiness", "Offer"]);
    expect(checkMachineLabels(["LocalBusiness", "Offer"]).status).toBe("pass");
    expect(checkMachineLabels(["LocalBusiness"]).status).toBe("warn");
    expect(checkMachineLabels([]).status).toBe("fail");
  });
  it("grades the sitemap", () => {
    expect(checkSitemap(true, false).status).toBe("pass");
    expect(checkSitemap(false, true).status).toBe("warn");
    expect(checkSitemap(false, false).status).toBe("fail");
  });
});

describe("facts page, for any trade", () => {
  const p = (path: string, title: string | null = null) => ({ url: `https://x.example${path}`, title });
  const FIX = "Add a plain about page and a services page, and state typical prices, fees or how you quote.";

  it("passes on about + pricing and on about + services", () => {
    expect(checkFactsPage([p("/"), p("/about"), p("/pricing")]).status).toBe("pass");
    expect(checkFactsPage([p("/"), p("/about-us"), p("/services")]).status).toBe("pass");
    expect(checkFactsPage([p("/"), p("/our-story"), p("/what-we-do")]).status).toBe("pass");
  });
  it("counts fees, estimates and quotes as pricing", () => {
    expect(checkFactsPage([p("/"), p("/about"), p("/fees")]).status).toBe("pass");
    expect(checkFactsPage([p("/"), p("/about"), p("/free-estimate")]).status).toBe("pass");
    expect(checkFactsPage([p("/"), p("/about"), p("/get-a-quote")]).status).toBe("pass");
    expect(checkFactsPage([p("/"), p("/about"), p("/fee-schedule", "Fee schedule")]).status).toBe("pass");
    // "fee" has to be a word: a feedback page says nothing about prices.
    expect(checkFactsPage([p("/"), p("/about"), p("/feedback")]).status).toBe("warn");
  });
  it("warns when only one of about, pricing or services is there, and without an about page", () => {
    expect(checkFactsPage([p("/"), p("/about")]).status).toBe("warn");
    expect(checkFactsPage([p("/"), p("/pricing")]).status).toBe("warn");
    expect(checkFactsPage([p("/"), p("/services/drain-cleaning")]).status).toBe("warn");
    expect(checkFactsPage([p("/"), p("/pricing"), p("/services")]).status).toBe("warn");
  });
  it("does not read the site name in every title as a services, pricing or about page", () => {
    // "Harbor Plumbing Services" is the business, not a services page.
    expect(checkFactsPage([p("/", "Harbor Plumbing Services"), p("/about", "About | Harbor Plumbing Services")]).status).toBe("warn");
    expect(checkFactsPage([p("/", "Joe's Products Co"), p("/about", "About Us - Joe's Products Co")]).status).toBe("warn");
    expect(checkFactsPage([p("/", "Fair Price Bakery"), p("/about-us", "Our story · Fair Price Bakery")]).status).toBe("warn");
    expect(checkFactsPage([p("/", "Team Harbor"), p("/services", "Services – Team Harbor")]).status).toBe("warn");
    // A page's own title still counts, with or without the site name after it.
    expect(checkFactsPage([p("/", "Harbor Plumbing Services"), p("/about", "About | Harbor Plumbing Services"), p("/page-12", "Our Services | Harbor Plumbing Services")]).status).toBe("pass");
    expect(checkFactsPage([p("/", "Harbor"), p("/about"), p("/page-12", "Our Services")]).status).toBe("pass");
    expect(titlesWithoutSiteName([p("/", "Harbor Plumbing Services"), p("/about", "About | harbor plumbing services"), p("/x", null)])).toEqual(["", "About", ""]);
  });

  it("fails when none is there, with the same plain fix", () => {
    const none = checkFactsPage([p("/", "Home"), p("/blog", "News")]);
    expect(none.status).toBe("fail");
    expect(none.fix).toBe(FIX);
    expect(checkFactsPage([p("/", "Home"), p("/our-prices", "Price list")]).fix).toBe(FIX);
    expect(checkFactsPage([p("/"), p("/about"), p("/pricing")]).fix).toBeUndefined();
  });
});

describe("business schema", () => {
  const NAMES = ["Harbor Plumbing and Drain", "Harbor Plumbing"];
  const FIX = "Add LocalBusiness (or Organization) schema markup to your homepage with your name, phone and address. Most site builders have a setting for this.";
  const node = (over: Record<string, unknown>) => ({ "@context": "https://schema.org", "@type": "LocalBusiness", ...over });

  it("recognises business types from the list, by suffix, and in prefixed forms", () => {
    for (const t of ["LocalBusiness", "Organization", "Plumber", "Bakery", "Attorney", "Physician", "Florist", "Winery"]) {
      expect(isBusinessType(t), t).toBe(true);
    }
    for (const t of ["AutoBodyShop", "LegalService", "HairSalon", "InsuranceAgency", "RoofingContractor", "DanceSchool", "YogaStudio", "HardwareStore"]) {
      expect(isBusinessType(t), t).toBe(true);
    }
    expect(isBusinessType("https://schema.org/LocalBusiness")).toBe(true);
    expect(isBusinessType("schema:Plumber")).toBe(true);
    for (const t of ["WebSite", "WebPage", "Person", "Product", "Offer", "FAQPage", "BreadcrumbList", "PostalAddress", "Article"]) {
      expect(isBusinessType(t), t).toBe(false);
    }
  });

  it("fails without a business node, even when other markup is there", () => {
    const none = checkBusinessSchema([{ "@type": "WebSite", name: "Harbor Plumbing" }, { "@type": "Person", telephone: "503-555-1234" }], NAMES);
    expect(none.status).toBe("fail");
    expect(none.fix).toBe(FIX);
    expect(checkBusinessSchema([], NAMES).status).toBe("fail");
  });

  it("passes on a phone or an address with the business's own name", () => {
    expect(checkBusinessSchema([node({ name: "Harbor Plumbing and Drain", telephone: "+1 503 555 1234" })], NAMES).status).toBe("pass");
    expect(checkBusinessSchema([node({ name: "Harbor Plumbing", address: { "@type": "PostalAddress", streetAddress: "123 Main St" } })], NAMES).status).toBe("pass");
    expect(checkBusinessSchema([node({ "@type": "Plumber", name: "Harbor Plumbing", address: { addressLocality: "Portland" } })], NAMES).status).toBe("pass");
    expect(checkBusinessSchema([node({ "@type": ["Plumber", "LocalBusiness"], name: "HARBOR PLUMBING", telephone: ["503-555-1234"] })], NAMES).status).toBe("pass");
  });

  it("warns when the node has no phone or address, or only a name that is not the business's", () => {
    const bare = checkBusinessSchema([node({ name: "Harbor Plumbing", url: "https://harbor.example" })], NAMES);
    expect(bare.status).toBe("warn");
    expect(bare.fix).toBe(FIX);
    expect(checkBusinessSchema([node({ name: "Harbor Plumbing", telephone: "", address: { streetAddress: " " } })], NAMES).status).toBe("warn");
    expect(checkBusinessSchema([node({ name: "Harbor Plumbing", address: "123 Main St, Portland" })], NAMES).status).toBe("warn");
    expect(checkBusinessSchema([node({ name: "Portland Drain Pros", telephone: "503-555-1234" })], NAMES).status).toBe("warn");
  });

  it("reads '&' and 'and' in the name as the same conjunction, either way round", () => {
    const yoast = { "@type": "Plumber", name: "Harbor Plumbing & Drain", telephone: "+1-503-555-0100", address: { streetAddress: "1234 NE Broadway", addressLocality: "Portland" } };
    expect(checkBusinessSchema([yoast], NAMES).status).toBe("pass");
    expect(checkBusinessSchema([{ ...yoast, name: "Harbor Plumbing &amp; Drain" }], NAMES).status).toBe("pass");
    expect(checkBusinessSchema([{ ...yoast, name: "Harbor Plumbing + Drain" }], NAMES).status).toBe("pass");
    expect(checkBusinessSchema([{ ...yoast, name: "Harbor Plumbing and Drain" }], ["Harbor Plumbing & Drain"]).status).toBe("pass");
    // The spelled-out form must not make "and" a required word elsewhere.
    expect(checkBusinessSchema([{ ...yoast, name: "Skin & Lab" }], ["SkinLab"]).status).toBe("pass");
    expect(checkBusinessSchema([{ ...yoast, name: "SkinLab" }], ["Skin & Lab"]).status).toBe("pass");
    // A longer name that only starts with ours is still another business.
    expect(checkBusinessSchema([{ ...yoast, name: "Harbor Plumbing & Heating" }], NAMES).status).toBe("warn");
  });

  it("skips the name rule when the node has no name or no names were given", () => {
    expect(checkBusinessSchema([node({ telephone: "503-555-1234" })], NAMES).status).toBe("pass");
    expect(checkBusinessSchema([node({ name: "Portland Drain Pros", telephone: "503-555-1234" })], []).status).toBe("pass");
  });

  it("finds business nodes inside @graph and nested markup", () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
      {"@type":"WebSite","name":"Harbor"},
      {"@type":"Plumber","name":"Harbor Plumbing","telephone":"(503) 555-1234","address":{"@type":"PostalAddress","streetAddress":"123 Main St"}}
    ]}</script>`;
    const nodes = jsonLdNodes(html);
    expect(nodes.map(n => n["@type"])).toEqual(["WebSite", "Plumber", "PostalAddress"]);
    expect(checkBusinessSchema(nodes, NAMES).status).toBe("pass");
  });
});

describe("contact details in plain text", () => {
  const check = (text: string, nodes: Record<string, unknown>[] = []) => checkContactVisible({ text, nodes });
  const HOURS = "Mon-Fri 8am-5pm";
  const PHONE = "(503) 555-1234";

  it("accepts North American phone numbers with separators, parentheses, +1 or a tel: link", () => {
    for (const phone of [
      "(503) 555-1234", "(503)555-1234", "503-555-1234", "503.555.1234", "503 555 1234", "1-800-555-1234",
      "+1 503 555 1234", "+1 (503) 555-1234", "+1-503-555-1234", "+15035551234", "tel:+15035551234", "tel:503-555-1234",
    ]) {
      expect(check(`Call ${phone} today. ${HOURS}`).status, phone).toBe("pass");
    }
  });

  it("does not take ten bare digits for a phone", () => {
    expect(check(`Order 5035551234 shipped. ${HOURS}`).status).toBe("warn");
  });

  it("rejects licence, permit and registration numbers, but keeps a phone printed next to one", () => {
    for (const licence of [
      "Lic. #503-555-1234", "Lic #503-555-1234", "License 503-555-1234", "Licence 503-555-1234", "CCB 123-456-7890",
      "CCB# 123-456-7890", "Permit No. 503-555-1234", "Reg. 503-555-1234", "Reg# 503-555-1234", "#503-555-1234",
    ]) {
      expect(check(`${licence}. ${HOURS}`).status, licence).toBe("warn");
    }
    expect(check(`CCB #123456 · (503) 555-1234. ${HOURS}`).status).toBe("pass");
    expect(check(`Lic. #987654 | Call 503-555-1234. ${HOURS}`).status).toBe("pass");
    // "Oregon" is not a registration mark.
    expect(check(`Portland, Oregon 503-555-1234. ${HOURS}`).status).toBe("pass");
  });

  it("accepts a street number, a street name and every listed suffix", () => {
    for (const address of [
      "123 Main Street", "123 Main St", "123 MAIN ST", "100 5th Avenue", "100 5th Ave", "4500 SW Hall Boulevard",
      "4500 SW Hall Blvd.", "88 Mill Road", "88 Mill Rd", "7 Oak Drive", "7 Oak Dr", "9 Elm Lane", "9 Elm Ln",
      "15 Harbor Way", "3 Willow Court", "3 Willow Ct", "22 Park Place", "22 Park Pl", "4100 River Parkway",
      "4100 River Pkwy", "12345 SW Pacific Highway", "12345 SW Pacific Hwy", "1234 NE Broadway Suite 200",
      "500 Center St Ste 4", "12 Martin Luther King Jr. Blvd",
    ]) {
      expect(check(`Find us at ${address}, Portland. ${HOURS}`).status, address).toBe("pass");
    }
  });

  it("does not take a drive time or a bare number for an address", () => {
    expect(check(`A 20 minute drive from downtown, 2 hour drive from the coast. ${HOURS}`).status).toBe("warn");
    expect(check(`Open 7 days a week, 123 St. ${HOURS}`).status).toBe("warn");
  });

  it("accepts a lower-case address when a comma, period or line break follows the suffix", () => {
    expect(check(`1234 ne broadway st, portland. ${HOURS}`).status).toBe("pass");
    expect(check(`123 main street, portland. ${HOURS}`).status).toBe("pass");
    expect(check(`1234 ne broadway st\nportland, or 97232\n${HOURS}`).status).toBe("pass");
    expect(check(`123 main st suite 4, portland. ${HOURS}`).status).toBe("pass");
    expect(check(`${HOURS}. find us at 88 mill rd.`).status).toBe("pass");
  });

  it("does not take lower-case prose with a number and a street word for an address", () => {
    for (const prose of [
      "we have 3 trucks on the way, and more coming", "about 4 blocks down the road, turn left", "took 3 months to pave the road.",
      "over 200 happy clients served in the st louis area", "save 50 dollars a year on the way home.", "a 10 person team ready to drive.",
      "we offer 2 kinds of place settings", "book 2 appointments the same way.", "the next 5 years down this road, we grow",
      "1234 ne broadway st portland",
    ]) {
      expect(check(`${prose} ${HOURS}`).status, prose).toBe("warn");
    }
  });

  it("finds hours after a day name or range, after an open or hours label, and always-open wording", () => {
    for (const hours of [
      "Mon-Fri 8am-5pm", "Mon – Sat 9 AM – 6 PM", "Monday to Friday: 8:00 AM to 5:00 PM", "Open daily until 9pm",
      "Every day 10:00 - 22:00", "Weekdays 7:30am to 4pm", "Weekends 10am–2pm", "Tues 9am", "Sat 8:00",
      "Hours: 9am – 6pm", "Open 9 a.m. to 5 p.m.", "We are open from 8:30am until 4:30pm", "Open 9-5pm",
      "Hours 10am to noon", "Open 24/7", "Available 24 hours a day", "24-hour emergency service", "We work around the clock",
      "Mon—Fri 9am—5pm", "Hours: 9am — 5pm", "Open 24 hours", "We're available 24 hours", "24 hour service", "24/7 emergency plumbing",
      "24 hours a day, 7 days a week",
    ]) {
      expect(check(`Call ${PHONE}. ${hours}`).status, hours).toBe("pass");
    }
  });

  it("accepts a clock range without am/pm after a day or a label, and m-f style day ranges", () => {
    for (const hours of [
      "Mon-Fri 9-5, Sat 9-1", "Monday - Friday: 8 - 5", "Hours: 8-5", "Mon-Fri 9 to 5", "Mon–Fri 9–5", "Hours Monday through Friday 7-4",
      "M-F 8am-5pm", "M-F 8-5", "M-Sat 9-6", "M-Th 7-3",
    ]) {
      expect(check(`Call ${PHONE}. ${hours}`).status, hours).toBe("pass");
    }
  });

  it("does not take a count after a day or a label for a clock range", () => {
    for (const text of [
      "Open 1-2 business days after you order", "Hours of work: 2-3 weeks per project", "Open to ages 5-12", "Open 2-3 slots left",
      "Mon 5-10 lb bags", "Sat 1-2 inch snowfall expected", "Open 10-20% off", "Hours: 1-2 hours per visit",
    ]) {
      expect(check(`Call ${PHONE}. ${text}`).status, text).toBe("warn");
    }
  });

  it("does not take a turnaround promise for always-open hours", () => {
    for (const text of [
      "We respond to every request within 24 hours", "We reply within 24 hours", "Quotes returned in 24 hours", "Get a quote in 24 hours",
      "24 hours notice for cancellations", "Results in 24-48 hours",
    ]) {
      expect(check(`${text}. Call ${PHONE}`).status, text).toBe("warn");
    }
  });

  it("does not take a dated post or event line for hours", () => {
    for (const text of [
      "Posted Monday, March 3, 2025 at 10:15 am", "Join us Saturday, June 14, 2025 at 6:30 pm for our open house",
      "Saturday, June 14 @ 6:30 pm", "Saturday, Jun 14 @ 6:30 pm", "Published Friday, May 2, 2025 10:15", "Posted Monday, May 5 at 10:15 am",
      "Monday, March 3-5, 2025",
    ]) {
      expect(check(`${text}. Call ${PHONE}`).status, text).toBe("warn");
    }
    // Real hours next to a dated line, and a month word outside the span, still count.
    expect(check(`Posted Monday, March 3, 2025 at 10:15 am. Mon-Fri 9am-5pm. Call ${PHONE}`).status).toBe("pass");
    expect(check(`Posted Monday, March 3, 2025 at 10:15 am. Tuesday 9am-5pm. Call ${PHONE}`).status).toBe("pass");
    expect(check(`Open Monday to Friday 9am to 5pm since 1998. Call ${PHONE}`).status).toBe("pass");
    expect(check(`Monday to Friday 9am to 5pm. Hours may vary on holidays. Call ${PHONE}`).status).toBe("pass");
  });

  it("does not take a day without a time, or a label without a range, for hours", () => {
    for (const text of ["Saturday: Closed", "Call us Monday", "Open now", "Hours vary by season", "Open until late", "Sunset Blvd 10 years"]) {
      expect(check(`Call ${PHONE}. ${text}`).status, text).toBe("warn");
    }
  });

  it("reads a per-day hours table the way the page text comes out", () => {
    const html = `<table>
      <tr><td>Monday</td><td>9:00 AM - 5:00 PM</td></tr>
      <tr><td>Tuesday</td><td>9:00 AM - 5:00 PM</td></tr>
      <tr><td>Saturday</td><td>Closed</td></tr>
    </table><p>Call <a href="tel:+15035551234">us</a></p>`;
    expect(check(`${htmlToText(html)}\ntel:+15035551234`).status).toBe("pass");
  });

  it("takes hours from a business node's JSON-LD when the text has none", () => {
    const business = { "@type": "LocalBusiness", openingHours: "Mo-Fr 09:00-17:00" };
    expect(check(`Call ${PHONE}`, [business]).status).toBe("pass");
    expect(check(`Call ${PHONE}`, [{ "@type": "Plumber", openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", opens: "09:00" }] }]).status).toBe("pass");
    expect(check(`Call ${PHONE}`, [{ "@type": "LocalBusiness", openingHours: [] }]).status).toBe("warn");
    // Hours on a node that is not the business (an event) say nothing.
    expect(check(`Call ${PHONE}`, [{ "@type": "Event", openingHours: "Mo-Fr 09:00-17:00" }]).status).toBe("warn");
    // JSON-LD counts for hours only; the phone has to be in the text.
    expect(check("Welcome", [{ "@type": "LocalBusiness", telephone: "503-555-1234", openingHours: "Mo-Fr 09:00-17:00" }]).status).toBe("warn");
  });

  it("grades pass, warn and fail, and the fix names what is missing", () => {
    expect(check(`${PHONE} ${HOURS}`).status).toBe("pass");
    expect(check(`123 Main St ${HOURS}`).status).toBe("pass");
    const noHours = check(`Call ${PHONE}`);
    expect(noHours.status).toBe("warn");
    expect(noHours.fix).toBe("Put your opening hours in plain text on your homepage or contact page.");
    const noReach = check(HOURS);
    expect(noReach.status).toBe("warn");
    expect(noReach.fix).toBe("Put your phone number and address in plain text on your homepage or contact page.");
    const nothing = check("Welcome to our site");
    expect(nothing.status).toBe("fail");
    expect(nothing.fix).toBe("Put your phone number, address and opening hours in plain text on your homepage or contact page.");
  });
});

describe("runWebsiteCheck", () => {
  const long = "Harbor Plumbing and Drain fixes leaks, drains and water heaters across Portland. ".repeat(20);
  const business = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Harbor Plumbing and Drain",
    "telephone":"+1 503 555 0100","address":{"@type":"PostalAddress","streetAddress":"123 Main St","addressLocality":"Portland"},
    "openingHours":"Mo-Fr 08:00-17:00"}</script>`;
  const site: Record<string, { body: string; type?: string; status?: number }> = {
    "https://harbor.example": { body: `<title>Harbor</title><a href="/about">About</a><a href="/pricing">Prices</a>${business}
      <p>${long}</p><p>Call <a href="tel:+15035550100">us</a> · 123 Main St, Portland · Mon-Fri 8am-5pm</p>` },
    "https://harbor.example/about": { body: "<title>About us</title><p>Founded 2019</p>" },
    "https://harbor.example/pricing": { body: `<title>Prices</title><script type="application/ld+json">{"@type":"Offer"}</script>` },
    "https://harbor.example/robots.txt": { body: "User-agent: *\nAllow: /\nSitemap: https://harbor.example/sitemap.xml", type: "text/plain" },
    "https://harbor.example/sitemap.xml": { body: "<urlset></urlset>", type: "application/xml" },
  };
  const fetchFor = (pages: typeof site, log: string[] = []) => (async (input: string | URL | Request) => {
    log.push(String(input));
    const hit = pages[String(input)];
    return hit
      ? new Response(hit.body, { status: hit.status ?? 200, headers: { "content-type": hit.type ?? "text/html" } })
      : new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
  }) as typeof fetch;
  const fakeFetch = fetchFor(site);

  it("passes a well-built site on every one of the seven checks, in order", async () => {
    const result = await runWebsiteCheck("harbor.example", fakeFetch, { names: ["Harbor Plumbing and Drain", "Harbor Plumbing"] });
    expect(result.error).toBeUndefined();
    expect(result.checks.map(c => [c.id, c.status])).toEqual([
      ["ai_allowed", "pass"], ["readable_text", "pass"], ["facts_page", "pass"], ["machine_labels", "pass"], ["sitemap", "pass"],
      ["business_schema", "pass"], ["contact_visible", "pass"],
    ]);
    expect(result.pages.map(p => p.url)).toEqual(["https://harbor.example", "https://harbor.example/about", "https://harbor.example/pricing"]);
    expect(result.homepageText).toContain("water heaters");
  });

  it("still runs with one or two arguments, skipping the schema name rule", async () => {
    const result = await runWebsiteCheck("harbor.example", fakeFetch);
    expect(result.checks.find(c => c.id === "business_schema")?.status).toBe("pass");
  });

  it("warns on business schema that names another business", async () => {
    const result = await runWebsiteCheck("harbor.example", fakeFetch, { names: ["Portland Drain Pros"] });
    expect(result.checks.find(c => c.id === "business_schema")?.status).toBe("warn");
  });

  it("tries /contact when no fact-looking link is a contact page, tolerating a 404", async () => {
    const log: string[] = [];
    const result = await runWebsiteCheck("harbor.example", fetchFor(site, log));
    expect(log).toContain("https://harbor.example/contact");
    expect(result.error).toBeUndefined();
    expect(result.pages.map(p => p.url)).not.toContain("https://harbor.example/contact");
  });

  it("reads the phone and hours from the contact page, tel: links included", async () => {
    const pages: typeof site = {
      ...site,
      "https://harbor.example": { body: `<title>Harbor</title><a href="/about">About</a><p>${long}</p>` },
      "https://harbor.example/contact": { body: `<title>Contact</title><p><a href="tel:+1-503-555-0100">Call</a></p><p>Hours: 8am - 5pm</p>` },
    };
    const result = await runWebsiteCheck("harbor.example", fetchFor(pages));
    expect(result.checks.find(c => c.id === "contact_visible")?.status).toBe("pass");
    expect(result.pages.map(p => p.url)).toContain("https://harbor.example/contact");
  });

  it("uses a linked contact-like page instead of guessing /contact", async () => {
    const log: string[] = [];
    const pages: typeof site = {
      ...site,
      "https://harbor.example": { body: `<title>Harbor</title><a href="/visit-us">Visit</a><p>${long}</p>` },
      "https://harbor.example/visit-us": { body: `<title>Visit</title><p>Call (503) 555-0100. Open daily 8am to 6pm.</p>` },
    };
    const result = await runWebsiteCheck("harbor.example", fetchFor(pages, log));
    expect(log).not.toContain("https://harbor.example/contact");
    expect(result.checks.find(c => c.id === "contact_visible")?.status).toBe("pass");
  });

  it("fetches a fee, estimate or quote page so the facts check can pass on it", async () => {
    const log: string[] = [];
    const pages: typeof site = {
      ...site,
      "https://harbor.example": { body: `<title>Harbor</title><a href="/about">About</a><a href="/free-estimate">Free estimate</a><p>${long}</p>` },
      "https://harbor.example/free-estimate": { body: "<title>Free estimate</title><p>We quote every job before we start.</p>" },
    };
    const result = await runWebsiteCheck("harbor.example", fetchFor(pages, log));
    expect(log).toContain("https://harbor.example/free-estimate");
    expect(result.pages.map(p => p.url)).toContain("https://harbor.example/free-estimate");
    expect(result.checks.find(c => c.id === "facts_page")?.status).toBe("pass");
  });

  it("keeps the facts check at warn when only the site name says services", async () => {
    const pages: typeof site = {
      ...site,
      "https://harbor.example": { body: `<title>Harbor Plumbing Services</title><a href="/about">About</a><p>${long}</p>` },
      "https://harbor.example/about": { body: "<title>About | Harbor Plumbing Services</title><p>Founded 2019</p>" },
    };
    const result = await runWebsiteCheck("harbor.example", fetchFor(pages));
    expect(result.checks.find(c => c.id === "facts_page")?.status).toBe("warn");
  });

  it("gives the seventh page slot to /contact when seven fact links hold none", async () => {
    const log: string[] = [];
    const links = ["/about", "/team", "/pricing", "/services", "/products", "/faq", "/menu"];
    const pages: typeof site = {
      ...site,
      "https://harbor.example": { body: `<title>Harbor</title>${links.map(l => `<a href="${l}">${l}</a>`).join("")}<p>${long}</p>` },
      ...Object.fromEntries(links.map(l => [`https://harbor.example${l}`, { body: `<title>${l}</title>` }])),
      "https://harbor.example/contact": { body: `<title>Contact</title><p>Call (503) 555-0100. Mon-Fri 8am-5pm. 123 Main St, Portland</p>` },
    };
    const result = await runWebsiteCheck("harbor.example", fetchFor(pages, log));
    expect(log).toContain("https://harbor.example/contact");
    expect(log).not.toContain("https://harbor.example/menu");
    expect(result.pages.map(p => p.url)).toEqual([
      "https://harbor.example", ...links.slice(0, 6).map(l => `https://harbor.example${l}`), "https://harbor.example/contact",
    ]);
    expect(result.checks.find(c => c.id === "contact_visible")?.status).toBe("pass");
  });

  it("reports an unreachable site instead of throwing", async () => {
    const result = await runWebsiteCheck("https://down.example", fakeFetch);
    expect(result.error).toMatch(/Could not load/);
    expect(result.checks).toEqual([]);
  });

  it("refuses internal addresses", async () => {
    expect((await runWebsiteCheck("http://localhost:3000", fakeFetch)).error).toMatch(/public/);
  });
});
