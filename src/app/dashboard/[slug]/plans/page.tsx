import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { getLatestScan } from "@/lib/queries";
import { DashboardHeader } from "@/components/dashboard-header";
import { PageBody, PageTitle } from "@/components/ui";
import { BookCallButton } from "@/components/locked";
import { PLAN_LABELS } from "@/core/plan";
import { PLAN_OFFERS } from "@/core/plan-offer";
import { startPlan } from "./actions";
import { StartPlanButton } from "./start-plan-button";

// What a free audit is, set against a plan, row by row.
const COMPARE: { what: string; free: string; plan: string }[] = [
  { what: "AI scans", free: "Once", plan: "Every week" },
  { what: "See if your next steps worked", free: "No", plan: "Yes, on every scan" },
  { what: "Fact check and Accuracy score", free: "Locked", plan: "Yes" },
  { what: "Wrong-fact alerts", free: "No", plan: "Yes" },
  { what: "Weekly email of what changed", free: "No", plan: "Yes" },
  { what: "Monthly report", free: "No", plan: "Yes" },
];

/**
 * Plans, from inside the dashboard: what the business is on now (a one-time
 * free audit, or a plan), the two plans side by side with a button to start
 * one, and what a plan adds over the free audit. Prices come from the same
 * list as the public pricing page.
 */
export default async function PlansPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice } = await requirePracticeView(slug);
  const scan = await getLatestScan(getDb(), practice.id);
  const scanned = scan?.startedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  const action = startPlan.bind(null, slug);

  return (
    <PageBody wide>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="plans" />

      <PageTitle title={practice.plan ? `You're on ${PLAN_LABELS[practice.plan]}` : "Keep AI recommending you"}>
        {practice.plan
          ? "Your plan scans every week. Switch plans any time."
          : `Your free audit is a one-time snapshot${scanned ? ` from ${scanned}` : ""}. AI answers change every week. A plan scans again every week, so you can see your next steps working and catch new mistakes as they appear.`}
      </PageTitle>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {PLAN_OFFERS.map(o => {
          const current = practice.plan === o.plan;
          return (
            <article key={o.plan} className={`flex flex-col rounded-[18px] border p-7 shadow-[0_1px_2px_rgba(26,26,24,0.04)] ${o.featured ? "border-ink bg-paper ring-1 ring-ink" : "border-line bg-paper"}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="display text-[28px] text-ink">{o.name}</h2>
                {current ? (
                  <span className="rounded-full bg-ok-soft px-3 py-1 text-[12px] font-semibold text-ok">Your plan</span>
                ) : o.badge ? (
                  <span className="rounded-full bg-ink px-2.5 py-1 text-[12px] font-semibold text-ivory">{o.badge}</span>
                ) : null}
              </div>
              <p className="mt-4">
                <span className={`display text-[48px] tabular-nums text-ink`}>{o.amt}</span>
                <span className="text-[15px] text-muted"> / month</span>
              </p>
              <p className="mt-1 text-[13.5px] font-semibold text-teal">First month free</p>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{o.pitch}</p>
              <ul className="mt-5 flex-1 space-y-2.5 border-t border-line pt-5">
                {o.features.map(f => (
                  <li key={f} className="flex gap-2.5 text-[14.5px] leading-snug text-ink">
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 fill-none stroke-ink" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3 3 7-7" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {current
                  ? <p className="text-center text-[14px] text-muted">You&apos;re on this plan.</p>
                  : <StartPlanButton plan={o.plan} featured={o.featured} action={action}
                      label={practice.plan ? `Switch to ${o.name}` : `Start ${o.name}, first month free`} />}
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-[14px] text-muted">Per location. Month to month, cancel any time. Two months free on annual plans.</p>

      {!practice.plan && (
        <section className="mt-12">
          <h2 className="display text-[28px] text-ink">Free audit or a plan</h2>
          <div className="mt-4 overflow-hidden rounded-[14px] border border-line bg-paper">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-line text-[13px] font-medium text-muted">
                <tr><th className="px-5 py-3"> </th><th className="px-5 py-3">Free audit</th><th className="px-5 py-3 text-ink">Pulse or Partner</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {COMPARE.map(r => (
                  <tr key={r.what}>
                    <td className="px-5 py-3 font-semibold text-ink">{r.what}</td>
                    <td className="px-5 py-3 text-muted">{r.free}</td>
                    <td className="px-5 py-3 font-semibold text-ink">{r.plan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-[14px] border border-line bg-paper p-6">
            <p className="min-w-[240px] flex-1 text-[16px] text-ink-soft">Not sure which? We&apos;ll walk you through your audit and help you pick, in 30 minutes.</p>
            <BookCallButton>Book a call</BookCallButton>
          </div>
        </section>
      )}
    </PageBody>
  );
}
