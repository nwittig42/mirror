import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { auth, requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { facts } from "@/db/schema";
import { PLAN_LABELS, type Plan } from "@/core/plan";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, Note, PageBody, Tag, buttonClass } from "@/components/ui";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABEL } from "@/core/forecast";
import { EMPTY_SETUP } from "@/services/forecast";
import { fieldClass } from "@/app/admin/ui";
import { saveProfile } from "./actions";
import { signOutToHome } from "../account-actions";

/** What each plan is, in one line. The full lists live on the public pricing page. */
const PLAN_LINE: Record<Plan, string> = {
  pulse: "Weekly scans, your scores, what AI says about you and a monthly report with what to change.",
  partner: "Everything in Pulse, and we do the work: we correct the sources and get you named more.",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
      <dt className="text-[14px] text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[15px] font-medium text-ink">{children}</dd>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-[14px] font-medium text-ink">
      {label}
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[13px] font-normal text-muted">{hint}</span>}
    </label>
  );
}

/**
 * The customer's profile and settings: the business details we hold, the
 * plan, the Fact Sheet and the login. The owner can correct what the business
 * is, where it is and how its customers find it; only the name and logo go
 * through Help, since scans look for the name in every answer.
 */
export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  const [session, [factCount]] = await Promise.all([
    auth(),
    getDb().select({ n: count() }).from(facts).where(and(eq(facts.practiceId, practice.id), eq(facts.status, "active"))),
  ]);
  const none = <span className="font-normal text-muted">Not set</span>;
  const setup = { ...EMPTY_SETUP, ...(practice.forecast ?? {}) };

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="settings" />

      <div className="space-y-4">
        <Card title="Your business" aside={<Link href={`/dashboard/${slug}/help`} className="text-[13px] font-semibold text-ink underline decoration-gold underline-offset-4 hover:text-gold">Ask us to change your name or logo</Link>}>
          <dl className="divide-y divide-line">
            <Row label="Name">{practice.name}</Row>
            <Row label="Logo">
              {practice.logo ? (
                // A stored data: address, so next/image has nothing to optimize.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={practice.logo} alt={`${practice.name} logo`} className="ml-auto h-10 w-10 rounded-[10px] border border-line bg-white object-contain" />
              ) : none}
            </Row>
          </dl>

          <form action={saveProfile.bind(null, slug)} className="mt-4 space-y-4 border-t border-line pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Website"><input name="website" defaultValue={practice.website ?? ""} placeholder="https://" className={`${fieldClass} w-full`} /></Field>
              <Field label="Kind of business"><input name="category" defaultValue={practice.category ?? ""} placeholder="e.g. Plumber, med spa, law firm" className={`${fieldClass} w-full`} /></Field>
              <Field label="City or area you are in"><input name="location" defaultValue={practice.location ?? ""} placeholder="e.g. Santa Monica, CA" className={`${fieldClass} w-full`} /></Field>
              <Field label="Type of business">
                <select name="businessType" defaultValue={setup.businessType} className={`${fieldClass} w-full`}>
                  {BUSINESS_TYPES.map(t => <option key={t} value={t}>{BUSINESS_TYPE_LABEL[t]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Where your customers come from" hint="The wider area people travel in from, written as City, State, United States. Write United States if you sell everywhere.">
              <input name="area" defaultValue={setup.area ? setup.area.split(",").join(", ") : ""} placeholder="Los Angeles, California, United States" className={`${fieldClass} w-full`} />
            </Field>
            <Field label="What your customers search for" hint="Short searches someone types into Google when they want what you sell, one a line. Your forecast counts how many people make them.">
              <textarea name="keywords" rows={6} defaultValue={setup.keywords.map(k => k.keyword).join("\n")} className={`${fieldClass} w-full`} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className={buttonClass("primary")}>Save changes</button>
              <Note>We filled these in from your website. Correct anything that is wrong.</Note>
            </div>
          </form>
        </Card>

        <Card title="Your plan" aside={<Link href="/pricing" className="text-[13px] font-semibold text-ink underline decoration-gold underline-offset-4 hover:text-gold">See all plans</Link>}>
          {practice.plan ? (
            <>
              <div className="text-[24px] font-semibold tracking-tight text-ink">{PLAN_LABELS[practice.plan]}</div>
              <Note className="mt-1">{PLAN_LINE[practice.plan]}</Note>
            </>
          ) : (
            <>
              <div className="text-[24px] font-semibold tracking-tight text-ink">No plan yet</div>
              <Note className="mt-1">You are on the free audit. A plan adds weekly scans and a monthly report.</Note>
            </>
          )}
        </Card>

        <Card title="Your Fact Sheet">
          {locked ? (
            <>
              <Tag>Unlocks after your call</Tag>
              <Note className="mt-3">The true version of your business. We confirm it with you on your call.</Note>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[24px] font-semibold tracking-tight text-ink">{factCount.n} confirmed fact{factCount.n === 1 ? "" : "s"}</div>
                <Note className="mt-1">The true version of your business. Every AI answer is checked against it.</Note>
              </div>
              <Link href={`/dashboard/${slug}/fact-sheet`} className={buttonClass("outline")}>Open Fact Sheet</Link>
            </div>
          )}
        </Card>

        <Card title="Your login">
          <dl className="divide-y divide-line">
            <Row label="Signed in as">{session?.user?.email ?? none}</Row>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/change-password" className={buttonClass("outline")}>Change password</Link>
            <form action={signOutToHome}><button type="submit" className={buttonClass("primary")}>Sign out</button></form>
          </div>
        </Card>
      </div>
    </PageBody>
  );
}
