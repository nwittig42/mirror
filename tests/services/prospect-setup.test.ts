import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "../helpers/db";
import * as schema from "@/db/schema";
import { prepareProspect, type ProspectDeps } from "@/services/prospect-setup";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";

type Db = Awaited<ReturnType<typeof makeTestDb>>;

async function lead(db: Db) {
  const [row] = await db.insert(schema.leads).values({
    practiceName: "Glow MedSpa", websiteUrl: "glowmedspa.com", contactName: "Dr. Kim", email: "kim@glow.example",
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

describe("prepareProspect", () => {
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
    await prepareProspect(db, l.id, deps({ draftQuestions: async () => ({ category: null, location: null, questions: [] }) }));
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
});
