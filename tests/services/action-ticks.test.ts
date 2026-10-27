import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import { getTicks, setTick } from "@/services/action-ticks";
import { actionTicks } from "@/db/schema";

describe("action ticks", () => {
  it("round-trips a tick, and unticking removes the row", async () => {
    const db = await makeTestDb();
    const { practiceId, memberIds } = await seedPractice(db, { name: "Sweet Rise Bakery", members: ["owner@sweetrise.example"] });
    const other = await seedPractice(db, { name: "Hillcrest Bakery" });

    expect(await getTicks(db, practiceId)).toEqual(new Set());
    await setTick(db, practiceId, "source:yelp.com", true, memberIds[0]);
    await setTick(db, practiceId, "site:sitemap", true);
    // Ticking twice is harmless.
    await setTick(db, practiceId, "source:yelp.com", true, memberIds[0]);
    await setTick(db, other.practiceId, "source:yelp.com", true);

    expect(await getTicks(db, practiceId)).toEqual(new Set(["source:yelp.com", "site:sitemap"]));
    const rows = await db.select().from(actionTicks);
    expect(rows).toHaveLength(3);
    expect(rows.find(r => r.practiceId === practiceId && r.itemKey === "source:yelp.com")).toMatchObject({ doneBy: memberIds[0] });

    await setTick(db, practiceId, "source:yelp.com", false);
    expect(await getTicks(db, practiceId)).toEqual(new Set(["site:sitemap"]));
    expect(await getTicks(db, other.practiceId)).toEqual(new Set(["source:yelp.com"]));
    expect(await db.select().from(actionTicks)).toHaveLength(2);
  });
});
