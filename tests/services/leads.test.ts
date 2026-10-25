import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { saveLead, listLeads, startLead, attachContact, shouldPrepareLead, isRepeatSite } from "@/services/leads";
import { leads, practices, nameVariations } from "@/db/schema";
import { eq } from "drizzle-orm";

const BLANK = { category: "", location: "", phone: "", bestTimes: "" };

describe("leads", () => {
  it("saves a booking as a lead that starts out preparing, and lists newest first", async () => {
    const db = await makeTestDb();
    const base = { ...BLANK, websiteUrl: "glow.example", contactName: "Kim", email: "k@glow.example" };
    await saveLead(db, { ...base, practiceName: "First" });
    await new Promise(r => setTimeout(r, 5));
    await saveLead(db, { ...base, practiceName: "Second" });
    const rows = await listLeads(db);
    expect(rows.map(r => r.practiceName)).toEqual(["Second", "First"]);
    expect(rows[0]).toMatchObject({ status: "preparing", phone: null, practiceId: null, category: null, location: null });
  });

  it("keeps what kind of business it is and where, when the prospect said", async () => {
    const db = await makeTestDb();
    const { id } = await saveLead(db, {
      ...BLANK, practiceName: "Harbor Plumbing", websiteUrl: "harborplumbing.example", contactName: "Sam",
      email: "sam@harborplumbing.example", category: "Plumber", location: "Portland, OR",
    });
    const [row] = (await listLeads(db)).filter(r => r.id === id);
    expect(row).toMatchObject({ category: "Plumber", location: "Portland, OR" });
  });
});

describe("shouldPrepareLead", () => {
  const base = { ...BLANK, contactName: "Kim", email: "k@glow.example", practiceName: "Glow" };
  it("prepares the first booking for a website, but not a repeat within a day", async () => {
    const { shouldPrepareLead } = await import("@/services/leads");
    const db = await makeTestDb();
    const first = await saveLead(db, { ...base, websiteUrl: "https://www.Glow.example/" });
    expect(await shouldPrepareLead(db, first.id)).toBe(true);
    const again = await saveLead(db, { ...base, websiteUrl: "glow.example" });
    expect(await shouldPrepareLead(db, again.id)).toBe(false);
  });
  it("stops preparing after the daily cap", async () => {
    const { shouldPrepareLead } = await import("@/services/leads");
    const db = await makeTestDb();
    for (let i = 0; i < 3; i++) await saveLead(db, { ...base, websiteUrl: `site${i}.example` });
    const next = await saveLead(db, { ...base, websiteUrl: "new.example" });
    expect(await shouldPrepareLead(db, next.id, 3)).toBe(false);
    expect(await shouldPrepareLead(db, next.id, 10)).toBe(true);
  });
});

describe("startLead and attachContact", () => {
  it("saves a website-only lead with no contact yet", async () => {
    const db = await makeTestDb();
    const { id } = await startLead(db, { websiteUrl: "glow.example" });
    const [row] = await db.select().from(leads).where(eq(leads.id, id));
    expect(row).toMatchObject({ websiteUrl: "glow.example", practiceName: null, nameFromSite: true, email: null, contactName: null });
  });

  it("saves a lead that has no website", async () => {
    const db = await makeTestDb();
    const { id } = await startLead(db, { practiceName: "Harbor Plumbing", category: "Plumber", location: "Portland, OR" });
    const [row] = await db.select().from(leads).where(eq(leads.id, id));
    expect(row).toMatchObject({ websiteUrl: null, practiceName: "Harbor Plumbing", category: "Plumber", location: "Portland, OR", nameFromSite: false });
  });

  it("adds contact details, and renames the practice with a name variation", async () => {
    const db = await makeTestDb();
    const { id } = await startLead(db, { websiteUrl: "glow.example" });
    const [practice] = await db.insert(practices).values({ name: "glow", slug: "glow" }).returning();
    await db.update(leads).set({ practiceId: practice.id }).where(eq(leads.id, id));
    const lead = await attachContact(db, id, {
      contactName: "Kim", email: "  Kim@Glow.Example ", phone: "555", practiceName: "Glow MedSpa", category: "Med spa",
    });
    expect(lead).toMatchObject({ contactName: "Kim", email: "kim@glow.example", phone: "555", practiceName: "Glow MedSpa", nameFromSite: false, category: "Med spa" });
    const [p] = await db.select().from(practices).where(eq(practices.id, practice.id));
    expect(p.name).toBe("Glow MedSpa");
    const vars = await db.select().from(nameVariations).where(eq(nameVariations.practiceId, practice.id));
    expect(vars.map(v => v.text)).toEqual(["Glow MedSpa"]);
  });

  it("returns null for an unknown lead", async () => {
    const db = await makeTestDb();
    expect(await attachContact(db, "00000000-0000-0000-0000-000000000000", { contactName: "K", email: "k@x.example" })).toBeNull();
  });

  it("lets two leads without a website through", async () => {
    const db = await makeTestDb();
    await startLead(db, { practiceName: "A", category: "c", location: "l" });
    const b = await startLead(db, { practiceName: "B", category: "c", location: "l" });
    expect(await shouldPrepareLead(db, b.id)).toBe(true);
  });
});

describe("isRepeatSite", () => {
  it("is true when the same site was booked in the day before this lead, and not for later or older ones", async () => {
    const db = await makeTestDb();
    const old = await startLead(db, { websiteUrl: "glow.example" });
    await db.update(leads).set({ createdAt: new Date(Date.now() - 2 * 86_400_000) }).where(eq(leads.id, old.id));
    const first = await startLead(db, { websiteUrl: "https://www.Glow.example/" });
    expect(await isRepeatSite(db, first.id)).toBe(false);
    await new Promise(r => setTimeout(r, 5));
    const again = await startLead(db, { websiteUrl: "glow.example" });
    expect(await isRepeatSite(db, again.id)).toBe(true);
    // The first one stays a first, even though a repeat came after it.
    expect(await isRepeatSite(db, first.id)).toBe(false);
  });

  it("is false with no website or an unknown lead", async () => {
    const db = await makeTestDb();
    const { id } = await startLead(db, { practiceName: "A", category: "c", location: "l" });
    expect(await isRepeatSite(db, id)).toBe(false);
    expect(await isRepeatSite(db, "00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});
