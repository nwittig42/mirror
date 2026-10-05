import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { saveLead, listLeads } from "@/services/leads";

describe("leads", () => {
  it("saves a booking as a lead that starts out preparing, and lists newest first", async () => {
    const db = await makeTestDb();
    const base = { websiteUrl: "glow.example", contactName: "Kim", email: "k@glow.example", phone: "", bestTimes: "" };
    await saveLead(db, { ...base, practiceName: "First" });
    await new Promise(r => setTimeout(r, 5));
    await saveLead(db, { ...base, practiceName: "Second" });
    const rows = await listLeads(db);
    expect(rows.map(r => r.practiceName)).toEqual(["Second", "First"]);
    expect(rows[0]).toMatchObject({ status: "preparing", phone: null, practiceId: null });
  });
});

describe("shouldPrepareLead", () => {
  const base = { contactName: "Kim", email: "k@glow.example", phone: "", bestTimes: "", practiceName: "Glow" };
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
