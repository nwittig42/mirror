"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Calendly inline embed, shown in place of the old "we'll email you within one
 * business day" panel once the audit request is submitted.
 *
 * Inline rather than Calendly's pop-up widget: the scheduler has to appear on
 * render (the visitor just submitted, they did not click anything), and an
 * overlay that opens by itself is both worse UX and harder to recover from if
 * the script is slow. Inline degrades to a plain link instead of to nothing.
 *
 * Calendly itself sends the confirmation to the invitee, notifies the host, and
 * writes the calendar invite, so nothing here needs to touch a calendar API.
 */

const SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";

interface CalendlyGlobal {
  initInlineWidget(opts: { url: string; parentElement: HTMLElement; resize?: boolean }): void;
}

declare global {
  interface Window {
    Calendly?: CalendlyGlobal;
  }
}

export interface CalendlyPrefill {
  contactName?: string;
  email?: string;
  practiceName?: string;
  websiteUrl?: string;
}

/**
 * Appends Calendly's prefill and attribution parameters to the configured
 * scheduling link. Pure and exported so the query-string contract is unit
 * tested without a browser.
 *
 * `utm_content` carries the practice name and website because those are the two
 * fields that make the Calendly notification actionable on its own: the booking
 * alert says which practice booked, not just which person. Blank fields are
 * omitted rather than sent empty, so Calendly leaves its own inputs editable.
 */
export function buildCalendlyUrl(base: string, prefill: CalendlyPrefill = {}): string {
  const url = new URL(base);

  if (prefill.contactName) url.searchParams.set("name", prefill.contactName);
  if (prefill.email) url.searchParams.set("email", prefill.email);

  // Plain ASCII separator: this lands in Calendly's booking notification, and a
  // non-ASCII character percent-encodes into noise in the raw link.
  const attribution = [prefill.practiceName, prefill.websiteUrl].filter(Boolean).join(" - ");
  if (attribution) {
    url.searchParams.set("utm_source", "mirror-book");
    url.searchParams.set("utm_content", attribution);
  }

  // The consent banner covers the whole widget on first load, which reads as a
  // broken embed directly under "pick your thirty minutes".
  url.searchParams.set("hide_gdpr_banner", "1");

  return url.toString();
}

export function CalendlyEmbed({ url, prefill }: { url: string; prefill?: CalendlyPrefill }) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const scheduleUrl = buildCalendlyUrl(url, prefill);

  useEffect(() => {
    let cancelled = false;

    const mount = () => {
      if (cancelled || !holder.current || !window.Calendly) return;
      // React may re-run this effect; Calendly appends a fresh iframe each
      // time it is initialised, so clear the node first rather than stacking
      // schedulers on top of each other.
      holder.current.innerHTML = "";
      window.Calendly.initInlineWidget({
        url: scheduleUrl,
        parentElement: holder.current,
        resize: true,
      });
    };

    if (window.Calendly) {
      mount();
      return () => { cancelled = true; };
    }

    // The script may already be in flight from a previous mount; reuse the tag
    // instead of loading Calendly twice.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => mount();
    const onError = () => { if (!cancelled) setFailed(true); };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, [scheduleUrl]);

  if (failed) {
    return (
      <p className="mk-body" style={{ marginTop: 14 }}>
        <a href={scheduleUrl} target="_blank" rel="noopener noreferrer">
          Pick a time on our calendar
        </a>
        .
      </p>
    );
  }

  return (
    <>
      <div ref={holder} style={{ minWidth: 280, height: 660, marginTop: 18 }} />
      {/* Always rendered: covers a blocked third-party script, which fires no
          error event, so `failed` never flips and the holder just stays empty. */}
      <p className="mk-field-hint" style={{ marginTop: 12 }}>
        Calendar not loading?{" "}
        <a href={scheduleUrl} target="_blank" rel="noopener noreferrer">
          Open it in a new tab
        </a>
        .
      </p>
    </>
  );
}
