import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import { loadActionPlan } from "@/lib/action-plan";
import { setTick } from "@/services/action-ticks";
import { checks, practices, scans } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { WebsiteCheckResult } from "@/core/website-check";

const site: WebsiteCheckResult = {
  checkedAt: "2026-10-20T00:00:00Z",
  checks: [{ id: "sitemap", label: "Sitemap", why: "No sitemap found.", status: "fail" }],
  pages: [], homepageText: "",
};

describe("loadActionPlan", () => {
  it("is null before any complete scan", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Sweet Rise Bakery" });
    expect(await loadActionPlan(db, practiceId)).toBeNull();
    await db.insert(scans).values({ practiceId, status: "running" });
    expect(await loadActionPlan(db, practiceId)).toBeNull();
  });

  it("builds the plan from the latest complete scan, with ticks and its date", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Sweet Rise Bakery",
      prompts: [{ text: "Best birthday cake in Pasadena", kind: "category" }, { text: "Is Sweet Rise Bakery good?", kind: "branded" }],
    });
    await db.update(practices).set({ website: "https://sweetrise.example" });
    const [old] = await db.insert(scans).values({
      practiceId, status: "complete", startedAt: new Date("2026-10-01T00:00:00Z"),
    }).returning();
    const [scan] = await db.insert(scans).values({
      practiceId, status: "complete", websiteCheck: site, startedAt: new Date("2026-10-20T00:00:00Z"),
    }).returning();
    await db.insert(scans).values({ practiceId, status: "running", startedAt: new Date("2026-10-25T00:00:00Z") });
    const base = { promptId: promptIds[0], engine: "openai" as const, mentioned: false, position: "absent" as const };
    await db.insert(checks).values([
      { ...base, scanId: old.id, answerText: "Old.", citations: ["https://oldsite.example/x"], competitorsMentioned: ["Pier Pastry"] },
      { ...base, scanId: scan.id, answerText: "Honey Crumb Cake Studio.", citations: ["https://yelp.com/a"],
        competitorsMentioned: ["Honey Crumb Cake Studio"], namedOrder: ["Honey Crumb Cake Studio"] },
      { ...base, scanId: scan.id, promptId: promptIds[1], mentioned: true, position: "first", answerText: "Sweet Rise Bakery.",
        citations: ["https://brandedonly.example/x"], competitorsMentioned: ["Pier Pastry"] },
    ]);
    await setTick(db, practiceId, "source:yelp.com", true);

    const loaded = await loadActionPlan(db, practiceId);
    expect(loaded!.scanDate).toEqual(new Date("2026-10-20T00:00:00Z"));
    expect(loaded!.ticks).toEqual(new Set(["source:yelp.com"]));
    const keys = loaded!.plan.groups.flatMap(g => g.items.map(i => i.key));
    expect(keys).toEqual(["source:yelp.com", `question:${promptIds[0]}`, "site:sitemap"]);
    expect(JSON.stringify(loaded!.plan)).not.toMatch(/oldsite|brandedonly|Pier Pastry/);
  });

  it("can leave the ticks out, so it works without the ticks table, and gives the sources it read", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, { name: "Sweet Rise Bakery", prompts: [{ text: "Best cake", kind: "category" }] });
    const [scan] = await db.insert(scans).values({ practiceId, status: "complete" }).returning();
    await db.insert(checks).values({
      scanId: scan.id, promptId: promptIds[0], engine: "openai", mentioned: false, position: "absent",
      answerText: "Honey Crumb.", citations: ["https://yelp.com/a"], competitorsMentioned: ["Honey Crumb"],
    });
    await db.execute(sql`drop table action_ticks`);
    await expect(loadActionPlan(db, practiceId)).rejects.toThrow();
    const loaded = await loadActionPlan(db, practiceId, { ticks: false });
    expect(loaded!.ticks).toEqual(new Set());
    expect(loaded!.plan.total).toBeGreaterThan(0);
    expect(loaded!.sources.gaps.map(g => g.domain)).toEqual(["yelp.com"]);
  });
});
