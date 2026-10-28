import type { SourceKind } from "@/core/citations";
import type { WebsiteCheckRow } from "@/core/website-check";

/**
 * Step-by-step guides for the playbook's moves. Pure and written by hand, so
 * every step and every link is one we stand behind: no model writes these.
 * Each guide is filled in with the business's own details and what its scan
 * saw (the pages AI read, the question it lost, who it named), and leaves a
 * [bracketed] gap where only the owner knows the answer.
 *
 * Links are business sign-up pages we have opened. A site that blocks
 * automated checks gets its homepage and a pointer to its business link.
 */

export interface GuideLink { label: string; url: string }

export interface GuideStep {
  title: string;
  detail?: string;
  links?: GuideLink[];
  /** Text to copy and paste, shown with a copy button. */
  copy?: { label: string; text: string };
}

/** What every guide knows about the business. */
export interface GuideBusiness {
  name: string;
  category?: string | null;
  location?: string | null;
  website?: string | null;
}

interface Platform {
  name: string;
  /** Where a business signs up or claims its listing. */
  url: string;
  /** Said when `url` is the site's homepage rather than its business page. */
  hint?: string;
}

const FIND_BUSINESS_LINK = "At the bottom of the homepage, find the link for businesses (it's usually called \"For Business\", \"For Vendors\" or \"Claim your listing\").";

const PLATFORMS: Record<string, Platform> = {
  "yelp.com": { name: "Yelp", url: "https://business.yelp.com" },
  "nextdoor.com": { name: "Nextdoor", url: "https://business.nextdoor.com" },
  "bbb.org": { name: "the BBB", url: "https://www.bbb.org/get-listed" },
  "houzz.com": { name: "Houzz", url: "https://pro.houzz.com" },
  "trustpilot.com": { name: "Trustpilot", url: "https://business.trustpilot.com" },
  "thumbtack.com": { name: "Thumbtack", url: "https://www.thumbtack.com/pro" },
  "homeadvisor.com": { name: "HomeAdvisor", url: "https://www.homeadvisor.com/pro" },
  "alignable.com": { name: "Alignable", url: "https://www.alignable.com" },
  "tripadvisor.com": { name: "Tripadvisor", url: "https://www.tripadvisor.com/Owners" },
  "theknot.com": { name: "The Knot", url: "https://www.theknot.com", hint: FIND_BUSINESS_LINK },
  "weddingwire.com": { name: "WeddingWire", url: "https://www.weddingwire.com", hint: FIND_BUSINESS_LINK },
  "facebook.com": { name: "Facebook", url: "https://www.facebook.com" },
  "instagram.com": { name: "Instagram", url: "https://www.instagram.com" },
  "reddit.com": { name: "Reddit", url: "https://www.reddit.com" },
};

const GOOGLE_PROFILE = "https://business.google.com";
const SEARCH_CONSOLE = "https://search.google.com/search-console";
const BING_WEBMASTERS = "https://www.bing.com/webmasters";

const quote = (s: string) => `“${s.replace(/\*\*/g, "")}”`;

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const kindOf = (b: GuideBusiness) => b.category?.trim().toLowerCase() || "[what you do]";
const whereOf = (b: GuideBusiness) => b.location?.trim() || "[your city]";
const siteOf = (b: GuideBusiness) => b.website?.trim() || "[your website]";

function pageLinks(pages: string[]): GuideLink[] {
  return pages.map(url => ({ label: url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), url }));
}

/** The facts every listing asks for, in one block to paste. */
export function factsBlock(b: GuideBusiness): string {
  return [
    `${b.name} is a ${kindOf(b)} in ${whereOf(b)}.`,
    "",
    "What we offer: [your main services or products]",
    "Prices: [typical prices, or how you quote]",
    `Where we work: ${whereOf(b)} and [nearby areas]`,
    "Hours: [your opening hours]",
    "Phone: [your phone number]",
    `Website: ${siteOf(b)}`,
  ].join("\n");
}

function reviewAsk(b: GuideBusiness, site: string): string {
  return `Hi [first name], thank you for choosing ${b.name}! If you have a minute, would you leave us a review on ${site}? It helps other people find us, and it means a lot to a small business. Saying what we did for you helps most. Here's the link: [paste your ${site} review link]`;
}

const recheck: GuideStep = {
  title: "Mark this step done",
  detail: "Tick it off here. Your next scan checks whether AI has picked up the change; it usually takes a few weeks.",
};

/** Getting on, or standing out on, a site AI read when it named someone else. */
export function sourceGuide(args: {
  business: GuideBusiness;
  domain: string;
  kind: SourceKind;
  /** The business is already on the site. */
  onIt: boolean;
  /** Pages on the site that AI read in the answers that left the business out. */
  pages: string[];
  /** Who those answers named instead. */
  named: string[];
  /** The buyer questions those answers came from. */
  questions: string[];
}): GuideStep[] {
  const { business: b, domain, kind, onIt, pages, named, questions } = args;
  const read: GuideStep | null = pages.length ? {
    title: "Open the pages AI read",
    detail: `These are the ${domain} pages AI read in answers that ${named.length ? `named ${listOf(named)} and not you` : "left you out"}. Look at what the businesses it named have that you don't: more reviews, more photos, prices, a full description.`,
    links: pageLinks(pages),
  } : null;
  const words = questions.length ? ` Customers asked AI things like ${listOf(questions.slice(0, 2).map(quote))}, so use those words where they fit.` : "";

  if (kind === "google") {
    return [
      {
        title: "Open your Google Business Profile",
        detail: `Sign in with the Google account you use for ${b.name}, then search for your business. If it's yours but unclaimed, choose "Claim this business"; if it isn't there, choose "Add your business".`,
        links: [{ label: "Google Business Profile", url: GOOGLE_PROFILE }],
      },
      { title: "Verify it", detail: "Google asks you to prove you own it, by phone, email, video or postcard. You can't edit most details until this is done." },
      {
        title: "Fill in every field",
        detail: `Pick the most precise primary category (for you, something like "${kindOf(b)}"), then add services or products with prices, hours, phone, website and a description.${words}`,
        copy: { label: "Description to paste and edit", text: factsBlock(b) },
      },
      { title: "Add at least 10 photos", detail: "Your best work, your storefront or team, and your products. Profiles with photos get far more clicks." },
      {
        title: "Ask 5 happy customers for a review",
        detail: "In your profile, choose \"Ask for reviews\" to get your review link, then send it with this message.",
        copy: { label: "Review request to send", text: reviewAsk(b, "Google") },
      },
      ...(read ? [read] : []),
      recheck,
    ];
  }

  const platform = PLATFORMS[domain];
  const siteName = platform?.name ?? domain;
  // "for business" only when the link is the business page itself.
  const open: GuideLink[] = [{ label: platform && !platform.hint ? `${siteName} for business` : siteName, url: platform?.url ?? `https://${domain}` }];

  if (kind === "press" || kind === "other") {
    return [
      ...(read ? [{ ...read, title: "Read the article AI read", detail: `AI read ${pages.length === 1 ? "this page" : "these pages"} on ${domain} and named ${named.length ? listOf(named) : "other businesses"}, not you.` }] : []),
      { title: "Find who wrote it", detail: "Look for the writer's name at the top or bottom of the article, then their email on the site's contact or about page, or on their social profile." },
      {
        title: "Send a short pitch",
        detail: "Keep it under 120 words. Say what makes you different, with one photo and a link. Don't attach files.",
        copy: {
          label: "Email to send",
          text: [
            `Subject: A ${kindOf(b)} in ${whereOf(b)} for your list`,
            "",
            "Hi [writer's name],",
            "",
            `I read your piece on ${domain} and loved it. I run ${b.name}, a ${kindOf(b)} in ${whereOf(b)}. [One sentence on what makes you different: a specialty, an award, a number.]`,
            "",
            `If you update the article, I'd love for ${b.name} to be considered. Photos and details are at ${siteOf(b)}, and I'm happy to answer anything.`,
            "",
            "Thanks,",
            "[your name]",
            "[your phone]",
          ].join("\n"),
        },
      },
      { title: "Follow up once after a week", detail: "One short, friendly nudge. If there's no reply after that, move on." },
      recheck,
    ];
  }

  if (kind === "social") {
    const forum = domain === "reddit.com" || domain === "quora.com";
    if (forum) {
      return [
        ...(read ? [{ ...read, title: "Open the threads AI read", detail: `AI read these threads and named ${named.length ? listOf(named) : "other businesses"}, not you.` }] : []),
        { title: "Make an account as yourself", detail: `Use your own name or ${b.name}. Read the community's rules first: many ban ads but welcome owners who answer honestly.`, links: open },
        {
          title: "Answer the question, honestly",
          detail: "Reply where someone is asking for a recommendation. Say you're the owner, answer what they asked, and link your site once.",
          copy: { label: "Reply to adapt", text: `Full disclosure, I own ${b.name}, a ${kindOf(b)} in ${whereOf(b)}. [Answer their question in 2 or 3 sentences: what you'd do for them and roughly what it costs.] Happy to help here or at ${siteOf(b)}.` },
        },
        { title: "Ask customers who love you", detail: "When a regular mentions they're on the site, it's fine to say you'd appreciate a mention if the topic comes up. Never post fake recommendations." },
        recheck,
      ];
    }
    return [
      { title: `Open ${siteName}`, detail: platform?.hint ?? `Sign in, and create a business page or profile for ${b.name} if you don't have one.`, links: open },
      { title: "Use your exact business name", detail: `Name it "${b.name}", exactly as on your website, so AI knows it's you.` },
      { title: "Fill in the bio and link", detail: `Say what you do, where, and link ${siteOf(b)}.${words}`, copy: { label: "Bio to paste", text: `${b.name}: ${kindOf(b)} in ${whereOf(b)}. [What you're known for.] ${siteOf(b)}` } },
      { title: "Post your work", detail: "Post 6 to 10 photos or short videos of your best work, each with a sentence saying what it is and where." },
      ...(read ? [read] : []),
      recheck,
    ];
  }

  // Reviews sites and directories.
  return [
    onIt
      ? { title: `Open your ${siteName} listing`, detail: `You're already on ${siteName}. Sign in to your business account so you can edit the listing.`, links: open }
      : {
        title: `Find or add ${b.name} on ${siteName}`,
        detail: `Search ${siteName} for ${b.name}. If you're listed, open the listing and choose "Claim this business". If you're not, sign up as a business. ${platform?.hint ?? ""}`.trim(),
        links: open,
      },
    { title: "Verify that it's yours", detail: "Most sites confirm by phone or email. You can't edit the listing until this is done." },
    {
      title: "Fill in every field",
      detail: `Category, services, prices, hours, phone and website. Leave nothing blank: AI favours complete listings.${words}`,
      copy: { label: "Details to paste and edit", text: factsBlock(b) },
    },
    { title: "Add at least 10 photos", detail: `Your best work first. Caption each one if the site lets you, for example "${kindOf(b)} in ${whereOf(b)}".` },
    {
      title: "Ask 5 happy customers for a review",
      detail: `Reviews that describe what you did are the ones AI repeats. Get your ${siteName} review link from your business account and send this.`,
      copy: { label: "Review request to send", text: reviewAsk(b, siteName) },
    },
    ...(read ? [read] : []),
    recheck,
  ];
}

/** A buyer question AI answered without naming the business. */
export function questionGuide(args: {
  business: GuideBusiness;
  question: string;
  named: string[];
  /** Sites AI read for the question that the business can get onto. */
  getOnto: string[];
  standOut: string[];
}): GuideStep[] {
  const { business: b, question, named, getOnto, standOut } = args;
  return [
    {
      title: "Add a section that answers this exact question",
      detail: `Put it on your FAQ page or the most relevant service page. Use the question as the heading, and answer it in the first sentence.${named.length ? ` AI named ${listOf(named)}: say plainly what makes you different, without naming them.` : ""}`,
      copy: {
        label: "Section to paste and fill in",
        text: [
          question.replace(/\*\*/g, ""),
          "",
          `${b.name} is a ${kindOf(b)} in ${whereOf(b)} that [what you do best]. We're the right choice if you're looking for [who you serve best].`,
          "",
          "• What we offer: [the services that answer this question]",
          "• Price range: [from $X, or how you quote]",
          `• Where: ${whereOf(b)} and [nearby areas]`,
          "• What makes us different: [a specialty, an award, a number]",
          `• How to book: [phone, form or link on ${siteOf(b)}]`,
        ].join("\n"),
      },
    },
    { title: "Link to it from your homepage", detail: "Add it to your menu or footer so it's one click from the homepage. AI finds pages the same way people do." },
    ...(getOnto.length ? [{
      title: `Get onto ${listOf(getOnto)}`,
      detail: "AI read these sites for this question. Each has its own step in your next steps, with a full guide.",
      links: getOnto.map(d => ({ label: PLATFORMS[d]?.name ?? d, url: PLATFORMS[d]?.url ?? `https://${d}` })),
    }] : []),
    ...(standOut.length ? [{
      title: `Stand out on ${listOf(standOut)}`,
      detail: "You're already on these, but AI named others there for this question. Complete your listing and add recent reviews.",
    }] : []),
    {
      title: "Ask customers to use these words",
      detail: `When you ask for reviews, ask customers to say what they came to you for. A review that says what this question asks is the evidence AI looks for.`,
    },
    recheck,
  ];
}

/** Pages AI searched for that the site doesn't have, by what the page is. */
const PAGE_GUIDES: { test: RegExp; steps: (b: GuideBusiness, updated: string) => GuideStep[] }[] = [
  {
    test: /price/,
    steps: b => [
      { title: "Make a page called \"Prices\"", detail: "List each main service or product with a price, a \"from\" price, or how you quote. A range is far better than nothing." },
      {
        title: "Use a simple list AI can read",
        copy: { label: "Price list to fill in", text: [`${b.name} prices`, "", "[Service or product]: from $[price]", "[Service or product]: $[price] to $[price]", "[Service or product]: priced by quote, usually $[range]", "", "[What's included, deposits, delivery]", "Last updated: [month year]"].join("\n") },
      },
      { title: "Link it from your menu", detail: "Put \"Prices\" in your main menu, and add the same prices to your Google Business Profile." },
    ],
  },
  {
    test: /review/,
    steps: b => [
      { title: "Make a page called \"Reviews\"", detail: "Collect 5 to 10 short quotes from real customers, each with a first name and what you did for them." },
      { title: "Link to where people review you", detail: "Add buttons to your Google and Yelp review pages so new reviews keep coming in." },
      { title: "Keep it current", detail: `Add a new review every month or two. Dated, recent reviews read as a business that's open and busy.`, copy: { label: "Heading to use", text: `What customers say about ${b.name}` } },
    ],
  },
  {
    test: /hours|booking/,
    steps: () => [
      { title: "Put your hours on their own page or section", detail: "In plain text, not an image: each day with opening and closing times, and holiday hours." },
      { title: "Say exactly how to book", copy: { label: "Text to paste and fill in", text: "Hours\nMonday to Friday: [9am to 5pm]\nSaturday: [10am to 2pm]\nSunday: Closed\n\nHow to book: [call, book online at your link, or walk in]\nLead time: [how far ahead to book]" } },
      { title: "Match your listings", detail: "Make the hours on Google, Yelp and your site say exactly the same thing." },
    ],
  },
  {
    test: /location/,
    steps: b => [
      { title: "Make a location page", detail: `Your full address, the areas you serve, parking, and a map. Name the neighbourhoods and towns near ${whereOf(b)} that you serve.` },
      { title: "Paste your details in plain text", copy: { label: "Text to fill in", text: `${b.name}\n[street address]\n${whereOf(b)}\n\nWe serve: [neighbourhoods and nearby towns]\nParking: [where to park]` } },
    ],
  },
  {
    test: /this-year|year/,
    steps: (_b, updated) => [
      { title: "Date your key pages", detail: `Add "Updated ${updated}" to your prices, menu and hours pages.`, copy: { label: "Line to add", text: `Updated ${updated}` } },
      { title: "Refresh what's old", detail: "Change anything that's out of date: last year's prices, old photos, past events." },
    ],
  },
  {
    test: /comparison/,
    steps: b => [
      { title: "Make a \"Why choose us\" page", detail: "AI is weighing options. Say plainly how you're different, without naming competitors." },
      { title: "Use clear points", copy: { label: "Text to fill in", text: `Why choose ${b.name}\n\n• [What you do that others don't]\n• [Experience, awards or numbers]\n• [Price or value]\n• [Who you're best for]` } },
    ],
  },
];

export function pageGuide(args: { business: GuideBusiness; pageKey: string; searches: string[]; updated: string }): GuideStep[] {
  const { business: b, pageKey, searches, updated } = args;
  const found = PAGE_GUIDES.find(g => g.test.test(pageKey));
  const steps = found ? found.steps(b, updated) : [{ title: "Add the page", detail: "Write it in plain text and link it from your homepage." }];
  return [
    ...(searches.length ? [{ title: "Why AI wants this page", detail: `Before answering your customers, AI searched for ${listOf(searches)}. A page that answers that is what it was looking for.` }] : []),
    ...steps,
    recheck,
  ];
}

// The robots.txt lines that let every assistant we check read the site.
const ROBOTS_ALLOW = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot",
  "PerplexityBot", "Perplexity-User", "Google-Extended",
].map(a => `User-agent: ${a}\nAllow: /`).join("\n\n");

export function websiteGuide(id: WebsiteCheckRow["id"], b: GuideBusiness): GuideStep[] {
  const site = siteOf(b).replace(/\/$/, "");
  const steps: Record<WebsiteCheckRow["id"], GuideStep[]> = {
    ai_allowed: [
      { title: "Open your robots.txt", detail: "It's the file that tells crawlers what they may read.", links: b.website ? [{ label: `${site}/robots.txt`, url: `${site}/robots.txt` }] : undefined },
      { title: "Find what's blocking AI", detail: "Look for \"Disallow: /\" under a line naming GPTBot, ClaudeBot, PerplexityBot or Google-Extended, or under \"User-agent: *\"." },
      {
        title: "Allow the AI assistants",
        detail: "On WordPress, edit robots.txt with your SEO plugin (Yoast or Rank Math). On Wix, use the robots.txt editor in its SEO settings. On Squarespace, check the crawler settings and make sure AI crawlers aren't blocked. Otherwise, send this to whoever runs your site.",
        copy: { label: "Lines to add to robots.txt", text: ROBOTS_ALLOW },
      },
      recheck,
    ],
    facts_page: [
      { title: "Make an \"About\" page and a \"Services\" page", detail: "Plain text, no images of text. Say what you do, who it's for, where, and what it costs." },
      { title: "Paste in your facts", copy: { label: "Facts to paste and fill in", text: factsBlock(b) } },
      { title: "Link both from your menu", detail: "Every page AI should read needs to be one click from the homepage." },
      recheck,
    ],
    readable_text: [
      { title: "Check what AI sees", detail: "Your homepage text loads with code after the page opens, and many AI crawlers don't run that code, so they see an almost empty page." },
      {
        title: "Ask whoever runs your site to fix it",
        detail: "It's usually a setting (server-side rendering or pre-rendering), not a rebuild.",
        copy: { label: "Message to send them", text: `Hi [name], AI assistants can't read the text on ${site} because it loads with JavaScript after the page opens. Could you turn on server-side rendering or pre-rendering so the text is in the page's HTML? Thanks!` },
      },
      recheck,
    ],
    machine_labels: [
      { title: "Add FAQ and price labels", detail: "These are small bits of code (schema markup) that tell AI \"this is a question and answer\" or \"this is a price\". WordPress plugins like Yoast add them for you; otherwise paste this into the page's code." },
      {
        title: "Paste this FAQ markup",
        copy: {
          label: "FAQ markup to fill in",
          text: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              { "@type": "Question", name: "[A question customers ask]", acceptedAnswer: { "@type": "Answer", text: "[Your answer]" } },
              { "@type": "Question", name: "How much does it cost?", acceptedAnswer: { "@type": "Answer", text: "[Your prices]" } },
            ],
          }, null, 2).replace(/^/, "<script type=\"application/ld+json\">\n").concat("\n</script>"),
        },
      },
      recheck,
    ],
    sitemap: [
      { title: "Check for a sitemap", detail: "Most website builders make one for you. Open this link: if you see a list of your pages, you have one.", links: b.website ? [{ label: `${site}/sitemap.xml`, url: `${site}/sitemap.xml` }] : undefined },
      { title: "Turn it on if it's missing", detail: "On WordPress, Yoast or Rank Math creates one. Wix, Squarespace and Shopify make one automatically once the site is published." },
      { title: "Send it to Google and Bing", detail: "Add your site to each, then submit the sitemap address.", links: [{ label: "Google Search Console", url: SEARCH_CONSOLE }, { label: "Bing Webmaster Tools", url: BING_WEBMASTERS }] },
      recheck,
    ],
    business_schema: [
      { title: "Label your business for machines", detail: "This code tells AI your exact name, address and phone. Paste it into your homepage's code, or use your SEO plugin's \"local business\" settings." },
      {
        title: "Paste this, with your details",
        copy: {
          label: "Business markup to fill in",
          text: `<script type="application/ld+json">\n${JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: b.name,
            url: b.website ?? "[your website]",
            telephone: "[your phone]",
            address: { "@type": "PostalAddress", streetAddress: "[street]", addressLocality: "[city]", addressRegion: "[state]", postalCode: "[zip]" },
            openingHours: "[Mo-Fr 09:00-17:00]",
          }, null, 2)}\n</script>`,
        },
      },
      recheck,
    ],
    contact_visible: [
      { title: "Put your contact details in your footer", detail: "In plain text, not an image, so it's on every page." },
      { title: "Paste and fill in", copy: { label: "Footer text", text: `${b.name}\n[street address], ${whereOf(b)}\nPhone: [your phone]\nHours: Monday to Friday [9am to 5pm], Saturday [10am to 2pm]` } },
      { title: "Match your listings", detail: "Use exactly the same name, address and phone as on Google and Yelp." },
      recheck,
    ],
  };
  return steps[id];
}

export function reputationGuide(b: GuideBusiness, caveats: string[]): GuideStep[] {
  return [
    { title: "Read what AI said", detail: caveats.length ? `AI added: ${listOf(caveats)}.` : "AI named you, then added a caveat." },
    { title: "Find where it comes from", detail: "Search your Google and Yelp reviews for those words. It's usually one or two reviews, or an old page." },
    {
      title: "Reply to the review calmly",
      detail: "Thank them, say what you've changed, and offer to make it right. Never argue.",
      copy: { label: "Reply to adapt", text: `Thank you for the feedback, [name]. You're right that [the issue], and we've since [what you changed]. We'd love the chance to make it right: please reach us at [phone or email]. ${b.name}` },
    },
    { title: "Say it on your site", detail: "If it's about something that's changed (prices, wait times, a policy), say the current facts plainly on your site." },
    { title: "Ask happy customers for reviews", detail: "New, positive reviews push the old one down, and AI reads the recent ones most." },
    recheck,
  ];
}
