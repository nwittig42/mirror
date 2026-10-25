import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "../helpers/db";
import * as schema from "@/db/schema";
import { prepareProspect, finishProspect, nameFromTitle, type ProspectDeps } from "@/services/prospect-setup";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";

type Db = Awaited<ReturnType<typeof makeTestDb>>;

async function lead(db: Db, extra: Partial<typeof schema.leads.$inferInsert> = {}) {
  const [row] = await db.insert(schema.leads).values({
    practiceName: "Glow MedSpa", websiteUrl: "glowmedspa.com", contactName: "Dr. Kim", email: "kim@glow.example", ...extra,
  }).returning();
  return row;
}

const adapter: EngineAdapter = { name: "openai", run: async () => ({ answer: "Glow MedSpa is the best in Austin.", citations: [] }) };

function deps(over: Partial<ProspectDeps> = {}): ProspectDeps {
  return {
    fetchPages: async () => [{ url: "https://glowmedspa.com", title: "Glow", text: "Botox in Austin. $13 per unit." }],
    draftFacts: async () => [{ category: "pricing", label: "Botox price", value: "$13/unit", sourceUrl: "https://glowmedspa.com" }],
    draftQuestions: async () => ({ category: "Med spa", location: "Austin, TX", questions: [
      { text: "Best med spa in Austin?", kind: "category" }, { text: "Is Glow MedSpa good?", kind: "branded" },
    ] }),
    scan: (db, practiceId) => runScan(db, practiceId, [adapter], async () => ({ wrong: [], right: [] }), async () => [],
      { retryDelaysMs: [], finalRetryDelayMs: 0 }),
    notify: vi.fn(async () => undefined),
    sendAudit: vi.fn(async () => undefined),
    ...over,
  };
}

const noQuestions: ProspectDeps["draftQuestions"] = async () => ({ category: null, location: null, questions: [] });

describe("nameFromTitle", () => {
  it("takes the first part of the page title", () => {
    expect(nameFromTitle("Harbor Plumbing | Austin plumbers", "https://harborplumbing.com")).toBe("Harbor Plumbing");
    expect(nameFromTitle("Harbor Plumbing - Home", "harborplumbing.com")).toBe("Harbor Plumbing");
    expect(nameFromTitle("Harbor Plumbing \u2013 Home", "harborplumbing.com")).toBe("Harbor Plumbing");
    expect(nameFromTitle("Harbor Plumbing \u2014 Home", "harborplumbing.com")).toBe("Harbor Plumbing");
  });
  it("falls back to the domain when the title is missing, too short or too long", () => {
    expect(nameFromTitle(null, "https://www.harborplumbing.com/about")).toBe("Harborplumbing");
    expect(nameFromTitle("A | Home", "harborplumbing.com")).toBe("Harborplumbing");
    expect(nameFromTitle("x".repeat(81), "harborplumbing.com")).toBe("Harborplumbing");
    expect(nameFromTitle("   ", "harborplumbing.com")).toBe("Harborplumbing");
  });
});

describe("prepareProspect", () => {
  it("names a website-only lead from its page title", async () => {
    const db = await makeTestDb();
    const l = await lead(db, { practiceName: null, nameFromSite: true, contactName: null, email: null });
    await prepareProspect(db, l.id, deps({ fetchPages: async () => [{ url: "https://glowmedspa.com", title: "Glow MedSpa | Austin", text: "Botox." }] }));
    const [p] = await db.select().from(schema.practices);
    expect(p.name).toBe("Glow MedSpa");
    const [after] = await db.select().from(schema.leads);
    expect(after.practiceName).toBe("Glow MedSpa");
    expect((await db.select().from(schema.nameVariations)).map(v => v.text)).toEqual(["Glow MedSpa"]);
  });

  it("leaves a name typed in meanwhile alone", async () => {
    const db = await makeTestDb();
    const l = await lead(db, { practiceName: null, nameFromSite: true, contactName: null, email: null });
    await prepareProspect(db, l.id, deps({
      fetchPages: async () => {
        await db.update(schema.leads).set({ practiceName: "Glow Aesthetics", nameFromSite: false }).where(eq(schema.leads.id, l.id));
        return [{ url: "https://glowmedspa.com", title: "Glow MedSpa | Austin", text: "Botox." }];
      },
    }));
    const [p] = await db.select().from(schema.practices);
    expect(p.name).toBe("Glowmedspa");
    const [after] = await db.select().from(schema.leads);
    expect(after.practiceName).toBe("Glow Aesthetics");
  });

  it("scans a lead with no website on the standard questions", async () => {
    const db = await makeTestDb();
    const l = await lead(db, { websiteUrl: null, category: "Med spa", location: "Austin, TX" });
    const d = deps({ fetchPages: vi.fn(async () => []), draftFacts: vi.fn(async () => []), draftQuestions: vi.fn(async () => ({ category: null, location: null, questions: [] })) });
    await prepareProspect(db, l.id, d);
    expect(d.fetchPages).not.toHaveBeenCalled();
    expect(d.draftFacts).not.toHaveBeenCalled();
    expect(d.draftQuestions).not.toHaveBeenCalled();
    const [p] = await db.select().from(schema.practices);
    expect(p).toMatchObject({ name: "Glow MedSpa", website: null, category: "Med spa", location: "Austin, TX" });
    expect((await db.select().from(schema.prompts)).length).toBeGreaterThan(0);
    const [after] = await db.select().from(schema.leads);
    expect(after.status).toBe("ready");
    expect(after.note).toContain("No website, so there's no fact check.");
  });

  it("parks a no-website lead that lacks a category or location", async () => {
    const db = await makeTestDb();
    const l = await lead(db, { websiteUrl: null, category: null, location: null });
    await prepareProspect(db, l.id, deps());
    const [after] = await db.select().from(schema.leads);
    expect(after.status).toBe("needs_attention");
    expect(await db.select().from(schema.scans)).toHaveLength(0);
  });

  it("finishes a lead with no email as ready without sending anything", async () => {
    const db = await makeTestDb();
    const l = await lead(db, { contactName: null, email: null });
    const d = deps();
    await prepareProspect(db, l.id, d);
    const [after] = await db.select().from(schema.leads);
    expect(after.status).toBe("ready");
    expect(after.auditEmailedAt).toBeNull();
    expect(d.sendAudit).not.toHaveBeenCalled();
  });

  it("creates a paused practice, fills its fact sheet and questions from the website, scans it, and says it's ready", async () => {
    const db = await makeTestDb();
    const l = await lead(db);
    const d = deps();
    await prepareProspect(db, l.id, d);

    const [p] = await db.select().from(schema.practices);
    expect(p).toMatchObject({ name: "Glow MedSpa", slug: "glow-medspa", website: "https://glowmedspa.com", active: false, category: "Med spa", location: "Austin, TX" });
    const facts = await db.select().from(schema.facts);
    expect(facts).toEqual([expect.objectContaining({ label: "Botox price", status: "active", source: "website" })]);
    expect((await db.select().from(schema.prompts)).map(q => q.kind).sort()).toEqual(["branded", "category"]);
    expect((await db.select().from(schema.scans))[0].status).toBe("complete");
    const [after] = await db.select().from(schema.leads).where(eq(schema.leads.id, l.id));
    expect(after).toMatchObject({ status: "ready", practiceId: p.id });
    expect(d.notify).toHaveBeenCalledWith(expect.objectContaining({ practiceName: "Glow MedSpa", status: "ready", practiceId: p.id }));
    expect(d.sendAudit).toHaveBeenCalledWith(db, p.id, { email: "kim@glow.example", contactName: "Dr. Kim" });
    expect(after.auditEmailedAt).toBeInstanceOf(Date);
  });

  it("still scans on the questions alone when the website can't be read, and flags it", async () => {
    const db = await makeTestDb();
    const l = await lead(db);
    await prepareProspect(db, l.id, deps({ fetchPages: async () => { throw new Error("blocked"); } }));
    const [after] = await db.select().from(schema.leads);
    expect(after.status).toBe("ready");
    expect(after.note).toMatch(/website couldn't be read/i);
    expect(await db.select().from(schema.facts)).toHaveLength(0);
    expect(await db.select().from(schema.scans)).toHaveLength(1);
  });

  it("needs attention, without scanning, when no questions could be drafted", async () => {
    const db = await makeTestDb();
    const l = await lead(db);
    await prepareProspect(db, l.id, deps({ draftQuestions: noQuestions }));
    const [after] = await db.select().from(schema.leads);
    expect(after.status).toBe("needs_attention");
    expect(after.note).toMatch(/questions/i);
    expect(await db.select().from(schema.scans)).toHaveLength(0);
  });

  it("needs attention when the scan is blocked", async () => {
    const db = await makeTestDb();
    const l = await lead(db);
    const down: EngineAdapter = { name: "openai", run: async () => { throw new Error("down"); } };
    await prepareProspect(db, l.id, deps({ scan: (db2, id) => runScan(db2, id, [down], async () => ({ wrong: [], right: [] }), async () => [], { retryDelaysMs: [], finalRetryDelayMs: 0 }) }));
    const [after] = await db.select().from(schema.leads);
    expect(after.status).toBe("needs_attention");
    expect(after.note).toMatch(/answers came back/i);
  });

  it("gives a second prospect with the same name its own address, and never sets up a lead twice", async () => {
    const db = await makeTestDb();
    await db.insert(schema.practices).values({ name: "Glow MedSpa", slug: "glow-medspa" });
    const l = await lead(db);
    await prepareProspect(db, l.id, deps());
    await prepareProspect(db, l.id, deps());
    const rows = await db.select().from(schema.practices);
    expect(rows.map(r => r.slug).sort()).toEqual(["glow-medspa", "glow-medspa-2"]);
  });

  // Review finding: two "Glow MedSpa" leads with different websites, prepared
  // at the same moment, both read the taken slugs before either inserts; the
  // second insert hit the unique constraint, threw before `finish`, and that
  // lead sat in "preparing" with no practice and no note.
  it("gives two same-name leads prepared at the same moment their own addresses, and parks neither", async () => {
    const db = await makeTestDb();
    const a = await lead(db, { websiteUrl: "glow1.example" });
    const b = await lead(db, { websiteUrl: "glow2.example" });
    const da = deps();
    const db2 = deps();
    await Promise.all([prepareProspect(db, a.id, da), prepareProspect(db, b.id, db2)]);

    const rows = await db.select().from(schema.practices);
    expect(rows.map(r => r.slug).sort()).toEqual(["glow-medspa", "glow-medspa-2"]);
    const after = await db.select().from(schema.leads);
    expect(after.map(l => l.status)).toEqual(["ready", "ready"]);
    expect(new Set(after.map(l => l.practiceId)).size).toBe(2);
    expect(after.every(l => l.practiceId)).toBe(true);
    expect(await db.select().from(schema.scans)).toHaveLength(2);
    expect(da.sendAudit).toHaveBeenCalledTimes(1);
    expect(db2.sendAudit).toHaveBeenCalledTimes(1);
  });

  it("marks the lead as needing a look, with the error in the note, when a step throws unexpectedly", async () => {
    const db = await makeTestDb();
    const l = await lead(db);
    // A synchronous throw from a dependency is not caught by the `.catch` the
    // step attaches to its promise, so it reaches the outer guard.
    const d = deps({ fetchPages: () => { throw new Error("DNS exploded"); } });
    await prepareProspect(db, l.id, d);

    const [p] = await db.select().from(schema.practices);
    const [after] = await db.select().from(schema.leads);
    expect(after).toMatchObject({ status: "needs_attention", practiceId: p.id });
    expect(after.note).toMatch(/setup failed: DNS exploded/i);
    expect(await db.select().from(schema.scans)).toHaveLength(0);
    expect(d.sendAudit).not.toHaveBeenCalled();
    expect(d.notify).toHaveBeenCalledWith(expect.objectContaining({ status: "needs_attention", practiceId: p.id, note: after.note }));
  });

  it("keeps the specific note for an expected failure, not the catch-all one", async () => {
    const db = await makeTestDb();
    const l = await lead(db);
    await prepareProspect(db, l.id, deps({ scan: async () => { throw new Error("engine down"); } }));
    const [after] = await db.select().from(schema.leads);
    expect(after.status).toBe("needs_attention");
    expect(after.note).toMatch(/first scan failed: engine down/i);
    expect(after.note).not.toMatch(/setup failed/i);
  });

  it("doesn't email an audit when the scan was blocked", async () => {
    const db = await makeTestDb();
    const l = await lead(db);
    const down: EngineAdapter = { name: "openai", run: async () => { throw new Error("down"); } };
    const d = deps({ scan: (db2, id) => runScan(db2, id, [down], async () => ({ wrong: [], right: [] }), async () => [], { retryDelaysMs: [], finalRetryDelayMs: 0 }) });
    await prepareProspect(db, l.id, d);
    expect(d.sendAudit).not.toHaveBeenCalled();
  });

  it("notes a failed audit email without failing the setup", async () => {
    const db = await makeTestDb();
    const l = await lead(db);
    await prepareProspect(db, l.id, deps({ sendAudit: async () => { throw new Error("resend down"); } }));
    const [after] = await db.select().from(schema.leads);
    expect(after.status).toBe("ready");
    expect(after.auditEmailedAt).toBeNull();
    expect(after.note).toMatch(/report email couldn't be sent/i);
  });

  it("hands the drafter what the prospect typed, and keeps it over the drafter's guesses", async () => {
    const db = await makeTestDb();
    const l = await lead(db, { category: "Plumber", location: "Portland, OR" });
    const d = deps({ draftQuestions: vi.fn(async () => ({ category: "Med spa", location: "Austin, TX", questions: [
      { text: "Best plumber in Portland?", kind: "category" as const },
    ] })) });
    await prepareProspect(db, l.id, d);
    expect(d.draftQuestions).toHaveBeenCalledWith(expect.objectContaining({
      businessName: "Glow MedSpa", category: "Plumber", location: "Portland, OR",
    }));
    const [p] = await db.select().from(schema.practices);
    expect(p).toMatchObject({ category: "Plumber", location: "Portland, OR" });
  });

  it("lets the drafter's guess fill only what the prospect left blank", async () => {
    const db = await makeTestDb();
    const l = await lead(db, { category: "Plumber", location: "  " });
    await prepareProspect(db, l.id, deps());
    const [p] = await db.select().from(schema.practices);
    expect(p).toMatchObject({ category: "Plumber", location: "Austin, TX" });
  });

  it("falls back to the standard questions, scans and emails when the drafter returns none but the kind and place are known", async () => {
    const db = await makeTestDb();
    const l = await lead(db, { category: "Med spa", location: "Austin, TX" });
    const d = deps({ draftQuestions: noQuestions });
    await prepareProspect(db, l.id, d);

    const [p] = await db.select().from(schema.practices);
    expect(p).toMatchObject({ category: "Med spa", location: "Austin, TX" });
    const rows = await db.select().from(schema.prompts);
    expect(rows).toHaveLength(6);
    expect(rows.map(q => q.kind).sort()).toEqual(["branded", "branded", "category", "category", "category", "category"]);
    for (const q of rows) expect(q.text).toContain("Austin, TX");
    expect(rows.map(q => q.text)).toContain("What do you know about Glow MedSpa in Austin, TX?");
    expect((await db.select().from(schema.scans))[0].status).toBe("complete");
    const [after] = await db.select().from(schema.leads);
    expect(after.status).toBe("ready");
    expect(after.note).toMatch(/standard questions/i);
    expect(d.sendAudit).toHaveBeenCalledWith(db, p.id, { email: "kim@glow.example", contactName: "Dr. Kim" });
    const lines = (await db.select().from(schema.activities)).map(a => a.description);
    expect(lines).toEqual(expect.arrayContaining([
      expect.stringMatching(/no buyer questions could be drafted .* standard set for "Med spa" in Austin, TX/),
      expect.stringMatching(/set up from the booking form: 1 facts, 6 standard questions/),
    ]));
  });

  it("does not fall back when the place is unknown: no scan, no email, the lead needs a look", async () => {
    const db = await makeTestDb();
    const l = await lead(db, { category: "Plumber" });
    const d = deps({ draftQuestions: noQuestions });
    await prepareProspect(db, l.id, d);
    const [after] = await db.select().from(schema.leads);
    expect(after.status).toBe("needs_attention");
    expect(after.note).toMatch(/no buyer questions could be drafted/i);
    expect(await db.select().from(schema.prompts)).toHaveLength(0);
    expect(await db.select().from(schema.scans)).toHaveLength(0);
    expect(d.sendAudit).not.toHaveBeenCalled();
    expect(d.notify).toHaveBeenCalledWith(expect.objectContaining({ status: "needs_attention" }));
  });

  it("counts the drafter's guess for a blank the prospect left, so the fallback can still run on it", async () => {
    const db = await makeTestDb();
    const l = await lead(db, { location: "Portland, OR" });
    await prepareProspect(db, l.id, deps({ draftQuestions: async () => ({ category: "Plumber", location: null, questions: [] }) }));
    const [after] = await db.select().from(schema.leads);
    const [p] = await db.select().from(schema.practices);
    expect(p).toMatchObject({ category: "Plumber", location: "Portland, OR" });
    expect(after.status).toBe("ready");
    const texts = (await db.select().from(schema.prompts)).map(q => q.text);
    expect(texts).toHaveLength(6);
    expect(texts).toContain("What are the best plumbers in Portland, OR? Name specific businesses.");
    expect(await db.select().from(schema.scans)).toHaveLength(1);
  });
});

describe("a lead whose scan runs in steps", () => {
  it("stays preparing once the scan has started, keeping the setup notes", async () => {
    const db = await makeTestDb();
    const l = await lead(db);
    const d = deps({ fetchPages: async () => [], scan: async () => "started" });
    await prepareProspect(db, l.id, d);
    const [after] = await db.select().from(schema.leads).where(eq(schema.leads.id, l.id));
    expect(after.status).toBe("preparing");
    expect(after.note).toContain("website couldn't be read");
    expect(d.notify).not.toHaveBeenCalled();
    expect(d.sendAudit).not.toHaveBeenCalled();
  });

  it("is marked ready and emailed exactly once when the scan finishes", async () => {
    const db = await makeTestDb();
    const l = await lead(db);
    const d = deps({ scan: async () => "started" });
    await prepareProspect(db, l.id, d);
    const [p] = await db.select().from(schema.practices);
    const result = await runScan(db, p.id, [adapter], async () => ({ wrong: [], right: [] }), async () => [],
      { retryDelaysMs: [], finalRetryDelayMs: 0 });
    await finishProspect(db, p.id, result, d);
    await finishProspect(db, p.id, result, d);
    const [after] = await db.select().from(schema.leads).where(eq(schema.leads.id, l.id));
    expect(after.status).toBe("ready");
    expect(after.auditEmailedAt).toBeInstanceOf(Date);
    expect(d.sendAudit).toHaveBeenCalledTimes(1);
    expect(d.notify).toHaveBeenCalledTimes(1);
  });

  it("needs a look, with the reason, when the scan fails", async () => {
    const db = await makeTestDb();
    const l = await lead(db);
    const d = deps({ scan: async () => "started" });
    await prepareProspect(db, l.id, d);
    const [p] = await db.select().from(schema.practices);
    await finishProspect(db, p.id, { error: "couldn't start step 2: scan-step 401" }, d);
    const [after] = await db.select().from(schema.leads).where(eq(schema.leads.id, l.id));
    expect(after.status).toBe("needs_attention");
    expect(after.note).toContain("The first scan failed: couldn't start step 2: scan-step 401");
    expect(d.sendAudit).not.toHaveBeenCalled();
  });
});
