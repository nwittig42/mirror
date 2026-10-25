import { CalendlyEmbed, type CalendlyPrefill } from "@/app/book/calendly-embed";

/**
 * What the right column becomes once their email is in: where the report
 * goes, then the call. Shown by the page for a lead that already has an
 * email, and by DetailsForm straight after a submit, so both read the same.
 * Without a scheduling link it falls back to "we'll reach out".
 */
export function ThankYou({ email, calendlyUrl, prefill }: { email: string; calendlyUrl?: string; prefill?: CalendlyPrefill }) {
  return (
    <div className="mk-form-card" role="status">
      <p className="mk-body">
        {"Thank you. We'll email your audit to "}<strong>{email}</strong>{" when it's done."}
      </p>
      <h2 className="mk-display mk-h3" style={{ marginTop: 26 }}>
        Book 30 minutes to walk through your results
      </h2>
      <p className="mk-body" style={{ marginTop: 12 }}>
        {"We'll go through what AI said, what it got wrong and what to fix first."}
      </p>
      {calendlyUrl ? (
        <div className="mk-calendly-bleed">
          <CalendlyEmbed url={calendlyUrl} prefill={{ ...prefill, email }} />
        </div>
      ) : (
        <p className="mk-body" style={{ marginTop: 12 }}>
          {"We'll reach out within one business day to set up a time."}
        </p>
      )}
    </div>
  );
}
