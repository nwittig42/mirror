import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import "../../landing.css";
import { getDb } from "@/db";
import { leads, practices } from "@/db/schema";
import { LandingFooter, LandingNav } from "@/components/landing/chrome";
import { displayScores, shownScore } from "@/core/scoring";
import { getChecksForScan, getCompetitorPressure, getLatestScan } from "@/lib/queries";
import { auditProgress, isUuid } from "@/services/audit-progress";
import { isRepeatSite } from "@/services/leads";
import { AuditLive } from "./audit-live";
import { DetailsForm } from "./details-form";
import { ResultsTeaser } from "./results-teaser";
import { ThankYou } from "./thank-you";

/**
 * A visitor's own audit, reached from the website box (/audit/<lead id>).
 * Public: the id is a random UUID, so whoever has the link is the visitor.
 * While it runs: left, the audit's progress; right, their details, then the
 * call. Once the scan is complete the finished audit replaces both.
 */

// The details form's action can send the finished report straight away,
// inside this page's time budget (the Hobby plan's most).
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Your audit · Mirror",
  robots: { index: false },
};

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) notFound();
  const progress = await auditProgress(db, id);
  if (!progress) notFound();

  // Not started is either a repeat of a site booked in the day before, or
  // the daily cap. The lead's note doesn't say which, so it is worked out
  // the same way the decision was made.
  const notStarted = progress.stage === "not-started"
    ? (await isRepeatSite(db, id) ? "repeat" : "capacity")
    : undefined;

  // The finished audit needs a complete scan; "done" a moment before that row
  // lands keeps the progress, which refreshes into it.
  const scan = progress.stage === "done" && lead.practiceId ? await getLatestScan(db, lead.practiceId) : null;
  const [checks, competitors, [practice]] = scan && lead.practiceId
    ? await Promise.all([
      getChecksForScan(db, scan.id),
      getCompetitorPressure(db, scan.id),
      db.select({ name: practices.name, logo: practices.logo }).from(practices).where(eq(practices.id, lead.practiceId)),
    ])
    : [[], [], []];

  // Read straight off process.env, as /book does: a missing scheduler is a fallback, not an error.
  const calendlyUrl = process.env.CALENDLY_URL || undefined;
  const websiteUrl = lead.websiteUrl ?? undefined;

  return (
    <div className="mk mk-audit-page">
      <LandingNav />

      <main style={{ flex: 1 }}>
        <section className="mk-section">
          <div className="mk-inner">
            {scan ? (
              <ResultsTeaser
                leadId={id}
                businessName={practice?.name ?? lead.practiceName ?? "Your business"}
                logo={practice?.logo ?? null}
                scanDate={scan.finishedAt ?? scan.startedAt}
                ranking={shownScore(displayScores(scan).visibility)}
                checks={checks}
                topCompetitor={competitors[0] ?? null}
                email={lead.email}
                calendlyUrl={calendlyUrl}
                prefill={{ contactName: lead.contactName ?? undefined, practiceName: lead.practiceName ?? undefined, websiteUrl }}
              />
            ) : (
              <div className="mk-book-grid">
                <AuditLive leadId={id} initial={progress} notStarted={notStarted} />
                {lead.email ? (
                  <ThankYou
                    email={lead.email}
                    calendlyUrl={calendlyUrl}
                    prefill={{ contactName: lead.contactName ?? undefined, practiceName: lead.practiceName ?? undefined, websiteUrl }}
                  />
                ) : (
                  <DetailsForm
                    leadId={id}
                    prefill={{ practiceName: lead.practiceName ?? "", category: lead.category ?? "", location: lead.location ?? "" }}
                    websiteUrl={websiteUrl}
                    calendlyUrl={calendlyUrl}
                  />
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
