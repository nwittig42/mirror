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
    <div className="border-b border-line bg-gold-soft text-ink print:hidden">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <p className="text-[14px] leading-snug">
          Get the full picture in 30 minutes: we&apos;ll confirm your facts, unlock your fact check and walk you through your plan.
        </p>
        <a href={bookingUrl()}
          className="whitespace-nowrap rounded-full bg-gold px-4 py-1.5 text-[13px] font-semibold text-paper hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          Book a call
        </a>
      </div>
    </div>
  );
}
