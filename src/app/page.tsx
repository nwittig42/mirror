import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/db";
import { practiceMembers, practices } from "@/db/schema";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Mirror";

/**
 * Post-login landing page. Routes by role rather than rendering anything
 * itself: operators go straight to `/admin`, clients go straight to their
 * practice's dashboard. Middleware already redirects unauthenticated
 * requests to `/login` before this ever renders, but the `auth()` check
 * below is kept as the same defense-in-depth every other guarded page uses.
 */
export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "operator") redirect("/admin");

  const db = getDb();
  const [membership] = await db
    .select({ slug: practices.slug })
    .from(practiceMembers)
    .innerJoin(practices, eq(practiceMembers.practiceId, practices.id))
    .where(eq(practiceMembers.userId, session.user.id))
    .limit(1);

  if (membership) redirect(`/dashboard/${membership.slug}`);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{appName}</h1>
      <p className="mt-3 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        Your practice isn&apos;t linked yet — contact your Mirror operator.
      </p>
    </div>
  );
}
