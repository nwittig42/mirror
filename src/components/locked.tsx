import type { ReactNode } from "react";
import { Card, Tag, buttonClass } from "@/components/ui";

/** Where "Book your call" goes: straight to the scheduler when one is set, else the booking page. */
export function bookingUrl(): string {
  return process.env.CALENDLY_URL || "/book";
}

export function BookCallButton({ children = "Book your call" }: { children?: ReactNode }) {
  return <a href={bookingUrl()} className={buttonClass("gold")}>{children}</a>;
}

/**
 * What a prospect sees in place of a section before their call. It holds no
 * data from the section: the page that renders this has not loaded any.
 */
export function LockedSection({ title, what }: { title: string; what: string }) {
  return (
    <Card title={title}>
      <Tag>Unlocks after your call</Tag>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{what}</p>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        On a 30-minute call we confirm your prices, services and hours with you, so everything here is checked against the truth and not a guess.
      </p>
      <div className="mt-4"><BookCallButton /></div>
    </Card>
  );
}

/**
 * The strip across the top of every page of a free account's dashboard (see
 * the dashboard layout): the audit and the recommendations are theirs, and
 * the call adds the fact check. An active client never gets it.
 */
export function CallBanner() {
  return (
    <div className="call-banner print:hidden">
      <div className="call-banner-inner">
        <div className="min-w-0">
          <p className="call-banner-title">Schedule a call to unlock your full audit.</p>
          <p className="call-banner-text">
            30 minutes, free. We check your facts with you, unlock your fact check and go through your plan step by step.
          </p>
        </div>
        <a href={bookingUrl()} className="call-banner-button">Schedule a call</a>
      </div>
    </div>
  );
}
