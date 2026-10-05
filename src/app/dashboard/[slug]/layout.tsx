import type { ReactNode } from "react";
import { asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { isAdminViewer } from "@/lib/admin-view";
import { AdminViewBanner } from "@/components/admin-view-banner";

/**
 * Wraps every customer dashboard page in the dark, Apple Fitness-style page.
 * For an operator it also adds the "viewing as admin" banner; a customer
 * never gets it. Access itself is still
 * checked by each page's requirePracticeAccess.
 */
/** Apple's system font, as in the Fitness app; falls back cleanly off Apple devices. */
const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';

export default async function DashboardLayout({
  children, params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  const page = (banner: ReactNode) => (
    <div className="dark min-h-screen bg-black text-white antialiased print:bg-white print:text-black" style={{ fontFamily: APPLE_FONT }}>
      {banner}
      {children}
    </div>
  );
  if (!isAdminViewer(session?.user?.role)) return page(null);

  const { slug } = await params;
  const all = await getDb().select({ id: practices.id, name: practices.name, slug: practices.slug })
    .from(practices).orderBy(asc(practices.name));
  const current = all.find(p => p.slug === slug);
  if (!current) return page(null);

  return page(<AdminViewBanner current={current} practices={all} />);
}
