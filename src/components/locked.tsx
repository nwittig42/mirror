import type { ReactNode } from "react";
import { Card, METRIC_COLOR } from "@/components/fitness";

/** Where "Book your call" goes: straight to the scheduler when one is set, else the booking page. */
export function bookingUrl(): string {
  return process.env.CALENDLY_URL || "/book";
}

export function BookCallButton({ children = "Book your call" }: { children?: ReactNode }) {
  return (
    <a href={bookingUrl()}
      className="inline-block rounded-full bg-white px-5 py-2.5 text-[15px] font-semibold text-black hover:bg-[#e5e5ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
      {children}
    </a>
  );
}

/**
 * What a prospect sees in place of a section before their call. It holds no
 * data from the section: the page that renders this has not loaded any.
 */
export function LockedSection({ title, what }: { title: string; what: string }) {
  return (
    <Card title={title} color={METRIC_COLOR.neutral}>
      <p className="text-[13px] font-semibold uppercase tracking-wide text-[#8e8e93]">Unlocks after your call</p>
      <p className="mt-2 text-[15px] text-[#aeaeb2]">{what}</p>
      <p className="mt-2 text-[15px] text-[#aeaeb2]">
        On a 30-minute call we confirm your prices, services and hours with you, so everything here is checked against the truth and not a guess.
      </p>
      <div className="mt-4"><BookCallButton /></div>
    </Card>
  );
}
