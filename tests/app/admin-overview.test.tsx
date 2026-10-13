import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";

const session = { user: { id: "u1", role: "client" } };
// requireOperator's real rule (not-found unless the role is operator), over
// a swappable session: the real one reads request headers.
vi.mock("@/lib/auth", async () => {
  const { notFound } = await import("next/navigation");
  return {
    auth: vi.fn(async () => session),
    requireOperator: vi.fn(async () => {
      if (session.user.role !== "operator") notFound();
      return session.user;
    }),
  };
});

import CustomerOverviewPage from "@/app/admin/practices/[id]/overview/page";

const TABS = ["account", "scores", "reports", "answers", "facts", "setup", "emails", "support", "log"];

describe("customer overview page", () => {
  let practiceId: string;
  beforeEach(async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    ({ practiceId } = await seedPractice(db, {
      name: "Glow MedSpa", prompts: [{ text: "Best med spa", kind: "category" }],
      facts: [{ category: "pricing", label: "Botox price", value: "$13/unit" }], members: ["owner@glow.example"],
    }));
    const adapter: EngineAdapter = { name: "openai", run: async () => ({ answer: "Glow MedSpa is great.", citations: ["https://yelp.com/x"] }) };
    await runScan(db, practiceId, [adapter],
      async () => ({ wrong: [{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" as const }], right: [] }),
      async () => []);
  });

  it("is a not-found page for a customer", async () => {
    session.user.role = "client";
    await expect(CustomerOverviewPage({ params: Promise.resolve({ id: practiceId }), searchParams: Promise.resolve({}) }))
      .rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("renders every tab for an operator", async () => {
    session.user.role = "operator";
    for (const tab of TABS) {
      const page = await CustomerOverviewPage({ params: Promise.resolve({ id: practiceId }), searchParams: Promise.resolve({ tab }) });
      expect(renderToStaticMarkup(page)).toContain("Glow MedSpa");
    }
  });

  it("shows the three scores by their customer-facing names", async () => {
    session.user.role = "operator";
    const html = renderToStaticMarkup(
      await CustomerOverviewPage({ params: Promise.resolve({ id: practiceId }), searchParams: Promise.resolve({}) }));
    for (const name of ["Overall", "Recommended by AI", "Accuracy"]) expect(html).toContain(name);
    expect(html).toContain(`/admin/practices/${practiceId}?tab=access`);
  });
});
