import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";

const session: { user: { id: string; role: string } } | null = { user: { id: "u1", role: "client" } };
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => session) }));

import DashboardLayout from "@/app/dashboard/[slug]/layout";
import { AdminViewBanner } from "@/components/admin-view-banner";

const child = <main>customer dashboard</main>;

/** Every element in a rendered tree, one level of fragments deep. */
function elements(node: ReactNode): ReactElement[] {
  if (!isValidElement(node)) return [];
  const kids = (node.props as { children?: ReactNode }).children;
  return [node, ...(Array.isArray(kids) ? kids : [kids]).flatMap(elements)];
}

describe("dashboard layout", () => {
  let slug: string;
  beforeEach(async () => {
    const db = await makeTestDb();
    setDbForTests(db);
    await seedPractice(db, { name: "Glow MedSpa", slug: "glow" });
    await seedPractice(db, { name: "Skin Bar LA", slug: "skinbar" });
    slug = "glow";
  });

  it("gives a customer the dark Fitness-style page, with no admin banner", async () => {
    session!.user.role = "client";
    const out = await DashboardLayout({ children: child, params: Promise.resolve({ slug }) });
    const els = elements(out);
    expect(els).toContain(child);
    expect(els.some(e => e.type === AdminViewBanner)).toBe(false);
    expect((els[0].props as { className?: string }).className).toMatch(/\bdark\b/);
  });

  it("adds the admin banner, with every customer in the switcher, for an operator", async () => {
    session!.user.role = "operator";
    const out = await DashboardLayout({ children: child, params: Promise.resolve({ slug }) });
    const banner = elements(out).find(e => e.type === AdminViewBanner);
    expect(banner).toBeDefined();
    const props = banner!.props as { current: { name: string }; practices: { slug: string }[] };
    expect(props.current.name).toBe("Glow MedSpa");
    expect(props.practices.map(p => p.slug).sort()).toEqual(["glow", "skinbar"]);
    expect(elements(out)).toContain(child);
  });
});
