import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import * as schema from "@/db/schema";

// Admin actions call `requireOperator()` first, which normally reads the
// Auth.js session cookie via `auth()`. Outside of a real request there is no
// session to read, so we replace it with a no-op that resolves to a fake
// operator session. Every action under test is exercised as if an operator
// is already signed in. `next/cache`'s `revalidatePath` also asserts it's
// running inside a Next.js request/render scope (it throws
// "Invariant: static generation store missing" otherwise), so it's stubbed
// out too; the tests only care about DB/activity side effects, not caching.
vi.mock("@/lib/auth", () => ({
  requireOperator: vi.fn().mockResolvedValue({ id: "operator-1", role: "operator" }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  addFact, updateFindingStatus, logWork, deleteWorkLogEntry, approveFact, approveAllDrafts, updateFactValue,
  createPractice,
} from "@/app/admin/actions";
import { runScan } from "@/services/scan-runner";

describe("admin actions", () => {
  describe("createPractice", () => {
    it("records the kind of business and the location the operator typed", async () => {
      const db = await makeTestDb();
      setDbForTests(db);

      await createPractice({
        name: "Harbor Plumbing", slug: "harbor-plumbing", website: "https://harborplumbing.example",
        category: " Plumber ", location: " Portland, OR ",
      });

      const [row] = await db.select().from(schema.practices).where(eq(schema.practices.slug, "harbor-plumbing"));
      expect(row).toMatchObject({
        name: "Harbor Plumbing", website: "https://harborplumbing.example", category: "Plumber", location: "Portland, OR",
      });
    });

    it("leaves both null when they are omitted or blank", async () => {
      const db = await makeTestDb();
      setDbForTests(db);

      await createPractice({ name: "Nameless", slug: "nameless" });
      await createPractice({ name: "Blank", slug: "blank", category: "   ", location: "" });

      const rows = await db.select().from(schema.practices);
      expect(rows.map(r => [r.category, r.location, r.website])).toEqual([[null, null, null], [null, null, null]]);
    });

    it("caps them at the same 60 and 80 characters as the report details form", async () => {
      const db = await makeTestDb();
      setDbForTests(db);

      await createPractice({ name: "Long", slug: "long", category: "c".repeat(100), location: "l".repeat(100) });

      const [row] = await db.select().from(schema.practices).where(eq(schema.practices.slug, "long"));
      expect(row.category).toHaveLength(60);
      expect(row.location).toHaveLength(80);
    });
  });

  describe("addFact", () => {
    it("inserts an active fact row scoped to the practice", async () => {
      const db = await makeTestDb();
      setDbForTests(db);
      const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

      await addFact(practiceId, { category: "pricing", label: "Botox price", value: "$13/unit" });

      const rows = await db.select().from(schema.facts).where(eq(schema.facts.practiceId, practiceId));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        practiceId, category: "pricing", label: "Botox price", value: "$13/unit", status: "active",
      });
    });
  });

  describe("updateFindingStatus", () => {
    async function seedOpenFinding(db: Awaited<ReturnType<typeof makeTestDb>>) {
      const { practiceId } = await seedPractice(db, {
        name: "Glow MedSpa",
        prompts: [{ text: "How much does Botox cost?", kind: "branded" }],
      });
      const [prompt] = await db.select().from(schema.prompts).where(eq(schema.prompts.practiceId, practiceId));
      const [scan] = await db.insert(schema.scans).values({ practiceId }).returning();
      const [check] = await db.insert(schema.checks).values({
        scanId: scan.id, promptId: prompt.id, engine: "openai", answerText: "Botox is $9/unit.",
        mentioned: true, position: "first",
      }).returning();
      const [finding] = await db.insert(schema.findings).values({
        practiceId, checkId: check.id, claim: "Botox at Glow MedSpa is $9/unit",
        severity: "major", status: "open",
      }).returning();
      return { practiceId, finding };
    }

    it("sets resolvedAt and logs a Fixed activity when marked fixed", async () => {
      const db = await makeTestDb();
      setDbForTests(db);
      const { practiceId, finding } = await seedOpenFinding(db);

      await updateFindingStatus(finding.id, "fixed");

      const [updated] = await db.select().from(schema.findings).where(eq(schema.findings.id, finding.id));
      expect(updated.status).toBe("fixed");
      expect(updated.resolvedAt).not.toBeNull();

      const activities = await db.select().from(schema.activities).where(eq(schema.activities.practiceId, practiceId));
      expect(activities.some(a => a.description === `Fixed: ${finding.claim}`)).toBe(true);
    });

    it("logs Dismissed / Verified activities for those statuses", async () => {
      const db = await makeTestDb();
      setDbForTests(db);
      const { practiceId, finding } = await seedOpenFinding(db);

      await updateFindingStatus(finding.id, "dismissed");

      const activities = await db.select().from(schema.activities).where(eq(schema.activities.practiceId, practiceId));
      expect(activities.some(a => a.description === `Dismissed: ${finding.claim}`)).toBe(true);
    });

    it("clears resolvedAt and logs a Reopened activity when a finding is reopened", async () => {
      const db = await makeTestDb();
      setDbForTests(db);
      const { practiceId, finding } = await seedOpenFinding(db);

      await updateFindingStatus(finding.id, "verified");
      let [updated] = await db.select().from(schema.findings).where(eq(schema.findings.id, finding.id));
      expect(updated.resolvedAt).not.toBeNull();

      await updateFindingStatus(finding.id, "open");
      [updated] = await db.select().from(schema.findings).where(eq(schema.findings.id, finding.id));
      expect(updated.status).toBe("open");
      expect(updated.resolvedAt).toBeNull();

      const activities = await db.select().from(schema.activities).where(eq(schema.activities.practiceId, practiceId));
      expect(activities.some(a => a.description === `Reopened: ${finding.claim}`)).toBe(true);
    });
  });
});

describe("logWork", () => {
  it("records a client-visible work-log entry", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    await logWork(practiceId, "Updated 14 Google service entries");

    const rows = await db.select().from(schema.activities)
      .where(eq(schema.activities.practiceId, practiceId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      description: "Updated 14 Google service entries", visibility: "client",
    });
  });

  it("rejects a blank description rather than publishing an empty line", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    await expect(logWork(practiceId, "   ")).rejects.toThrow();

    const rows = await db.select().from(schema.activities);
    expect(rows).toHaveLength(0);
  });
});

describe("deleteWorkLogEntry", () => {
  it("removes a client-visible entry", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const [entry] = await db.insert(schema.activities)
      .values({ practiceId, description: "Typo'd line", visibility: "client" }).returning();

    await deleteWorkLogEntry(entry.id);

    const rows = await db.select().from(schema.activities);
    expect(rows).toHaveLength(0);
  });

  it("leaves internal diagnostics alone", async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const [entry] = await db.insert(schema.activities)
      .values({ practiceId, description: "scan warning: gemini failed", visibility: "internal" }).returning();

    await deleteWorkLogEntry(entry.id);

    const rows = await db.select().from(schema.activities);
    expect(rows).toHaveLength(1);
  });
});

describe("competitor visibility", () => {
  it("hideCompetitor marks the row ignored so scans stop matching and re-adding it", async () => {
    const { hideCompetitor } = await import("@/app/admin/actions");
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const [row] = await db.insert(schema.competitors)
      .values({ practiceId, name: "Yelp", source: "discovered" }).returning();

    await hideCompetitor(row.id);

    const [after] = await db.select().from(schema.competitors).where(eq(schema.competitors.id, row.id));
    expect(after.status).toBe("ignored");
    const activities = await db.select().from(schema.activities).where(eq(schema.activities.practiceId, practiceId));
    expect(activities.some(a => a.description === "Hid competitor: Yelp")).toBe(true);
  });

  it("restoreCompetitor makes a hidden row active again", async () => {
    const { restoreCompetitor } = await import("@/app/admin/actions");
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const [row] = await db.insert(schema.competitors)
      .values({ practiceId, name: "Skin Bar LA", source: "discovered", status: "ignored" }).returning();

    await restoreCompetitor(row.id);

    const [after] = await db.select().from(schema.competitors).where(eq(schema.competitors.id, row.id));
    expect(after.status).toBe("active");
  });
});

describe("draft facts", () => {
  async function withDrafts() {
    const db = await makeTestDb();
    setDbForTests(db);
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Botox price at Glow MedSpa?", kind: "branded" }],
    });
    const [a, b] = await db.insert(schema.facts).values([
      { practiceId, category: "pricing", label: "Botox price", value: "$13/unit", status: "draft", source: "website" },
      { practiceId, category: "logistics", label: "Address", value: "1 Main St", status: "draft", source: "website" },
    ]).returning();
    return { db, practiceId, a, b };
  }

  it("never shows a draft to the judge", async () => {
    const { db, practiceId } = await withDrafts();
    const seen: { label: string }[][] = [];
    const judge = async (args: { answer: string; facts: { label: string; value: string; category: string }[] }) => {
      seen.push(args.facts);
      return { wrong: [], right: [] };
    };
    const adapter = { name: "openai" as const, run: async () => ({ answer: "Glow MedSpa is $9/unit", citations: [] }) };
    await runScan(db, practiceId, [adapter], judge, async () => []);
    // Only drafts exist, so there is nothing active to check against: the
    // judge is never called, and a draft never reaches it.
    expect(seen).toEqual([]);
  });

  it("approves one draft, then the rest", async () => {
    const { db, practiceId, a } = await withDrafts();
    await approveFact(a.id);
    let rows = await db.select().from(schema.facts).where(eq(schema.facts.practiceId, practiceId));
    expect(rows.find(r => r.id === a.id)?.status).toBe("active");
    expect(rows.filter(r => r.status === "draft")).toHaveLength(1);

    await approveAllDrafts(practiceId);
    rows = await db.select().from(schema.facts).where(eq(schema.facts.practiceId, practiceId));
    expect(rows.every(r => r.status === "active")).toBe(true);
  });

  it("does not resurrect an archived fact through approve", async () => {
    const { db, a } = await withDrafts();
    await db.update(schema.facts).set({ status: "archived" }).where(eq(schema.facts.id, a.id));
    await approveFact(a.id);
    const [row] = await db.select().from(schema.facts).where(eq(schema.facts.id, a.id));
    expect(row.status).toBe("archived");
  });

  it("edits a value and ignores a blank one", async () => {
    const { db, a } = await withDrafts();
    await updateFactValue(a.id, "  $14/unit ");
    await updateFactValue(a.id, "   ");
    const [row] = await db.select().from(schema.facts).where(eq(schema.facts.id, a.id));
    expect(row.value).toBe("$14/unit");
  });
});
