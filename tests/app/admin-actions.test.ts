import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import * as schema from "@/db/schema";

// Admin actions call `requireOperator()` first, which normally reads the
// Auth.js session cookie via `auth()`. Outside of a real request there is no
// session to read, so we replace it with a no-op that resolves to a fake
// operator session — every action under test is exercised as if an operator
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

import { addFact, updateFindingStatus } from "@/app/admin/actions";

describe("admin actions", () => {
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

    it("clears resolvedAt when a finding is reopened", async () => {
      const db = await makeTestDb();
      setDbForTests(db);
      const { finding } = await seedOpenFinding(db);

      await updateFindingStatus(finding.id, "verified");
      let [updated] = await db.select().from(schema.findings).where(eq(schema.findings.id, finding.id));
      expect(updated.resolvedAt).not.toBeNull();

      await updateFindingStatus(finding.id, "open");
      [updated] = await db.select().from(schema.findings).where(eq(schema.findings.id, finding.id));
      expect(updated.status).toBe("open");
      expect(updated.resolvedAt).toBeNull();
    });
  });
});
