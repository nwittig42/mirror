import type { ReactNode } from "react";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { isAdminViewer } from "@/lib/admin-view";
import { AdminViewBanner } from "@/components/admin-view-banner";
import { THEME_COOKIE } from "@/lib/theme";

/**
 * Wraps every customer dashboard page in the app's ivory page (the .app class
 * in globals.css, the same look as the website). For an operator it also adds
 * the "viewing as admin" banner; a customer never gets it. Access itself is
 * still checked by each page's requirePracticeAccess.
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
  const page = (banner: ReactNode) => (
    <div className={`app antialiased ${dark ? "theme-dark" : ""}`}>
      {banner}
      {children}
    </div>
  );
  if (!isAdminViewer(session?.user?.role)) return page(null);

  const all = await getDb().select({ id: practices.id, name: practices.name, slug: practices.slug })
    .from(practices).orderBy(asc(practices.name));
  const current = all.find(p => p.slug === slug);
  if (!current) return page(null);

  return page(<AdminViewBanner current={current} practices={all} />);
}
