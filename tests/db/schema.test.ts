import { describe, it, expect } from "vitest";
import * as schema from "@/db/schema";
import { makeTestDb } from "../helpers/db";

describe("schema", () => {
  it("stores a practice with facts, prompts, and a scan with checks", async () => {
    const db = await makeTestDb();
    const [practice] = await db.insert(schema.practices)
      .values({ name: "Glow MedSpa", slug: "glow", website: "https://glow.example" }).returning();
    await db.insert(schema.facts).values({
      practiceId: practice.id, category: "pricing", label: "Botox price", value: "$13/unit", status: "active", source: "operator",
    });
    const [prompt] = await db.insert(schema.prompts)
      .values({ practiceId: practice.id, text: "Best med spa in Santa Monica for Botox", kind: "category", active: true }).returning();
    const [scan] = await db.insert(schema.scans)
      .values({ practiceId: practice.id, status: "running" }).returning();
    await db.insert(schema.checks).values({
      scanId: scan.id, promptId: prompt.id, engine: "perplexity",
      answerText: "…Glow MedSpa…", citations: ["https://yelp.com/biz/glow"],
      mentioned: true, position: "top3", competitorsMentioned: [],
    });
    const rows = await db.select().from(schema.checks);
    expect(rows).toHaveLength(1);
    expect(rows[0].citations).toEqual(["https://yelp.com/biz/glow"]);
  });
});
