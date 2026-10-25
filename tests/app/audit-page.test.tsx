import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import type { Db } from "@/db";
import { leads, practices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runScan } from "@/services/scan-runner";
import { createInvite } from "@/services/account-invites";
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

async function scannedPractice() {
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
  await runScan(db, practiceId, [adapter], judge, async () => ["Rose City Plumbing"]);
  return practiceId;
}

/** The blurred block, from its opening tag to the card laid over it. */
function blurredRegion(page: string): string {
  const start = page.lastIndexOf("<div", page.indexOf("data-blurred"));
  const end = page.indexOf("mk-teaser-overlay");
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
    const note = "Not set up automatically";
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

    it("asks for an email to create the account only when the lead has none", async () => {
      const practiceId = await scannedPractice();
      const anonymous = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(anonymous.id));
      expect(page).toContain("Create your account to see the full audit");
      expect(page.slice(page.indexOf("mk-teaser-overlay"))).toContain('name="email"');
      expect(page).toContain("Create account");
      expect(page).toContain("Already have an account?");
      expect(page).toContain('href="/login"');

      await db.update(leads).set({ email: "dale@harbor.example" }).where(eq(leads.id, anonymous.id));
      const known = text(await audit(anonymous.id));
      const overlay = known.slice(known.indexOf("mk-teaser-overlay"), known.indexOf("Already have an account?"));
      expect(overlay).not.toContain('name="email"');
      expect(overlay).toContain('name="password"');
    });

    it("shows nothing extra until the scan row is complete", async () => {
      const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor" });
      const lead = await seedLead({ practiceId, status: "ready" });
      const page = text(await audit(lead.id));
      expect(page).not.toContain("data-blurred");
      expect(page).not.toContain("Create your account to see the full audit");
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
