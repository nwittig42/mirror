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
