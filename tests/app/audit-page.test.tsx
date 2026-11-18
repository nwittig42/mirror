import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import type { Db } from "@/db";
import { leads, practiceMembers, practices, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runScan } from "@/services/scan-runner";
import { createInvite } from "@/services/account-invites";
import { NOT_PREPARED_NOTE } from "@/services/leads";
import type { EngineAdapter } from "@/engines/types";

// The pages' forms import the server actions, which sign people in; nothing here submits one.
const session = vi.fn<() => Promise<{ user: { id: string } } | null>>();
vi.mock("@/lib/auth", () => ({ signIn: vi.fn(), auth: () => session() }));
vi.mock("@/services/prospect-start", () => ({ startProspectSetup: vi.fn() }));
// The progress provider refreshes the page through the app router, which a static render doesn't have.
vi.mock("next/navigation", async importOriginal => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import AuditPage from "@/app/audit/[id]/page";
import WelcomePage from "@/app/welcome/page";
import BookPage from "@/app/book/page";

let db: Db;
const html = async (page: Promise<React.ReactElement>) => renderToStaticMarkup(await page);
const audit = (id: string, step?: string) =>
  html(AuditPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(step ? { step } : {}) }));
/** renderToStaticMarkup escapes apostrophes. */
const text = (markup: string) => markup.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

const SECRET_ANSWER = "Rose City Plumbing is the one to call, and Harbor Plumbing charges $49.";
const adapter: EngineAdapter = { name: "openai", run: async () => ({ answer: SECRET_ANSWER, citations: [] }) };
const judge = async () => ({ wrong: [], right: [] });

async function seedLead(values: Partial<typeof leads.$inferInsert> = {}) {
  const [row] = await db.insert(leads).values({ websiteUrl: "https://harbor.example", practiceName: "Harbor Plumbing", ...values }).returning();
  return row;
}

async function practice({ scanned = false } = {}) {
  const { practiceId } = await seedPractice(db, {
    name: "Harbor Plumbing", slug: "harbor",
    prompts: [{ text: "Best plumber in Portland", kind: "category" }],
    competitors: ["Rose City Plumbing"],
  });
  await db.update(practices).set({ active: false }).where(eq(practices.id, practiceId));
  if (scanned) await runScan(db, practiceId, [adapter], judge, async () => ["Rose City Plumbing"]);
  return practiceId;
}

/** A client login for the business. Returns its user id. */
async function member(practiceId: string, email = "dale@harbor.example") {
  const [user] = await db.insert(users).values({ email, role: "client", passwordHash: "x" }).returning();
  await db.insert(practiceMembers).values({ userId: user.id, practiceId });
  return user.id;
}

/** Nothing of the result may appear on this page: it opens in the dashboard. */
function expectNoResults(page: string) {
  expect(page).not.toContain("Rose City Plumbing");
  expect(page).not.toContain("charges $49");
  expect(page).not.toContain("mk-report");
}

beforeEach(async () => {
  db = await makeTestDb();
  setDbForTests(db);
  session.mockReset();
  session.mockResolvedValue(null);
  delete process.env.CALENDLY_URL;
});

describe("the audit page", () => {
  it("is not found for an unknown or malformed id", async () => {
    await expect(audit("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    await expect(audit("not-a-uuid")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("opens on step 1 under the progress bar, with the business filled in and no phone", async () => {
    const lead = await seedLead({ category: "Plumber", location: "Portland, OR" });
    const page = text(await audit(lead.id));
    expect(page).toContain("mk-audit-bar");
    expect(page).toContain("Your audit · Harbor Plumbing");
    expect(page).toContain("Reading your website");
    expect(page).toContain("Step 1 of 3");
    expect(page).toContain("About you");
    expect(page).toContain('value="Harbor Plumbing"');
    expect(page).toContain('value="Plumber"');
    expect(page).toContain('value="Portland, OR"');
    expect(page).toContain("Continue");
    expect(page).not.toContain('name="phone"');
    expect(page).not.toContain("5-7 minutes");
    expect(page).not.toContain("Step 2 of 3");
  });

  it("names only the tools the quick look is asking", async () => {
    const practiceId = await practice();
    const lead = await seedLead({ practiceId });
    const { scans } = await import("@/db/schema");
    await db.insert(scans).values({ practiceId, purpose: "quick", totalTasks: 2 });
    const page = text(await audit(lead.id));
    // The bar alone: the footer names every tool the product covers.
    const bar = page.slice(page.indexOf("mk-audit-bar"), page.indexOf("<main"));
    expect(bar).toContain("Asking ChatGPT and Claude");
    expect(bar).not.toMatch(/Gemini|Grok|Perplexity/);
  });

  it("moves to the login once the email is in, showing it as the username", async () => {
    const practiceId = await practice();
    const lead = await seedLead({ practiceId, email: "dale@harbor.example", contactName: "Dale" });
    const page = text(await audit(lead.id));
    expect(page).toContain("mk-audit-bar");
    expect(page).toContain("Step 2 of 3");
    expect(page).toContain("Create your login");
    expect(page).toContain("dale@harbor.example");
    expect(page).toContain('name="password"');
    expect(page).not.toContain("Step 1 of 3");
  });

  it("offers the login on an old link whose audit is ready, and shows none of the result", async () => {
    const practiceId = await practice({ scanned: true });
    const lead = await seedLead({ practiceId, status: "ready", email: "dale@harbor.example" });
    const page = text(await audit(lead.id));
    expect(page).toContain("Your audit is ready");
    expect(page).toContain("Your audit is ready. Create your login to see it.");
    expect(page).toContain('name="password"');
    expectNoResults(page);
  });

  it("points a returning visitor who has a login at the login page, with none of the result", async () => {
    const practiceId = await practice({ scanned: true });
    await member(practiceId);
    const lead = await seedLead({ practiceId, status: "ready", email: "dale@harbor.example" });
    const page = text(await audit(lead.id, "call"));
    expect(page).toContain("Your audit is in your dashboard");
    expect(page).toContain('href="/login"');
    expect(page).not.toContain('name="password"');
    expect(page).not.toContain("Step 3 of 3");
    expectNoResults(page);
  });

  it("offers the optional call, with the phone and a way past it, straight after signing up", async () => {
    process.env.CALENDLY_URL = "https://calendly.com/mirror/30min";
    const practiceId = await practice();
    const userId = await member(practiceId);
    session.mockResolvedValue({ user: { id: userId } });
    const lead = await seedLead({ practiceId, email: "dale@harbor.example" });
    const page = text(await audit(lead.id, "call"));
    expect(page).toContain("mk-audit-bar");
    expect(page).toContain("Step 3 of 3 · Optional");
    expect(page).toContain('name="phone"');
    expect(page).toContain("Skip, show me my audit");
    expect(page).toContain(`href="/audit/${lead.id}?step=done"`);
  });

  it("goes straight to the wait with no scheduling link, and after the call step", async () => {
    const practiceId = await practice();
    const userId = await member(practiceId);
    session.mockResolvedValue({ user: { id: userId } });
    const lead = await seedLead({ practiceId, email: "dale@harbor.example" });
    expect(text(await audit(lead.id, "call"))).toContain("Your audit opens as soon as it's ready");
    process.env.CALENDLY_URL = "https://calendly.com/mirror/30min";
    const waiting = text(await audit(lead.id, "done"));
    expect(waiting).toContain("Your audit opens as soon as it's ready");
    expect(waiting).not.toContain("Step 3 of 3");
  });

  it("gives the wait something to watch: each stage of the audit, with the one under way marked", async () => {
    const practiceId = await practice();
    const userId = await member(practiceId);
    session.mockResolvedValue({ user: { id: userId } });
    const lead = await seedLead({ practiceId, email: "dale@harbor.example" });
    const { scans } = await import("@/db/schema");
    await db.insert(scans).values({ practiceId, purpose: "quick", totalTasks: 2 });
    const page = text(await audit(lead.id, "done"));
    const card = page.slice(page.indexOf("<main"));
    expect(card).toContain("mk-audit-steps");
    expect(card).toMatch(/<li class="done"><span>Reading your website<\/span>/);
    expect(card).toMatch(/<li class="done"><span>Writing the questions your customers ask<\/span>/);
    expect(card).toMatch(/<li class="now"><span>Asking ChatGPT and Claude<\/span>/);
    expect(card).toContain("0 of 2 answers in");
    expect(card).toMatch(/<li><span>Scoring your answers<\/span>/);
    expect(card).toContain("Then your dashboard opens");
  });

  it("sends a signed-in visitor on to their dashboard once the result is ready", async () => {
    const practiceId = await practice({ scanned: true });
    const userId = await member(practiceId);
    session.mockResolvedValue({ user: { id: userId } });
    const lead = await seedLead({ practiceId, status: "ready", email: "dale@harbor.example" });
    const page = text(await audit(lead.id));
    expect(page).toContain("Opening your audit");
    expect(page).toContain('href="/app"');
    expectNoResults(page);
  });

  it("doesn't treat someone signed in to another business as this one's member", async () => {
    const practiceId = await practice();
    await member(practiceId);
    session.mockResolvedValue({ user: { id: "00000000-0000-4000-8000-000000000009" } });
    const lead = await seedLead({ practiceId, email: "dale@harbor.example" });
    expect(text(await audit(lead.id, "call"))).toContain("Your audit is in your dashboard");
  });

  it("says why an audit wasn't started: a repeat of the same site, or the daily limit", async () => {
    const note = `${NOT_PREPARED_NOTE}: this website was already booked, or today's limit was reached.`;
    await seedLead({ websiteUrl: "https://www.harbor.example/" });
    const repeat = await seedLead({ websiteUrl: "harbor.example", status: "needs_attention", note });
    expect(text(await audit(repeat.id))).toContain("We've already started an audit for this site today. Leave your details and we'll send it.");
    const capped = await seedLead({ websiteUrl: "other.example", status: "needs_attention", note });
    expect(text(await audit(capped.id))).toContain("We're at capacity today. Leave your details and we'll run it by hand.");
  });

  it("says a failed audit will be finished by hand, and offers only the details form", async () => {
    const lead = await seedLead({ status: "needs_attention", note: "Setup failed: x" });
    const page = text(await audit(lead.id));
    expect(page).toContain("Something went wrong on our side. We'll finish your audit by hand and email it to you.");
    expect(page).not.toContain("We're at capacity today");
    expect(page).toMatch(/<h1[^>]*>Your audit<\/h1>/);
    expect(page).toContain("Send me my audit");
    expect(page).toContain('name="phone"');
    expect(page).not.toContain("mk-audit-bar");
    expect(page).not.toContain("Step 1 of 3");
    expect(page).not.toContain('name="password"');
  });

  it("thanks a visitor whose audit failed after their email was in, and still offers the call", async () => {
    const lead = await seedLead({ status: "needs_attention", note: "Setup failed: x", email: "dale@harbor.example" });
    const page = text(await audit(lead.id));
    expect(page).toContain("Thank you. We'll email your audit to");
    expect(page).toContain("We'll reach out within one business day to set up a time.");
    expect(page).not.toContain('name="password"');
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
