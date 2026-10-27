import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests, type Db } from "@/db";
import { practices } from "@/db/schema";

const session: { user: { id: string; role: string } } | null = { user: { id: "u1", role: "client" } };
// The same rule as the real requirePracticeView: paused and not unlocked is locked, never for an operator.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => session),
  requirePracticeView: vi.fn(async (slug: string) => {
    const [practice] = await db.select().from(practices).where(eq(practices.slug, slug));
    return { practice, locked: !practice.active && !practice.dashboardUnlocked && session?.user.role !== "operator" };
  }),
}));
// The viewer's saved choice of look, as the browser would send it.
let themeCookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => (name === "mirror-theme" && themeCookie ? { value: themeCookie } : undefined) })),
}));

import { renderToStaticMarkup } from "react-dom/server";
import DashboardLayout from "@/app/dashboard/[slug]/layout";
import { AdminViewBanner } from "@/components/admin-view-banner";
import { CallBanner } from "@/components/locked";

const child = <main>customer dashboard</main>;

/** Every element in a rendered tree, one level of fragments deep. */
function elements(node: ReactNode): ReactElement[] {
  if (!isValidElement(node)) return [];
  const kids = (node.props as { children?: ReactNode }).children;
  return [node, ...(Array.isArray(kids) ? kids : [kids]).flatMap(elements)];
}

let db: Db;

describe("dashboard layout", () => {
  let slug: string;
  const classOf = async () => {
    const out = await DashboardLayout({ children: child, params: Promise.resolve({ slug }) });
    return (elements(out)[0].props as { className?: string }).className ?? "";
  };
  beforeEach(async () => {
    themeCookie = undefined;
    db = await makeTestDb();
    setDbForTests(db);
    await seedPractice(db, { name: "Glow MedSpa", slug: "glow" });
    await seedPractice(db, { name: "Skin Bar LA", slug: "skinbar" });
    slug = "glow";
  });

  it("gives a customer the ivory app page, with no admin banner", async () => {
    session!.user.role = "client";
    const out = await DashboardLayout({ children: child, params: Promise.resolve({ slug }) });
    const els = elements(out);
    expect(els).toContain(child);
    expect(els.some(e => e.type === AdminViewBanner)).toBe(false);
    expect((els[0].props as { className?: string }).className).toMatch(/\bapp\b/);
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

  it("gives a Partner the black look, and anyone else the ivory one", async () => {
    expect(await classOf()).not.toMatch(/theme-dark/);
    await db.update(practices).set({ plan: "pulse" }).where(eq(practices.slug, slug));
    expect(await classOf()).not.toMatch(/theme-dark/);
    await db.update(practices).set({ plan: "partner" }).where(eq(practices.slug, slug));
    expect(await classOf()).toMatch(/\bapp\b.*\btheme-dark\b/);
  });

  it("keeps a Partner on ivory once they have switched back to it", async () => {
    await db.update(practices).set({ plan: "partner" }).where(eq(practices.slug, slug));
    themeCookie = "light";
    expect(await classOf()).not.toMatch(/theme-dark/);
    themeCookie = "dark";
    expect(await classOf()).toMatch(/theme-dark/);
  });

  it("asks a free account to book a call, once, at the top of every page", async () => {
    session!.user.role = "client";
    await db.update(practices).set({ active: false }).where(eq(practices.slug, slug));
    const out = await DashboardLayout({ children: child, params: Promise.resolve({ slug }) });
    expect(elements(out).filter(e => e.type === CallBanner)).toHaveLength(1);
    const markup = renderToStaticMarkup(out);
    expect(markup).toContain("Want us to walk you through it?");
    expect(markup).toContain(">Book a call</a>");
    expect(markup.indexOf("Book a call")).toBeLessThan(markup.indexOf("customer dashboard"));
  });

  it("never shows the call banner to an active client, an unlocked one or an operator viewing as admin", async () => {
    session!.user.role = "client";
    const active = await DashboardLayout({ children: child, params: Promise.resolve({ slug }) });
    expect(elements(active).some(e => e.type === CallBanner)).toBe(false);

    await db.update(practices).set({ active: false, dashboardUnlocked: true }).where(eq(practices.slug, slug));
    const unlocked = await DashboardLayout({ children: child, params: Promise.resolve({ slug }) });
    expect(elements(unlocked).some(e => e.type === CallBanner)).toBe(false);

    session!.user.role = "operator";
    await db.update(practices).set({ dashboardUnlocked: false }).where(eq(practices.slug, slug));
    const admin = await DashboardLayout({ children: child, params: Promise.resolve({ slug }) });
    expect(elements(admin).some(e => e.type === CallBanner)).toBe(false);
    expect(elements(admin).some(e => e.type === AdminViewBanner)).toBe(true);
  });
});
