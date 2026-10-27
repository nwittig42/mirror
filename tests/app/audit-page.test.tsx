import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import type { Db } from "@/db";
import { checks, leads, practices, scans } from "@/db/schema";
import { shownScore } from "@/core/scoring";
import { eq } from "drizzle-orm";
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

async function seedLead(values: Partial<typeof leads.$inferInsert> = {}) {
  const [row] = await db.insert(leads).values({ websiteUrl: "https://harbor.example", practiceName: "Harbor Plumbing", ...values }).returning();
  return row;
}

async function scannedPractice(adapters: EngineAdapter[] = [adapter]) {
  const { practiceId } = await seedPractice(db, {
    name: "Harbor Plumbing", slug: "harbor",
    prompts: [
      { text: "Best plumber in Portland", kind: "category" },
      { text: "Who fixes water heaters in Portland?", kind: "category" },
      { text: "Is Harbor Plumbing any good?", kind: "branded" },
    ],
    competitors: ["Rose City Plumbing"],
  });
  await db.update(practices).set({ active: false }).where(eq(practices.id, practiceId));
  await runScan(db, practiceId, adapters, judge, async () => ["Rose City Plumbing"]);
  return practiceId;
}

/** The blurred block, from its opening tag to the call offer below it. */
function blurredRegion(page: string): string {
  const start = page.lastIndexOf("<div", page.indexOf("data-blurred"));
  const end = page.indexOf("mk-teaser-book");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return page.slice(start, end);
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
    it("shows the score and one real answer, and blurs only placeholder content", async () => {
      const practiceId = await scannedPractice();
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      expect(page).toContain("Recommended by AI");
      expect(page).toContain(LEFT_OUT);
      const blurred = blurredRegion(page);
      expect(blurred).toContain('aria-hidden="true"');
      expect(blurred).not.toContain(LEFT_OUT);
      expect(blurred).not.toContain("Rose City Plumbing");
      expect(blurred).not.toContain("Harbor Plumbing");
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
      const card = (markup: string) => markup.slice(markup.indexOf("mk-teaser-account"), markup.indexOf("Already have an account?"));
      expect(page).toContain("Create your free account to see your full audit");
      expect(page).toContain("Every AI answer word for word, who AI recommends instead of you, and your step-by-step recommendations.");
      expect(card(page)).toContain('name="email"');
      expect(page).toContain("Create account");
      expect(page).toContain("Already have an account?");
      expect(page).toContain('href="/login"');

      await db.update(leads).set({ email: "dale@harbor.example" }).where(eq(leads.id, anonymous.id));
      const known = text(await audit(anonymous.id));
      expect(card(known)).not.toContain('name="email"');
      expect(card(known)).toContain('name="password"');
    });

    it("puts the account card above the blur, with nothing laid over the blur", async () => {
      const practiceId = await scannedPractice();
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      expect(page.indexOf("mk-teaser-account")).toBeGreaterThan(-1);
      expect(page.indexOf("mk-teaser-account")).toBeLessThan(page.indexOf("data-blurred"));
      const blurred = blurredRegion(page);
      expect(blurred).not.toContain("mk-teaser-overlay");
      expect(blurred).not.toContain("<form");
      expect(blurred).not.toContain("Create your free account");
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

    it("blurs the cards for what a free account gets, in order, without a fact check card", async () => {
      const practiceId = await scannedPractice();
      const lead = await seedLead({ practiceId, status: "ready" });
      const blurred = blurredRegion(text(await audit(lead.id)));
      const at = ["Every AI answer", "Competitors", "Your fix plan"].map(t => blurred.indexOf(t));
      expect(at[0]).toBeGreaterThan(-1);
      expect(at[1]).toBeGreaterThan(at[0]);
      expect(at[2]).toBeGreaterThan(at[1]);
      expect(blurred).not.toContain("Fact check");
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
        expect(page.indexOf("mk-teaser-book")).toBeGreaterThan(page.indexOf("data-blurred"));
      }
    });

    it("shows nothing extra until the scan row is complete", async () => {
      const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor" });
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      expect(page).not.toContain("data-blurred");
      expect(page).not.toContain("Create your free account to see your full audit");
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
