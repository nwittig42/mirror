import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import type { Db } from "@/db";
import { facts, practices } from "@/db/schema";

let db: Db;
// The same rule as the real requirePracticeView: a paused business is locked.
vi.mock("@/lib/auth", () => ({
  requirePracticeView: vi.fn(async (slug: string) => {
    const [practice] = await db.select().from(practices).where(eq(practices.slug, slug));
    return { practice, locked: !practice.active };
  }),
}));

import FactSheetPage from "@/app/dashboard/[slug]/fact-sheet/page";

const params = Promise.resolve({ slug: "harbor" });
const html = async (page: Promise<React.ReactElement>) => renderToStaticMarkup(await page);

describe("the customer's Fact Sheet", () => {
  let practiceId: string;
  beforeEach(async () => {
    db = await makeTestDb();
    setDbForTests(db);
    ({ practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", slug: "harbor",
      facts: [
        { category: "pricing", label: "Service call fee", value: "$89" },
        { category: "not_offered", label: "Emergency service", value: "No 24/7 call-outs" },
      ],
    }));
    await db.insert(facts).values([
      { practiceId, category: "services", section: "Emergency call-outs", label: "Burst pipe response", value: "Within two hours, weekdays", createdAt: new Date("2026-10-01T00:00:00Z") },
      { practiceId, category: "pricing", section: "emergency call-outs", label: "After-hours fee", value: "$150 on top of the repair", createdAt: new Date("2026-10-01T00:00:01Z") },
      { practiceId, category: "logistics", label: "Saturday hours", value: "Unchecked draft hours", status: "draft", source: "website" },
      { practiceId, category: "services", label: "Old service", value: "Retired drain camera", status: "archived" },
    ]);
  });

  it("shows confirmed facts under default headings when none was chosen, with a way to ask for a change", async () => {
    const page = await html(FactSheetPage({ params }));
    expect(page).toContain("Prices");
    expect(page).toContain("Service call fee");
    expect(page).toContain("$89");
    expect(page).toContain("Not offered");
    expect(page).toContain("No 24/7 call-outs");
    expect(page).toContain('href="/dashboard/harbor/help"');
  });

  it("groups facts under the heading chosen for this business, whatever their internal type", async () => {
    const page = await html(FactSheetPage({ params }));
    // One section, spelled the way it was first written, holding a service and a price.
    expect(page.split("Emergency call-outs").length - 1).toBe(1);
    expect(page).not.toContain("emergency call-outs");
    const section = page.slice(page.indexOf("Emergency call-outs"));
    expect(section.indexOf("Burst pipe response")).toBeGreaterThan(-1);
    expect(section.indexOf("After-hours fee")).toBeGreaterThan(-1);
    // The internal type names never reach the customer.
    for (const internal of ["not_offered", "logistics", "compliance", "providers"]) expect(page).not.toContain(internal);
  });

  it("never shows a draft read off the website, or an archived fact", async () => {
    const page = await html(FactSheetPage({ params }));
    expect(page).not.toContain("Unchecked draft hours");
    expect(page).not.toContain("Retired drain camera");
  });

  it("shows a prospect before their call the locked card and none of their facts", async () => {
    await db.update(practices).set({ active: false }).where(eq(practices.id, practiceId));
    const page = await html(FactSheetPage({ params }));
    expect(page).toContain("Unlocks after your call");
    expect(page).not.toContain("$89");
    expect(page).not.toContain("Service call fee");
  });
});
