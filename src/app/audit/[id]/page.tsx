import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import "../../landing.css";
import { getDb } from "@/db";
import { leads, practiceMembers, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { LandingFooter, LandingNav } from "@/components/landing/chrome";
import { auditProgress, isUuid } from "@/services/audit-progress";
import { isRepeatSite } from "@/services/leads";
import { AccountForm } from "./account-form";
import { AuditBar, AuditProgressProvider, WaitingStep } from "./audit-bar";
import { CallStep } from "./call-step";
import { DetailsForm } from "./details-form";
import { onboardingStep } from "./onboarding";
import { ThankYou } from "./thank-you";

/**
 * A visitor's own audit, reached from the website box (/audit/<lead id>).
 * Public: the id is a random UUID, so whoever has the link is the visitor.
 *
 * The audit runs behind a short onboarding, one step on screen at a time
 * with the audit's progress pinned above it: their details, a login, the
 * optional call. The result is never shown here. It opens in their
 * dashboard, which is why the login comes before it.
 */

// The details form's action can send the finished report straight away,
// inside this page's time budget (the Hobby plan's most).
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Your audit · Mirror",
  robots: { index: false },
};

export default async function AuditPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ step?: string | string[] }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) notFound();
  const progress = await auditProgress(db, id);
  if (!progress) notFound();

  // Who already has a way in: the business's client logins, and whether the
  // person looking is signed in as one of them.
  const members = lead.practiceId
    ? await db.select({ userId: users.id }).from(practiceMembers)
      .innerJoin(users, eq(users.id, practiceMembers.userId))
      .where(and(eq(practiceMembers.practiceId, lead.practiceId), eq(users.role, "client")))
    : [];
  const session = members.length ? await auth() : null;
  const signedInAsMember = !!session && members.some(m => m.userId === session.user.id);

  // Read straight off process.env, as /book does: a missing scheduler is a fallback, not an error.
  const calendlyUrl = process.env.CALENDLY_URL || undefined;
  const raw = (await searchParams)?.step;
  const step = onboardingStep({
    stage: progress.stage,
    hasEmail: !!lead.email,
    hasLogin: members.length > 0,
    signedInAsMember,
    stepParam: Array.isArray(raw) ? raw[0] : raw,
    hasCalendly: !!calendlyUrl,
  });

  const websiteUrl = lead.websiteUrl ?? undefined;
  const prefill = { contactName: lead.contactName ?? undefined, practiceName: lead.practiceName ?? undefined, websiteUrl };
  const formPrefill = { practiceName: lead.practiceName ?? "", category: lead.category ?? "", location: lead.location ?? "" };

  // Not started is either a repeat of a site booked in the day before, or
  // the daily cap. The lead's note doesn't say which, so it is worked out
  // the same way the decision was made.
  const stoppedLine = step !== "stopped" ? null
    : progress.stage === "failed"
      ? "Something went wrong on our side. We'll finish your audit by hand and email it to you."
      : await isRepeatSite(db, id)
        ? "We've already started an audit for this site today. Leave your details and we'll send it."
        : "We're at capacity today. Leave your details and we'll run it by hand.";

  return (
    <div className="mk mk-audit-page">
      <LandingNav />
      <AuditProgressProvider leadId={id} initial={progress}>
        <AuditBar startedAt={lead.createdAt.getTime()} />
        <main style={{ flex: 1 }}>
          <section className="mk-section">
            <div className="mk-inner mk-onboard">
              {step === "stopped" && (
                <>
                  <span className="mk-eyebrow">{lead.practiceName ? `Free audit · ${lead.practiceName}` : "Free audit"}</span>
                  <h1 className="lp-h2" style={{ marginTop: 18 }}>Your audit</h1>
                  <p className="mk-form-alert" role="status" style={{ marginTop: 28, marginBottom: 28 }}>{stoppedLine}</p>
                  {lead.email
                    ? <ThankYou email={lead.email} calendlyUrl={calendlyUrl} prefill={prefill} />
                    : <DetailsForm leadId={id} prefill={formPrefill} websiteUrl={websiteUrl} calendlyUrl={calendlyUrl} />}
                </>
              )}
              {step === "details" && (
                <DetailsForm leadId={id} prefill={formPrefill} websiteUrl={websiteUrl} calendlyUrl={calendlyUrl} step />
              )}
              {step === "login" && (
                <AccountForm leadId={id} email={lead.email ?? ""} ready={progress.stage === "done"} />
              )}
              {step === "call" && calendlyUrl && (
                <CallStep leadId={id} calendlyUrl={calendlyUrl} prefill={{ ...prefill, email: lead.email ?? undefined }} />
              )}
              {step === "waiting" && <WaitingStep />}
              {step === "has-login" && (
                <div className="mk-form-card">
                  <span className="mk-eyebrow">Welcome back</span>
                  <h2 className="mk-display mk-h3" style={{ marginTop: 14 }}>Your audit is in your dashboard</h2>
                  <p className="mk-body" style={{ marginTop: 12 }}>Log in with the email and password you chose to see it.</p>
                  <a className="mk-btn mk-btn-block" href="/login" style={{ marginTop: 22 }}>Log in</a>
                </div>
              )}
            </div>
          </section>
        </main>
      </AuditProgressProvider>
      <LandingFooter />
    </div>
  );
}
