"use client";

import { useActionState } from "react";
import { CalendlyEmbed, type CalendlyPrefill } from "@/app/book/calendly-embed";
import { savePhone, type PhoneState } from "../actions";

/**
 * Step 3: the call. Optional, so the way past it is always in view. The
 * phone number is asked for here, where it has a use, not at the start.
 */
export function CallStep({ leadId, calendlyUrl, prefill }: {
  leadId: string;
  calendlyUrl: string;
  prefill?: CalendlyPrefill;
}) {
  const [state, formAction, isPending] = useActionState(savePhone.bind(null, leadId), {} satisfies PhoneState);
  return (
    <div className="mk-form-card">
      <span className="mk-eyebrow">Step 3 of 3 · Optional</span>
      <h2 className="mk-display mk-h3" style={{ marginTop: 14 }}>Want us to walk you through it?</h2>
      <p className="mk-body" style={{ marginTop: 12 }}>
        {"Book 30 minutes and we'll go through what AI said, what it got wrong and what to fix first. Or skip this and go straight to your audit."}
      </p>
      <a className="mk-btn mk-btn-block" href={`/audit/${leadId}?step=done`} style={{ marginTop: 22 }}>
        Skip, show me my audit
      </a>

      <form action={formAction} noValidate style={{ marginTop: 28 }}>
        <div className="mk-field">
          <label htmlFor="phone">
            Phone
            <span className="opt">Optional</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            aria-describedby="phone-hint"
            className={state.error ? "mk-input mk-input-bad" : "mk-input"}
          />
          <p className={state.error ? "mk-field-error" : "mk-field-hint"} id="phone-hint" role={state.error ? "alert" : undefined}>
            {state.error ?? (state.saved ? "Saved. We'll call this number." : "Only if you'd like the call by phone.")}
          </p>
        </div>
        <button type="submit" className="mk-link-btn" disabled={isPending}>
          {isPending ? "Saving…" : "Save my number"}
        </button>
      </form>

      <div className="mk-calendly-bleed" style={{ marginTop: 24 }}>
        <CalendlyEmbed url={calendlyUrl} prefill={prefill} />
      </div>
    </div>
  );
}
