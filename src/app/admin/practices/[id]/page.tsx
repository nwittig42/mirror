import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { PageBody } from "@/components/ui";
import { PrimaryLink, SecondaryLink, Tabs } from "@/app/admin/ui";
import { BusinessHeader } from "./business-header";
import { BUSINESS_TABS, businessHref, type BusinessTab } from "./tabs";
import { FactSheet } from "./fact-sheet";
import { Questions } from "./questions";
import { Competitors } from "./competitors";
import { NameVariations } from "./name-variations";
import { ReportDetails } from "./report-details";
import { ForecastSetupSection } from "./forecast";
import { Scan } from "./scan";
import { Diagnostics } from "./diagnostics";
import { Findings } from "./findings";
import { ReportNotes } from "./report-notes";
import { WorkLog } from "./work-log";
import { Access } from "./access";

// The Scans tab's "Run scan now" form invokes the `triggerScan` server action,
// which kicks off a ~2-minute scan via `after()`. `after()` work counts
// toward the *invoking route's* maxDuration, so without this export Vercel
// kills the scan mid-run on the default limit, leaving the `scans` row
// stuck `running` forever. Mirrors the identical setting on the cron route
// (`src/app/api/cron/weekly-scan/route.ts`). 800s requires a paid Vercel
// plan (see README ship checklist).
// 300 is the most the Vercel Hobby plan allows; a Pro plan allows up to 800.
export const maxDuration = 300;

/**
 * Where the operator edits one business. One URL, four tabs chosen by `?tab=`:
 * Setup (what scans use), Scans, Work (what we fix and tell the customer) and
 * Access (the customer's login). Each section is its own file next to this
 * one; it loads its own rows and owns the forms that change them.
 */
export default async function PracticeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; scanStarted?: string; drafted?: string; draftError?: string; forecastError?: string }>;
}) {
  await requireOperator();
  const { id: practiceId } = await params;
  const sp = await searchParams;

  const [practice] = await getDb().select().from(practices).where(eq(practices.id, practiceId));
  if (!practice) notFound();

  // An old "scan started" link has no tab on it; send it where the notice shows.
  const tab: BusinessTab = BUSINESS_TABS.find(t => t.key === sp.tab)?.key ?? (sp.scanStarted ? "scans" : "setup");

  return (
    <PageBody wide>
      <BusinessHeader
        name={practice.name}
        active={practice.active}
        details={[practice.slug, practice.website].filter(Boolean).join(" · ")}
        actions={<>
          <PrimaryLink href={`/admin/practices/${practice.id}/overview`}>Customer overview</PrimaryLink>
          <SecondaryLink href={`/dashboard/${practice.slug}`}>View as customer</SecondaryLink>
        </>}
      >
        <Tabs label="Business sections" current={tab}
          items={BUSINESS_TABS.map(t => ({ ...t, href: businessHref(practice.id, t.key) }))} />
      </BusinessHeader>

      <div className="space-y-4">
        {tab === "setup" && <>
          <FactSheet practiceId={practiceId} website={practice.website} drafted={sp.drafted} draftError={sp.draftError} />
          <Questions practiceId={practiceId} />
          <Competitors practiceId={practiceId} />
          <NameVariations practiceId={practiceId} />
          <ReportDetails practiceId={practiceId} category={practice.category} location={practice.location} logo={practice.logo} hasWebsite={!!practice.website} plan={practice.plan} />
          <ForecastSetupSection practiceId={practiceId} slug={practice.slug} error={sp.forecastError} />
        </>}
        {tab === "scans" && <>
          <Scan practiceId={practiceId} slug={practice.slug} scanStarted={!!sp.scanStarted} />
          <Diagnostics practiceId={practiceId} />
        </>}
        {tab === "work" && <>
          <Findings practiceId={practiceId} />
          <ReportNotes practiceId={practiceId} reportNotes={practice.reportNotes} />
          <WorkLog practiceId={practiceId} />
        </>}
        {tab === "access" && <Access practiceId={practiceId} />}
      </div>
    </PageBody>
  );
}
