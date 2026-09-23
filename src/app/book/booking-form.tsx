"use client";

import { useActionState } from "react";
import { requestAudit, type BookingState } from "./actions";
import { CalendlyEmbed } from "./calendly-embed";

const INITIAL: BookingState = { status: "idle" };

function Field({
  name,
  label,
  hint,
  type = "text",
  required = false,
  autoComplete,
  placeholder,
  state,
  textarea = false,
}: {
  name: string;
  label: string;
  hint?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  state: BookingState;
  textarea?: boolean;
}) {
  const error = state.fieldErrors?.[name];
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const shared = {
    id: name,
    name,
    defaultValue: state.values?.[name] ?? "",
    placeholder,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? errorId : hint ? hintId : undefined,
    className: error ? "mk-input mk-input-bad" : "mk-input",
  };

  return (
    <div className="mk-field">
      <label htmlFor={name}>
        {label}
        {!required && <span className="opt">Optional</span>}
      </label>
      {textarea ? (
        <textarea {...shared} rows={2} autoComplete={autoComplete} />
      ) : (
        <input {...shared} type={type} autoComplete={autoComplete} />
      )}
      {error ? (
        <p className="mk-field-error" id={errorId}>
          {error}
        </p>
      ) : hint ? (
        <p className="mk-field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * `calendlyUrl` is threaded down from the page rather than read here so the
 * scheduler is configuration, not a hardcoded link. Unset, the form falls back
 * to the original "we'll email you" confirmation, which keeps /book working on
 * any deployment that has no scheduling account yet.
 */
export function BookingForm({ calendlyUrl }: { calendlyUrl?: string }) {
  const [state, formAction, isPending] = useActionState(requestAudit, INITIAL);

  if (state.status === "success") {
    if (calendlyUrl) {
      return (
        <div className="mk-form-card" role="status">
          <span className="mk-eyebrow">Scan started</span>
          <h2 className="mk-display mk-h3" style={{ marginTop: 14 }}>
            Now pick your thirty minutes.
          </h2>
          <p className="mk-body" style={{ marginTop: 14 }}>
            We&rsquo;re running your practice through ChatGPT, Claude, Gemini, and Perplexity while you choose a time,
            so we open the call on what they actually said about you, not on slides.
          </p>
          <CalendlyEmbed
            url={calendlyUrl}
            prefill={{
              contactName: state.values?.contactName,
              email: state.values?.email,
              practiceName: state.values?.practiceName,
              websiteUrl: state.values?.websiteUrl,
            }}
          />
          <p className="mk-field-hint" style={{ marginTop: 12 }}>
            Nothing is charged and no engagement starts from this.
          </p>
        </div>
      );
    }

    return (
      <div className="mk-form-card" role="status">
        <span className="mk-eyebrow">Request received</span>
        <h2 className="mk-display mk-h3" style={{ marginTop: 14 }}>
          We&rsquo;re running your scan now.
        </h2>
        <p className="mk-body" style={{ marginTop: 14 }}>
          You&rsquo;ll hear from us within one business day to lock a 30-minute slot. Before that call we put your
          practice through ChatGPT, Claude, Gemini, and Perplexity, so we open on what they actually said about you,
          not on slides.
        </p>
        <p className="mk-field-hint" style={{ marginTop: 20 }}>
          Nothing is charged and no engagement starts from this.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mk-form-card" noValidate>
      <span className="mk-eyebrow">Book your audit</span>
      <h2 className="mk-display mk-h3" style={{ marginTop: 14, marginBottom: 26 }}>
        Thirty minutes, your real practice.
      </h2>

      {state.message && (
        <p className="mk-form-alert" role="alert">
          {state.message}{" "}
          {state.fallbackEmail ? (
            <>
              Email us directly at{" "}
              <a href={`mailto:${state.fallbackEmail}?subject=Mirror%20audit%20request`}>{state.fallbackEmail}</a> and
              we&rsquo;ll pick it up from there.
            </>
          ) : (
            <>Please try again in a moment.</>
          )}
        </p>
      )}

      <Field name="practiceName" label="Practice name" required state={state} placeholder="Aesthetics by Dr. Kim" />
      <Field
        name="websiteUrl"
        label="Practice website"
        required
        state={state}
        type="text"
        placeholder="glowmedspa.com"
        hint="We scan this before the call, so we arrive with your real answers."
      />
      <Field name="contactName" label="Your name" required state={state} autoComplete="name" />
      <Field name="email" label="Email" required state={state} type="email" autoComplete="email" />
      <Field name="phone" label="Phone" state={state} type="tel" autoComplete="tel" />
      <Field
        name="bestTimes"
        label="Best times to reach you"
        state={state}
        textarea
        placeholder="Weekday mornings before clinic"
      />

      {/* Honeypot: off-screen and hidden from assistive tech, so only a bot
          filling every input will touch it. Not display:none — some bots skip
          those. */}
      <div className="mk-trap" aria-hidden="true">
        <label htmlFor="fax">Fax</label>
        <input id="fax" name="fax" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button type="submit" className="mk-btn mk-btn-block" disabled={isPending}>
        {isPending ? "Sending…" : "See my practice’s answers"}
      </button>
      <p className="mk-field-hint" style={{ marginTop: 14 }}>
        No engagement required to see it. We don&rsquo;t share your details with anyone.
      </p>
    </form>
  );
}
