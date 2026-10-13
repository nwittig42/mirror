import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";

const session = { user: { id: "u1", role: "client" } };
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

import PracticeDetailPage from "@/app/admin/practices/[id]/page";
import { businessHref } from "@/app/admin/practices/[id]/tabs";

/** The names of every component in a rendered tree, without running them. */
function componentNames(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(componentNames);
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<{ children?: ReactNode; actions?: ReactNode }>;
  const own = typeof el.type === "function" ? [el.type.name] : [];
  return [...own, ...componentNames(el.props.children), ...componentNames(el.props.actions)];
}

const SECTIONS: Record<string, string[]> = {
  setup: ["FactSheet", "Questions", "Competitors", "NameVariations", "ReportDetails"],
  scans: ["Scan", "Diagnostics"],
  work: ["Findings", "ReportNotes", "WorkLog"],
  access: ["Access"],
};
const ALL = Object.values(SECTIONS).flat();

describe("business page tabs", () => {
  let practiceId: string;
  const render = (searchParams: Record<string, string>) =>
    PracticeDetailPage({ params: Promise.resolve({ id: practiceId }), searchParams: Promise.resolve(searchParams) });

  beforeEach(async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    ({ practiceId } = await seedPractice(db, { name: "Glow MedSpa" }));
  });

  it("is a not-found page for a customer", async () => {
    session.user.role = "client";
    await expect(render({})).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("shows only the chosen tab's sections", async () => {
    session.user.role = "operator";
    for (const [tab, expected] of Object.entries(SECTIONS)) {
      const names = componentNames(await render({ tab }));
      expect(names.filter(n => ALL.includes(n))).toEqual(expected);
    }
  });

  it("opens Setup by default, and Scans for an old scan-started link", async () => {
    session.user.role = "operator";
    expect(componentNames(await render({}))).toContain("FactSheet");
    expect(componentNames(await render({ tab: "nope" }))).toContain("FactSheet");
    expect(componentNames(await render({ scanStarted: "1" }))).toContain("Scan");
  });

  it("keeps one URL per business, with the tab as a search param", () => {
    expect(businessHref("p1")).toBe("/admin/practices/p1");
    expect(businessHref("p1", "scans", { scanStarted: "1" })).toBe("/admin/practices/p1?tab=scans&scanStarted=1");
    expect(businessHref("p1", "setup", { drafted: "3" }, "fact-sheet")).toBe("/admin/practices/p1?drafted=3#fact-sheet");
    expect(businessHref("p1", "work", {}, "findings")).toBe("/admin/practices/p1?tab=work#findings");
  });
});
