import type { ReactNode } from "react";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { auth, requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { isAdminViewer } from "@/lib/admin-view";
import { AdminViewBanner } from "@/components/admin-view-banner";
import { CallBanner } from "@/components/locked";
import { StartPlanFloat } from "@/components/start-plan-float";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { isPlan } from "@/core/plan";
import { THEME_COOKIE } from "@/lib/theme";

/**
 * Wraps every customer dashboard page in the app's ivory page (the .app class
 * in globals.css, the same look as the website). For an operator it also adds
 * the "viewing as admin" banner; a customer never gets it. A free account
 * (requirePracticeView's locked flag) gets the "Book a call" strip, once, on
 * every page, and the "Start your plan" button pinned bottom left; an active
 * client and an operator never do. Access itself is
 * still checked by each page. Every signed-in viewer gets the sidebar (see
 * DashboardSidebar) to the left of the page.
 *
 * A Partner's dashboard is black (the .theme-dark class) unless the viewer
 * switched back to ivory with the header's toggle, which sets a cookie.
 */

export default async function DashboardLayout({
  children, params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, jar, [plan]] = await Promise.all([
    auth(),
    cookies(),
    getDb().select({ plan: practices.plan }).from(practices).where(eq(practices.slug, slug)),
  ]);
  // Only a signed-in viewer gets a look that depends on the business; anyone else is about to see a 404.
  const dark = !!session && plan?.plan === "partner" && jar.get(THEME_COOKIE)?.value !== "light";
  // Without a session there is no viewer to lock: the page itself 404s.
  const locked = session && plan ? (await requirePracticeView(slug)).locked : false;
  const page = (banner: ReactNode) => (
    // Room at the foot of a free account's pages, so the pinned button never covers the last thing on them.
    <div className={`app antialiased ${dark ? "theme-dark" : ""} ${locked ? "pb-24" : ""}`}>
      {banner}
      <div className="lg:flex">
        {session && plan && <DashboardSidebar slug={slug} plan={isPlan(plan.plan) ? plan.plan : null} />}
        <div className="min-w-0 flex-1">
          {locked && <CallBanner />}
          {children}
        </div>
      </div>
      {locked && <StartPlanFloat slug={slug} />}
    </div>
  );
  if (!isAdminViewer(session?.user?.role)) return page(null);

  const all = await getDb().select({ id: practices.id, name: practices.name, slug: practices.slug })
    .from(practices).orderBy(asc(practices.name));
  const current = all.find(p => p.slug === slug);
  if (!current) return page(null);

  return page(<AdminViewBanner current={current} practices={all} />);
}
