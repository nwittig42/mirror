/**
 * The website check: can an AI assistant read this business's site and find
 * its key facts? Pure evaluation functions over what was fetched, so each
 * rule is testable without a network. The fetching lives in
 * services/website-check.ts.
 */
import { detectMention } from "@/core/mention";

export type CheckStatus = "pass" | "warn" | "fail";

export interface WebsiteCheckRow {
  id: "ai_allowed" | "readable_text" | "facts_page" | "machine_labels" | "sitemap" | "business_schema" | "contact_visible";
  label: string;
  why: string;
  fix?: string;
  status: CheckStatus;
}

export interface SitePageInfo { url: string; title: string | null }

/** Everything the check learned, stored on the scan so the report never refetches. */
export interface WebsiteCheckResult {
  checkedAt: string;
  checks: WebsiteCheckRow[];
  /** Pages found on the site (home + fact-looking links), for "pages AI is looking for". */
  pages: SitePageInfo[];
  /** Start of the homepage's visible text, lower-cased, for word matching. */
  homepageText: string;
  /** Set when the site could not be reached at all. */
  error?: string;
}

// The crawlers the major assistants send. "*" rules apply to any of them
// that has no group of its own.
export const AI_AGENTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "Googlebot",
] as const;

interface RobotsGroup { agents: string[]; disallow: string[]; allow: string[] }

export function parseRobots(txt: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "sitemap") { if (value) sitemaps.push(value); continue; }
    if (key === "user-agent") {
      if (!current || !lastWasAgent) { current = { agents: [], disallow: [], allow: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "disallow") current.disallow.push(value);
    if (key === "allow") current.allow.push(value);
  }
  return { groups, sitemaps };
}

/** True when robots.txt blocks `agent` from the whole site ("Disallow: /" with no "Allow: /"). */
export function blocksWholeSite(robots: ReturnType<typeof parseRobots>, agent: string): boolean {
  const a = agent.toLowerCase();
  const own = robots.groups.filter(g => g.agents.includes(a));
  const groups = own.length ? own : robots.groups.filter(g => g.agents.includes("*"));
  return groups.some(g => g.disallow.includes("/") && !g.allow.includes("/"));
}

export function checkAiAllowed(robotsTxt: string | null): WebsiteCheckRow {
  const base = {
    id: "ai_allowed" as const,
    label: "AI assistants are allowed to read your site",
    why: "If your site blocks them, AI answers about you come from other people's pages instead.",
  };
  if (robotsTxt === null) return { ...base, status: "pass" };
  const robots = parseRobots(robotsTxt);
  const blocked = AI_AGENTS.filter(agent => blocksWholeSite(robots, agent));
  if (blocked.length === 0) return { ...base, status: "pass" };
  const fix = `Remove the rule in your robots.txt file that blocks ${blocked.slice(0, 3).join(", ")}${blocked.length > 3 ? " and others" : ""}.`;
  return { ...base, status: blocked.length >= AI_AGENTS.length / 2 ? "fail" : "warn", fix };
}

export function checkReadableText(homepageTextLength: number): WebsiteCheckRow {
  const base = {
    id: "readable_text" as const,
    label: "Your text is readable without special page code",
    why: "Several AI readers don't run the code some sites need to show their text, so they see a blank page.",
  };
  if (homepageTextLength >= 500) return { ...base, status: "pass" };
  const fix = "Ask your web developer to make the homepage text load in the page itself (server-side), not only after scripts run.";
  return { ...base, status: homepageTextLength >= 150 ? "warn" : "fail", fix };
}

const ABOUT = /(about|team|who-we-are|our-story)/i;
const PRICING = /(pricing|price|prices|plans|cost|menu|rates|\bfees?\b|estimate|quote)/i;
const SERVICES = /(service|treatment|product|feature|what-we-do)/i;

// What separates a page's own title from the site name in a <title>:
// "About | Harbor Plumbing", "Prices - Harbor Plumbing", "Team · Harbor".
const TITLE_SEPARATOR = /\s*(?:\||-|–|—|·)\s*/;

/**
 * Each page's title with the site name taken out. A site named "Harbor
 * Plumbing Services" puts that in every title, which is not a services page;
 * a segment that appears in more than one page's title is the site name.
 */
export function titlesWithoutSiteName(pages: SitePageInfo[]): string[] {
  const segments = pages.map(p => (p.title ?? "").split(TITLE_SEPARATOR).map(s => s.trim()).filter(Boolean));
  const pagesPerSegment = new Map<string, number>();
  for (const list of segments) {
    for (const key of new Set(list.map(s => s.toLowerCase()))) pagesPerSegment.set(key, (pagesPerSegment.get(key) ?? 0) + 1);
  }
  return segments.map(list => list.filter(s => (pagesPerSegment.get(s.toLowerCase()) ?? 0) < 2).join(" "));
}

export function checkFactsPage(pages: SitePageInfo[]): WebsiteCheckRow {
  const base = {
    id: "facts_page" as const,
    label: "You have a clear facts page",
    why: "A plain page with what you do, who it's for, prices and location gives AI one correct place to copy from.",
  };
  const titles = titlesWithoutSiteName(pages);
  const texts = pages.map((p, i) => `${new URL(p.url).pathname} ${titles[i]}`);
  const hasAbout = texts.some(t => ABOUT.test(t));
  const hasPricing = texts.some(t => PRICING.test(t));
  const hasServices = texts.some(t => SERVICES.test(t));
  // Many trades never publish a price list (a plumber quotes, a law firm
  // bills by the hour), so an about page plus a services page is enough.
  if (hasAbout && (hasPricing || hasServices)) return { ...base, status: "pass" };
  return {
    ...base,
    status: hasAbout || hasPricing || hasServices ? "warn" : "fail",
    fix: "Add a plain about page and a services page, and state typical prices, fees or how you quote.",
  };
}

/** One object from a page's JSON-LD, as parsed. */
export type JsonLdNode = Record<string, unknown>;

/** Every object with an @type in a page's JSON-LD blocks, parents before their children. */
export function jsonLdNodes(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      const obj = node as JsonLdNode;
      if ("@type" in obj) nodes.push(obj);
      for (const v of Object.values(obj)) if (v && typeof v === "object") walk(v);
    };
    try { walk(JSON.parse(m[1])); } catch { /* malformed block: ignore it */ }
  }
  return nodes;
}

/** A node's @type values (JSON-LD allows one string or a list of them). */
export function nodeTypes(node: JsonLdNode): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  return Array.isArray(t) ? t.filter((x): x is string => typeof x === "string") : [];
}

/** Schema.org types found in a page's JSON-LD blocks. */
export function jsonLdTypes(html: string): string[] {
  return jsonLdNodes(html).flatMap(nodeTypes);
}

const PRICE_OR_FAQ = new Set(["Offer", "AggregateOffer", "PriceSpecification", "UnitPriceSpecification", "Product", "Service", "FAQPage", "MenuItem", "Menu"]);

export function checkMachineLabels(types: string[]): WebsiteCheckRow {
  const base = {
    id: "machine_labels" as const,
    label: "Prices and FAQs are labeled for machines",
    why: "Hidden labels (schema markup) tell AI which number is the price and which text answers a question.",
  };
  if (types.some(t => PRICE_OR_FAQ.has(t))) return { ...base, status: "pass" };
  const fix = "Add schema markup for your prices (Offer) and your FAQ section (FAQPage). Most site builders have a setting or plugin for this.";
  return { ...base, status: types.length > 0 ? "warn" : "fail", fix };
}

export function checkSitemap(found: boolean, listedInRobots: boolean): WebsiteCheckRow {
  const base = {
    id: "sitemap" as const,
    label: "You have a sitemap",
    why: "A sitemap lists every page so AI and search engines find the ones that matter.",
  };
  if (found) return { ...base, status: "pass" };
  return {
    ...base,
    status: listedInRobots ? "warn" : "fail",
    fix: listedInRobots
      ? "Your robots.txt points to a sitemap that doesn't load. Fix the link or regenerate the sitemap."
      : "Publish a sitemap at /sitemap.xml and submit it in Google Search Console and Bing Webmaster Tools.",
  };
}

// schema.org's business types: Organization, LocalBusiness and the subtypes a
// small business marks itself up as. The pattern below catches the rest of
// the family by suffix (AutoBodyShop, LegalService, HairSalon...).
const BUSINESS_TYPES = new Set([
  "Organization", "LocalBusiness", "Corporation", "MedicalOrganization", "EducationalOrganization", "NGO",
  "GovernmentOrganization", "SportsOrganization", "PerformingGroup", "Airline", "NewsMediaOrganization",
  "OnlineBusiness", "OnlineStore", "ProfessionalService",
  "AnimalShelter", "ArchiveOrganization", "ChildCare", "DryCleaningOrLaundry", "EmploymentAgency",
  "InternetCafe", "Library", "RadioStation", "RealEstateAgent", "RecyclingCenter", "SelfStorage",
  "ShoppingCenter", "TelevisionStation", "TouristInformationCenter", "TravelAgency",
  "AutomotiveBusiness", "AutoBodyShop", "AutoDealer", "AutoPartsStore", "AutoRental", "AutoRepair", "AutoWash",
  "GasStation", "MotorcycleDealer", "MotorcycleRepair",
  "EmergencyService", "FireStation", "Hospital", "PoliceStation",
  "EntertainmentBusiness", "AdultEntertainment", "AmusementPark", "ArtGallery", "Casino", "ComedyClub",
  "MovieTheater", "NightClub",
  "FinancialService", "AccountingService", "AutomatedTeller", "BankOrCreditUnion", "InsuranceAgency",
  "FoodEstablishment", "Bakery", "BarOrPub", "Brewery", "CafeOrCoffeeShop", "Distillery", "FastFoodRestaurant",
  "IceCreamShop", "Restaurant", "Winery",
  "GovernmentOffice", "PostOffice",
  "HealthAndBeautyBusiness", "BeautySalon", "DaySpa", "HairSalon", "HealthClub", "NailSalon", "TattooParlor",
  "HomeAndConstructionBusiness", "Electrician", "GeneralContractor", "HVACBusiness", "HousePainter", "Locksmith",
  "MovingCompany", "Plumber", "RoofingContractor",
  "LegalService", "Attorney", "Notary",
  "LodgingBusiness", "BedAndBreakfast", "Campground", "Hostel", "Hotel", "Motel", "Resort", "SkiResort",
  "VacationRental",
  "MedicalBusiness", "CommunityHealth", "Dentist", "Dermatology", "DietNutrition", "Emergency", "Geriatric",
  "Gynecologic", "MedicalClinic", "CovidTestingFacility", "Midwifery", "Nursing", "Obstetric", "Oncologic",
  "Optician", "Optometric", "Otolaryngologic", "Pediatric", "Pharmacy", "Physician", "IndividualPhysician",
  "PhysiciansOffice", "Physiotherapy", "PlasticSurgery", "Podiatric", "PrimaryCare", "Psychiatric", "PublicHealth",
  "SportsActivityLocation", "BowlingAlley", "ExerciseGym", "GolfCourse", "PublicSwimmingPool", "SportsClub",
  "StadiumOrArena", "TennisComplex",
  "Store", "BikeStore", "BookStore", "ClothingStore", "ComputerStore", "ConvenienceStore", "DepartmentStore",
  "ElectronicsStore", "Florist", "FurnitureStore", "GardenStore", "GroceryStore", "HardwareStore", "HobbyShop",
  "HomeGoodsStore", "JewelryStore", "LiquorStore", "MensClothingStore", "MobilePhoneStore", "MovieRentalStore",
  "MusicStore", "OfficeEquipmentStore", "OutletStore", "PawnShop", "PetStore", "ShoeStore", "SportingGoodsStore",
  "TireShop", "ToyStore", "WholesaleStore",
]);
const BUSINESS_TYPE_PATTERN = /Business|Organization|Store|Shop|Service|Restaurant|Dentist|Clinic|Salon|Agency|Contractor|Hotel|School|Studio/;

/** Whether a schema.org type describes the business itself (not a page, a product, a person). */
export function isBusinessType(type: string): boolean {
  // "schema:Plumber" and "https://schema.org/Plumber" name the same type.
  const bare = type.replace(/^.*[/:#]/, "");
  return BUSINESS_TYPES.has(bare) || BUSINESS_TYPE_PATTERN.test(bare);
}

export function isBusinessNode(node: JsonLdNode): boolean {
  return nodeTypes(node).some(isBusinessType);
}

/** The non-blank strings in a JSON-LD value (a string, or a list of them). */
function strings(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

function hasContactFields(node: JsonLdNode): boolean {
  if (strings(node.telephone).length > 0) return true;
  return (Array.isArray(node.address) ? node.address : [node.address])
    .filter((a): a is JsonLdNode => !!a && typeof a === "object")
    .some(a => strings(a.streetAddress).length > 0 || strings(a.addressLocality).length > 0);
}

// A namesake's markup, or a theme's placeholder, says nothing about this
// business, so a named node has to carry one of the client's names. A node
// with no name, or a check run without the names, has nothing to object to.
function nameMatches(node: JsonLdNode, names: string[]): boolean {
  const name = strings(node.name);
  if (name.length === 0 || names.length === 0) return true;
  // "Harbor Plumbing & Drain" in the markup and "Harbor Plumbing and Drain"
  // on the client's record are the same business. The matcher reads "and" as
  // a required word and "&" as punctuation, so both spellings are tried: as
  // written (which keeps "Skin & Lab" equal to "SkinLab") and with the
  // conjunction spelled out on both sides.
  return name.some(n => detectMention(n, names) || detectMention(spellOutConjunction(n), names.map(spellOutConjunction)));
}

function spellOutConjunction(name: string): string {
  return name.replace(/&amp;/gi, "&").replace(/\s*[&+]\s*/g, " and ");
}

const BUSINESS_SCHEMA_FIX = "Add LocalBusiness (or Organization) schema markup to your homepage with your name, phone and address. Most site builders have a setting for this.";

export function checkBusinessSchema(nodes: JsonLdNode[], names: string[]): WebsiteCheckRow {
  const base = {
    id: "business_schema" as const,
    label: "Your business is labeled for machines",
    why: "Schema markup gives AI one clear record of who and where you are.",
  };
  const business = nodes.filter(isBusinessNode);
  if (business.length === 0) return { ...base, status: "fail", fix: BUSINESS_SCHEMA_FIX };
  const complete = business.some(n => hasContactFields(n) && nameMatches(n, names));
  return complete ? { ...base, status: "pass" } : { ...base, status: "warn", fix: BUSINESS_SCHEMA_FIX };
}

// North American numbers as people write them: with separators or
// parentheses, with a leading +1, or as a tel: link. Ten bare digits are left
// alone; they are as likely an order number.
const PHONE = /(?<!\d)(?:\+1[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\(\d{3}\)\s?\d{3}[\s.-]?\d{4}|\d{3}[\s.-]\d{3}[\s.-]\d{4})(?!\d)|tel:\+?\(?\d[\d().\s-]{6,}/gi;
// What marks the digits after it as a licence, permit or registration number.
const LICENCE_MARK = /#|\b(?:lic|ccb|permit|reg)/i;
const LICENCE_WINDOW = 12;

function hasPhone(text: string): boolean {
  for (const m of text.matchAll(PHONE)) {
    if (/^tel:/i.test(m[0])) return true;
    const at = m.index ?? 0;
    // Only the run right before the number counts: a licence printed just
    // before a phone ("CCB #123456 · (503) 555-1234") must not swallow the phone.
    const run = text.slice(Math.max(0, at - LICENCE_WINDOW), at).replace(/^[\s\S]*\d/, "");
    if (!LICENCE_MARK.test(run)) return true;
  }
  return false;
}

const STREET_SUFFIXES = [
  "Street", "St", "Avenue", "Ave", "Boulevard", "Blvd", "Road", "Rd", "Drive", "Dr", "Lane", "Ln", "Way",
  "Court", "Ct", "Place", "Pl", "Parkway", "Pkwy", "Highway", "Hwy", "Suite", "Ste",
];
const SUFFIX = `(?:${STREET_SUFFIXES.flatMap(s => [s, s.toLowerCase(), s.toUpperCase()]).join("|")})(?![A-Za-z])`;
// A street number, a street name whose words are capitalised (so "a 20
// minute drive" is not an address), and a suffix in any letter case.
const ADDRESS = new RegExp(String.raw`\b\d{1,6}[A-Za-z]?\s+(?:[A-Z0-9][A-Za-z0-9.'’-]*\s+){1,5}${SUFFIX}`);
// A footer typed in lower case ("1234 ne broadway st, portland") is an
// address too, but without the capitals the shape "number, words, suffix"
// turns up in prose ("we have 3 trucks on the way"). So the lower-case form
// needs an address's structure: no unit or function word between the number
// and the suffix, and a comma, period or line break right after the suffix
// (or after a unit number), where the city or state follows.
const NOT_STREET_WORD = String.raw`(?!(?:minutes?|mins?|hours?|hrs?|miles?|days?|weeks?|months?|years?|stars?|blocks?|the|a|an|on|in|of|to|at|for|and|or|our|your|their|his|her|its|this|that|these|those|with|from|by|per|is|are|was|were|be|been|have|has|had|we|you|they|it|as|up|down|over|under|out|more|less|new|all|some|any|about|same|next|last|first)\b)`;
const ADDRESS_LOWER = new RegExp(
  String.raw`\b\d{1,6}[a-z]?\s+(?:${NOT_STREET_WORD}[a-z0-9][a-z0-9.'’-]*\s+){1,5}${SUFFIX}(?:\s+(?:#|no\.?\s*)?\d+[a-z]?)?(?=\s*(?:[,.\n]|$))`,
  "i",
);

function hasAddress(text: string): boolean {
  return ADDRESS.test(text) || ADDRESS_LOWER.test(text);
}

const DAY = String.raw`(?:monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun|weekdays|weekends|daily|every day|m-f|m-th|m-sat|m-sun)`;
const CLOCK = String.raw`(?:[01]?\d|2[0-3])`;
const TIME = String.raw`(?:\b${CLOCK}(?::[0-5]\d)?\s?(?:am|pm|a\.m\.|p\.m\.)(?![a-z])|\b${CLOCK}:[0-5]\d\b|\bnoon\b|\bmidnight\b)`;
const JOINER = String.raw`\s*(?:-|–|—|to|until)\s*`;
// "9-5pm" is a range too: the start borrows the end's am/pm.
const RANGE = String.raw`(?:${TIME}|\b${CLOCK}\b)${JOINER}${TIME}`;
// "Mon-Fri 9-5" and "Hours: 8-5" write no am/pm at all. A bare clock range
// only counts after a day or a label, and not when it is a count of
// something else ("open 1-2 business days", "ages 5-12", "5-10 lb bags").
const BARE_RANGE = String.raw`(?<!\bages?\s{0,3})\b${CLOCK}\b${JOINER}\b${CLOCK}\b(?!\s*(?:(?:business\s+)?(?:days?|weeks?|months?|years?|hours?|hrs?|minutes?|mins?|lbs?|pounds?|inch(?:es)?|slots?|percent)\b|%))`;
const DAY_THEN_TIME = new RegExp(String.raw`\b${DAY}\b[\s\S]{0,40}?(?:${TIME}|${BARE_RANGE})`, "ig");
const LABEL_THEN_RANGE = new RegExp(String.raw`\b(?:open|hours)\b[\s\S]{0,40}?(?:${RANGE}|${BARE_RANGE})`, "i");
// "Posted Monday, March 3, 2025 at 10:15 am" is a date, not opening hours.
const DATED = /\b(?:january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b|\b(?:19|20)\d{2}\b/i;
// "may" is a month only with its capital: "hours may vary" is not a date.
const MAY = /\bMay\b/;
// An availability claim. A bare "24 hours" is as often a turnaround ("we
// respond within 24 hours"), so it needs "a day", a service noun, or an
// open/available label in front.
const ALWAYS_OPEN = /\b24\s*\/\s*7\b|\b24[\s-]?hours?\s+a\s+day\b|\b24[\s-]?hours?\s+(?:emergency|service|support|line)\b|\b(?:open|available)\b[^.\n]{0,20}\b24[\s-]?hours?\b|\baround the clock\b/i;

/** A day name followed by a time, skipping any such span that is a dated post or event. */
function hasDayHours(text: string): boolean {
  DAY_THEN_TIME.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DAY_THEN_TIME.exec(text)) !== null) {
    if (!DATED.test(m[0]) && !MAY.test(m[0])) return true;
    // Try the next day name, not the next text after this span: a real hours
    // line can sit inside a dated line's 40-character window.
    DAY_THEN_TIME.lastIndex = m.index + 1;
  }
  return false;
}

function filled(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
}

function hasHoursSchema(node: JsonLdNode): boolean {
  return filled(node.openingHours) || filled(node.openingHoursSpecification);
}

/**
 * Phone or address, and hours, in the visible text of the homepage and the
 * contact page (`text`, with the pages' tel: links appended) or, for hours,
 * in a business node's JSON-LD.
 */
export function checkContactVisible({ text, nodes }: { text: string; nodes: JsonLdNode[] }): WebsiteCheckRow {
  const base = {
    id: "contact_visible" as const,
    label: "Your phone, address and hours are easy to find",
    why: "AI answers \"how do I reach them\" and \"are they open now\" from the plain text on your pages.",
  };
  const reachable = hasPhone(text) || hasAddress(text);
  const hours = hasDayHours(text) || LABEL_THEN_RANGE.test(text) || ALWAYS_OPEN.test(text)
    || nodes.some(n => isBusinessNode(n) && hasHoursSchema(n));
  if (reachable && hours) return { ...base, status: "pass" };
  const missing = !reachable && !hours ? "phone number, address and opening hours" : !reachable ? "phone number and address" : "opening hours";
  return {
    ...base,
    status: reachable || hours ? "warn" : "fail",
    fix: `Put your ${missing} in plain text on your homepage or contact page.`,
  };
}
