import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import type { Db } from "@/db";
import { checks, leads, practices, scans } from "@/db/schema";
import { shownScore } from "@/core/scoring";
import { eq, sql } from "drizzle-orm";
import { runScan } from "@/services/scan-runner";
import { createInvite } from "@/services/account-invites";
import { NOT_PREPARED_NOTE } from "@/services/leads";
import type { EngineAdapter } from "@/engines/types";

// The pages' forms import the server actions, which sign people in; nothing here submits one.
vi.mock("@/lib/auth", () => ({ signIn: vi.fn() }));
vi.mock("@/services/prospect-start", () => ({ startProspectSetup: vi.fn() }));
// AuditLive refreshes the page through the app router, which a static render doesn't have.
vi.mock("next/navigation", async importOriginal => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));

import AuditPage from "@/app/audit/[id]/page";
import WelcomePage from "@/app/welcome/page";
import BookPage from "@/app/book/page";

let db: Db;
const html = async (page: Promise<React.ReactElement>) => renderToStaticMarkup(await page);
const audit = (id: string) => html(AuditPage({ params: Promise.resolve({ id }) }));
/** renderToStaticMarkup escapes apostrophes. */
const text = (markup: string) => markup.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

const LEFT_OUT = "Rose City Plumbing is the one most people recommend for repairs.";
const SECRET_ANSWER = "Rose City Plumbing is the one to call, and Harbor Plumbing charges $49.";
const answers: Record<string, string> = {
  "Best plumber in Portland": LEFT_OUT,
  "Who fixes water heaters in Portland?": "Harbor Plumbing is a good choice for water heaters.",
  "Is Harbor Plumbing any good?": SECRET_ANSWER,
};
const adapter: EngineAdapter = { name: "openai", run: async p => ({ answer: answers[p], citations: [] }) };
const judge = async () => ({ wrong: [], right: [] });

// Where each answer read. rosecityplumbing.com is the competitor's own site, never one to get on.
const cited: Record<string, string[]> = {
  "Best plumber in Portland": ["https://angi.com/x", "https://yelp.com/a", "https://reddit.com/r/pdx", "https://rosecityplumbing.com/"],
  "Who fixes water heaters in Portland?": ["https://yelp.com/b"],
};
const citing: EngineAdapter = { name: "openai", run: async p => ({ answer: answers[p], citations: cited[p] ?? [] }) };

async function seedLead(values: Partial<typeof leads.$inferInsert> = {}) {
  const [row] = await db.insert(leads).values({ websiteUrl: "https://harbor.example", practiceName: "Harbor Plumbing", ...values }).returning();
  return row;
}

// More buyer questions the business loses, for a plan with several questions to win.
const MORE_LOST = ["Cheap plumber in Portland", "Emergency plumber in Portland", "Licensed plumber near Portland"];
for (const q of MORE_LOST) answers[q] = "Rose City Plumbing is the one to call.";

async function scannedPractice(adapters: EngineAdapter[] = [adapter], { more = [] as string[], website = undefined as string | undefined } = {}) {
  const { practiceId } = await seedPractice(db, {
    name: "Harbor Plumbing", slug: "harbor", website,
    prompts: [
      { text: "Best plumber in Portland", kind: "category" },
      { text: "Who fixes water heaters in Portland?", kind: "category" },
      { text: "Is Harbor Plumbing any good?", kind: "branded" },
      ...more.map(text => ({ text, kind: "category" as const })),
    ],
    competitors: ["Rose City Plumbing"],
  });
  await db.update(practices).set({ active: false }).where(eq(practices.id, practiceId));
  await runScan(db, practiceId, adapters, judge, async () => ["Rose City Plumbing"]);
  return practiceId;
}

/** One teaser card, from its class to the next card's. */
function card(page: string, name: string): string {
  const start = page.indexOf(name);
  expect(start).toBeGreaterThan(-1);
  const end = page.indexOf("mk-form-card", start + name.length);
  return page.slice(start, end > -1 ? end : undefined);
}

/** A card's blurred list, from its opening tag to its close. */
function blurredIn(markup: string): string {
  const at = markup.indexOf("data-blurred");
  expect(at).toBeGreaterThan(-1);
  const start = markup.lastIndexOf("<", at);
  return markup.slice(start, markup.indexOf("</ul>", at));
}

beforeEach(async () => {
  db = await makeTestDb();
  setDbForTests(db);
  delete process.env.CALENDLY_URL;
});

describe("the audit page", () => {
  it("is not found for an unknown or malformed id", async () => {
    await expect(audit("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    await expect(audit("not-a-uuid")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("shows the progress and the details form, with the business name filled in", async () => {
    const lead = await seedLead({ category: "Plumber", location: "Portland, OR" });
    const page = text(await audit(lead.id));
    expect(page).toContain("Your audit is running");
    expect(page).toContain("This takes 5-7 minutes");
    expect(page).toContain('value="Harbor Plumbing"');
    expect(page).toContain('value="Plumber"');
    expect(page).toContain('value="Portland, OR"');
    expect(page).toContain("Send me my audit");
    expect(page).not.toContain("Book 30 minutes");
  });

  it("gives the wait something to watch: a live status line and a running clock", async () => {
    const lead = await seedLead({});
    const page = await audit(lead.id).then(p => renderToStaticMarkup(p));
    expect(page).toContain("mk-audit-status");
    expect(page).toContain("Loading your home page");
    expect(page).toContain("0:00 elapsed");
  });

  it("thanks them and offers the call once their email is in", async () => {
    const lead = await seedLead({ email: "dale@harbor.example", contactName: "Dale" });
    const page = text(await audit(lead.id));
    expect(page).toContain("Thank you. We'll email your audit to");
    expect(page).toContain("dale@harbor.example");
    expect(page).toContain("Book 30 minutes to walk through your results");
    expect(page).toContain("We'll go through what AI said, what it got wrong and what to fix first.");
    expect(page).toContain("We'll reach out within one business day to set up a time.");
    expect(page).not.toContain("Send me my audit");
  });

  it("says why an audit wasn't started: a repeat of the same site, or the daily limit", async () => {
    const note = `${NOT_PREPARED_NOTE}: this website was already booked, or today's limit was reached.`;
    await seedLead({ websiteUrl: "https://www.harbor.example/" });
    const repeat = await seedLead({ websiteUrl: "harbor.example", status: "needs_attention", note });
    expect(text(await audit(repeat.id))).toContain("We've already started an audit for this site today. Leave your details and we'll send it.");
    const capped = await seedLead({ websiteUrl: "other.example", status: "needs_attention", note });
    expect(text(await audit(capped.id))).toContain("We're at capacity today. Leave your details and we'll run it by hand.");
  });

  it("says a failed audit will be finished by hand", async () => {
    const practiceId = await scannedPractice();
    const lead = await seedLead({ practiceId, status: "needs_attention" });
    expect(text(await audit(lead.id))).toContain("Something went wrong on our side. We'll finish your audit by hand and email it to you.");
  });

  it("says so when setup broke before the business existed, not that we're at capacity", async () => {
    const lead = await seedLead({ status: "needs_attention", note: "Setup failed: x" });
    const page = text(await audit(lead.id));
    expect(page).toContain("Something went wrong on our side. We'll finish your audit by hand and email it to you.");
    expect(page).not.toContain("We're at capacity today");
  });

  it("drops the running heading and the time line once the audit won't run on its own", async () => {
    const failed = await seedLead({ status: "needs_attention", note: "Setup failed: x" });
    const skipped = await seedLead({ websiteUrl: "skipped.example", status: "needs_attention", note: NOT_PREPARED_NOTE });
    for (const lead of [failed, skipped]) {
      const page = text(await audit(lead.id));
      expect(page).toMatch(/<h1[^>]*>Your audit<\/h1>/);
      expect(page).not.toContain("Your audit is running");
      expect(page).not.toContain("This takes 5-7 minutes");
    }
  });

  describe("when the audit is done", () => {
    it("shows the score and one real answer, and nothing from a branded one", async () => {
      const practiceId = await scannedPractice();
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      expect(page).toContain("Recommended by AI");
      expect(page).toContain(LEFT_OUT);
      // A branded answer can carry unconfirmed facts, so it is nowhere on the page.
      expect(page).not.toContain(SECRET_ANSWER);
      expect(page).not.toContain("$49");
    });

    it("shows the Recommended by AI score on the 30-100 scale", async () => {
      const practiceId = await scannedPractice();
      const lead = await seedLead({ practiceId, status: "ready" });
      const [scan] = await db.select().from(scans).where(eq(scans.practiceId, practiceId));
      expect(scan.visibilityScore).not.toBe(100);
      expect(text(await audit(lead.id))).toContain(`aria-label="Score ${shownScore(scan.visibilityScore)} out of 100"`);
    });

    it("asks for an email to create the account only when the lead has none", async () => {
      const practiceId = await scannedPractice();
      const anonymous = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(anonymous.id));
      const account = (markup: string) => markup.slice(markup.indexOf("mk-teaser-account"), markup.indexOf("Already have an account?"));
      expect(page).toContain("Create your free account to get your full action plan");
      expect(page).toContain("Every step, with the competitors and websites behind it, plus every AI answer word for word.");
      expect(account(page)).toContain('name="email"');
      expect(page).toContain("Create account");
      expect(page).toContain("Already have an account?");
      expect(page).toContain('href="/login"');

      await db.update(leads).set({ email: "dale@harbor.example" }).where(eq(leads.id, anonymous.id));
      const known = text(await audit(anonymous.id));
      expect(account(known)).not.toContain('name="email"');
      expect(account(known)).toContain('name="password"');
    });

    it("puts the action plan and where AI read between the answer and the account card, and drops the placeholder blur", async () => {
      const practiceId = await scannedPractice([citing]);
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      const at = ["An answer you were left out of", "mk-teaser-plan", "mk-teaser-sources", "mk-teaser-account", "mk-teaser-book"]
        .map(t => page.indexOf(t));
      expect(at[0]).toBeGreaterThan(-1);
      for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThan(at[i - 1]);
      expect(page).not.toContain("24 answers, word for word");
      expect(page).not.toContain("Your fix plan");
    });

    it("counts the real plan in steps, names its groups, and leads with a step the sources card doesn't show", async () => {
      const practiceId = await scannedPractice([citing]);
      const lead = await seedLead({ practiceId, status: "ready" });
      const plan = card(text(await audit(lead.id)), "mk-teaser-plan");
      expect(plan).toContain("Your action plan");
      expect(plan).toContain("We found 4 steps for Harbor Plumbing, 2 of them quick wins.");
      expect(plan).not.toContain("fixes");
      // Every group is still listed, the sites with their count.
      expect(plan).toMatch(/Get listed where AI looks<\/span><span class="mk-teaser-count">3</);
      expect(plan).toMatch(/Win the questions you're losing<\/span><span class="mk-teaser-count">1</);
      // The sources card shows the sites, so the plan card leads with the question.
      expect(plan).toContain("\u201cBest plumber in Portland\u201d");
      expect(plan).toContain("AI named Rose City Plumbing; you were named in 0 of 1 answer.");
      expect(plan).not.toMatch(/yelp\.com|angi\.com|reddit\.com/);
    });

    it("leads with the sites when they're the only steps", async () => {
      // A second AI tool names the business for the one question, so the question is won.
      const naming: EngineAdapter = {
        name: "anthropic",
        run: async p => ({ answer: p.startsWith("Best") ? "Harbor Plumbing is great. Rose City Plumbing is too." : answers[p], citations: [] }),
      };
      const practiceId = await scannedPractice([citing, naming]);
      const lead = await seedLead({ practiceId, status: "ready" });
      const plan = card(text(await audit(lead.id)), "mk-teaser-plan");
      expect(plan).toContain("Stand out on yelp.com");
    });

    it("blurs the next three step titles, and only their titles, out of reach of screen readers", async () => {
      const practiceId = await scannedPractice([citing], { more: MORE_LOST });
      const lead = await seedLead({ practiceId, status: "ready" });
      const plan = card(text(await audit(lead.id)), "mk-teaser-plan");
      const blurred = blurredIn(plan);
      expect(blurred).toContain('aria-hidden="true"');
      expect(blurred).toContain("mk-teaser-blurred");
      expect(plan.replace(blurred, "")).toContain("\u201cBest plumber in Portland\u201d");
      const titles = MORE_LOST.map(q => `\u201c${q}\u201d`);
      for (const t of titles) {
        expect(blurred).toContain(t);
        expect(plan.replace(blurred, "")).not.toContain(t);
      }
      expect(blurred).not.toContain("AI named");
      expect(blurred).not.toContain("Add a page");
      expect(blurred).not.toMatch(/yelp\.com|angi\.com|reddit\.com/);
    });

    it("says how many websites AI read, how many it read when it chose someone else, and where the top competitor came up", async () => {
      // The business's own site is read too, and isn't counted.
      const withOwn: EngineAdapter = {
        name: "openai",
        run: async p => ({ answer: answers[p], citations: p.startsWith("Who fixes") ? [...cited[p], "https://harbor.example/water-heaters"] : cited[p] ?? [] }),
      };
      const practiceId = await scannedPractice([withOwn], { website: "https://harbor.example" });
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      const sources = card(page, "mk-teaser-sources");
      expect(sources).toContain("Where AI is reading");
      expect(sources).toContain("AI read 4 websites to answer your customers. When it recommended someone else, it was reading 3 of them. Rose City Plumbing was named in answers from 3 of them.");
      expect(sources).not.toContain("you're not");
      // Three sites: no need to say the plan lists fewer.
      expect(sources).not.toContain("Your plan lists");
      const blurred = blurredIn(sources);
      expect(blurred).toContain('aria-hidden="true"');
      expect(sources.replace(blurred, "")).toContain("yelp.com");
      expect(blurred).not.toContain("yelp.com");
      expect(blurred).toContain("angi.com");
      expect(blurred).toContain("reddit.com");
      // The competitor's own website is never a site to get on.
      expect(page).not.toContain("rosecityplumbing.com");
    });

    it("says the plan lists the 8 that matter most when AI read more", async () => {
      const many: EngineAdapter = {
        name: "openai",
        run: async p => ({ answer: answers[p], citations: p.startsWith("Best") ? Array.from({ length: 10 }, (_, i) => `https://site${i}.example/`) : [] }),
      };
      const practiceId = await scannedPractice([many]);
      const lead = await seedLead({ practiceId, status: "ready" });
      const sources = card(text(await audit(lead.id)), "mk-teaser-sources");
      expect(sources).toContain("When it recommended someone else, it was reading 10 of them. Your plan lists the 8 that matter most.");
    });

    it("matches the top competitor to the sites under any punctuation of its name", async () => {
      const practiceId = await scannedPractice([citing]);
      // The lost answer spells it with a hyphen; the other answer doesn't.
      await db.update(checks).set({ competitorsMentioned: ["Rose-City Plumbing"] }).where(sql`${checks.citations} @> '["https://angi.com/x"]'::jsonb`);
      await db.update(checks).set({ competitorsMentioned: ["Rose City Plumbing"] }).where(sql`${checks.citations} = '["https://yelp.com/b"]'::jsonb`);
      const lead = await seedLead({ practiceId, status: "ready" });
      const sources = card(text(await audit(lead.id)), "mk-teaser-sources");
      expect(sources).toMatch(/Rose.City Plumbing was named in answers from 3 of them\./);
    });

    it("leaves both cards out when there's no plan and nowhere to get on", async () => {
      const practiceId = await scannedPractice();
      await db.delete(checks);
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      expect(page).not.toContain("mk-teaser-plan");
      expect(page).not.toContain("mk-teaser-sources");
      expect(page).toContain("Create your free account to get your full action plan");
    });

    it("leaves the sources card out when no answer read a site, keeping the plan", async () => {
      const practiceId = await scannedPractice();
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      expect(page).toContain("We found 1 step for Harbor Plumbing.");
      expect(page).not.toContain("mk-teaser-sources");
    });

    it("never fails for a visitor: no ticks table is fine, and a plan that can't load is left out", async () => {
      const practiceId = await scannedPractice([citing]);
      const lead = await seedLead({ practiceId, status: "ready" });
      await db.execute(sql`drop table action_ticks`);
      expect(text(await audit(lead.id))).toContain("We found 4 steps for Harbor Plumbing");
      await db.execute(sql`drop table name_variations`);
      const page = text(await audit(lead.id));
      expect(page).not.toContain("mk-teaser-plan");
      expect(page).toContain("Recommended by AI");
      expect(page).toContain("mk-teaser-account");
    });

    it("leads with the score: the dial, how often they were named, by which AI tool, and who was named instead", async () => {
      const practiceId = await scannedPractice();
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      expect(page.indexOf("Recommended by AI")).toBeLessThan(page.indexOf("An answer you were left out of"));
      expect(page).toContain("AI named you in 1 of 2 answers when customers asked without using your name.");
      expect(page).toContain("ChatGPT named you most.");
      expect(page).toContain("It named <strong>Rose City Plumbing</strong> instead in 1 of those 2 answers.");
    });

    it("counts who AI named instead from buyer questions only, not one that used their name", async () => {
      const practiceId = await scannedPractice();
      const lead = await seedLead({ practiceId, status: "ready" });
      // The branded answer names Rose City Plumbing too: 2 checks in all, 1 of them a buyer question.
      const named = (await db.select().from(checks)).filter(c => c.competitorsMentioned.includes("Rose City Plumbing"));
      expect(named).toHaveLength(2);
      const page = text(await audit(lead.id));
      expect(page).toContain("instead in 1 of those 2 answers.");
      expect(page).not.toContain("instead in 2 of");
    });

    it("doesn't say which AI tool named them most when two tie", async () => {
      const practiceId = await scannedPractice([adapter, { ...adapter, name: "anthropic" }]);
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      expect(page).toContain("AI named you in 2 of 4 answers");
      expect(page).not.toContain("named you most.");
    });

    it("shows the logo beside the business name and the scan date, or the name alone without a logo", async () => {
      const practiceId = await scannedPractice();
      const lead = await seedLead({ practiceId, status: "ready" });
      const [scan] = await db.select().from(scans).where(eq(scans.practiceId, practiceId));
      // Finished on a different day than it started: the date is the start, as on the dashboard.
      await db.update(scans).set({ finishedAt: new Date(scan.startedAt.getTime() + 3 * 86_400_000) }).where(eq(scans.id, scan.id));
      const day = scan.startedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

      const plain = text(await audit(lead.id));
      const header = (markup: string) => markup.slice(markup.indexOf("mk-audit-head"), markup.indexOf("Recommended by AI"));
      expect(header(plain)).toContain("Harbor Plumbing");
      expect(header(plain)).toContain("AI visibility audit");
      expect(header(plain)).toContain(day);
      expect(header(plain)).not.toContain("<img");

      const logo = "data:image/png;base64,iVBORw0KGgo=";
      await db.update(practices).set({ logo }).where(eq(practices.id, practiceId));
      const withLogo = text(await audit(lead.id));
      expect(header(withLogo)).toContain(`<img src="${logo}" alt="Harbor Plumbing"`);
    });

    it("replaces the progress and the details form with the finished audit, and offers the call last", async () => {
      process.env.CALENDLY_URL = "https://calendly.com/mirror/30min";
      const practiceId = await scannedPractice();
      for (const email of [null, "dale@harbor.example"]) {
        const lead = await seedLead({ practiceId, status: "ready", email });
        const page = text(await audit(lead.id));
        expect(page).not.toContain("mk-audit-steps");
        expect(page).not.toContain("mk-progress");
        expect(page).not.toContain("Send me my audit");
        expect(page).not.toContain("Thank you. We'll email your audit to");
        expect(page).toContain("Want us to walk you through it? Book 30 minutes");
        expect(page.indexOf("mk-teaser-book")).toBeGreaterThan(page.indexOf("mk-teaser-account"));
      }
    });

    it("shows nothing extra until the scan row is complete", async () => {
      const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor" });
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      expect(page).not.toContain("mk-teaser-plan");
      expect(page).not.toContain("Create your free account");
      expect(page).toContain("mk-audit-steps");
    });
  });
});

describe("the set-up page", () => {
  it("shows the invited email and asks for a password", async () => {
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor" });
    const token = await createInvite(db, practiceId, "dale@harbor.example");
    const page = text(await html(WelcomePage({ searchParams: Promise.resolve({ token }) })));
    expect(page).toContain("Set up your Mirror account");
    expect(page).toContain("dale@harbor.example");
    expect(page).toContain('name="password"');
    expect(page).toContain("Create account");
  });

  it("shows no email for a link that isn't valid", async () => {
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor" });
    await createInvite(db, practiceId, "dale@harbor.example");
    const page = text(await html(WelcomePage({ searchParams: Promise.resolve({ token: "nope" }) })));
    expect(page).toContain("Set up your Mirror account");
    expect(page).not.toContain("dale@harbor.example");
  });
});

describe("/book", () => {
  it("is the website box, filled in from the home page", async () => {
    const page = text(await html(BookPage({ searchParams: Promise.resolve({ websiteUrl: "harbor.example" }) })));
    expect(page).toContain('name="websiteUrl"');
    expect(page).toContain('value="harbor.example"');
    expect(page).toContain("No website?");
    expect(page).not.toContain('name="email"');
  });
});
