"use client";

import { useActionState, useState } from "react";
import { startAudit, type AuditStartState } from "@/app/audit/actions";

function Field({ name, label, placeholder, autoComplete, state }: {
  name: string; label: string; placeholder?: string; autoComplete?: string; state: AuditStartState;
}) {
  const error = state.fieldErrors?.[name];
  return (
    <div className="mk-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={state.values?.[name] ?? ""}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={error ? "mk-input mk-input-bad" : "mk-input"}
      />
      {error && <p className="mk-field-error" id={`${name}-error`}>{error}</p>}
    </div>
  );
}

/** Honeypot: off-screen and hidden from assistive tech, so only a bot filling every input touches it. */
function Trap() {
  return (
    <div className="mk-trap" aria-hidden="true">
      <label htmlFor="fax">Fax</label>
      <input id="fax" name="fax" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

/** Business name, type and city, for a business with no website to read. */
function NoWebsiteFields({ state }: { state: AuditStartState }) {
  return (
    <>
      <input type="hidden" name="noWebsite" value="1" />
      <Field name="practiceName" label="Business name" placeholder="Harbor Plumbing and Drain" autoComplete="organization" state={state} />
      <Field name="category" label="Type of business" placeholder="Plumber, bakery, law firm" state={state} />
      <Field name="location" label="City" placeholder="Portland, OR" autoComplete="address-level2" state={state} />
    </>
  );
}

/**
 * The one way into an audit: paste the website and it starts at once (the
 * action redirects to /audit/<id>). "No website?" swaps in name, type and
 * city instead. `hero` is the pill on the home page; `card` is the /book form.
 * `initialWebsite` only prefills the box; nothing is sent until they submit.
 */
export function WebsiteBox({ variant, initialWebsite }: { variant: "hero" | "card"; initialWebsite?: string }) {
  const [state, formAction, isPending] = useActionState(
    startAudit,
    initialWebsite ? { values: { websiteUrl: initialWebsite } } : {},
  );
  // Local, so a failed submit keeps whichever fields they were filling in.
  const [showNoWebsite, setNoWebsite] = useState(false);
  const websiteError = state.fieldErrors?.websiteUrl;
  const button = isPending ? "Starting…" : "Get a free audit";
  const toggle = (
    <button type="button" className="mk-link-btn" onClick={() => setNoWebsite(!showNoWebsite)}>
      {showNoWebsite ? "I have a website" : "No website?"}
    </button>
  );

  if (variant === "hero") {
    return (
      <div className="lp-lookup-wrap">
        {showNoWebsite ? (
          <form action={formAction} className="lp-lookup-alt" noValidate>
            <NoWebsiteFields state={state} />
            <Trap />
            <button type="submit" className="lp-btn lp-btn-primary" disabled={isPending}>{button}</button>
          </form>
        ) : (
          <>
            <form className="lp-lookup" action={formAction} noValidate>
              <input
                type="text"
                name="websiteUrl"
                defaultValue={state.values?.websiteUrl ?? ""}
                placeholder="yourwebsite.com"
                aria-label="Your website"
                autoComplete="url"
                aria-invalid={websiteError ? true : undefined}
                aria-describedby={websiteError ? "websiteUrl-error" : undefined}
              />
              <Trap />
              <button type="submit" className="lp-btn lp-btn-primary" disabled={isPending}>{button}</button>
            </form>
            {websiteError && <p className="lp-lookup-error" id="websiteUrl-error" role="alert">{websiteError}</p>}
          </>
        )}
        <p className="lp-lookup-toggle">{toggle}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mk-form-card" noValidate>
      <span className="mk-eyebrow">Free audit</span>
      <h2 className="mk-display mk-h3" style={{ marginTop: 14, marginBottom: 26 }}>
        {showNoWebsite ? "Tell us about your business." : "Paste your website."}
      </h2>
      {showNoWebsite ? <NoWebsiteFields state={state} /> : (
        <Field name="websiteUrl" label="Your website" placeholder="harborplumbing.com" autoComplete="url" state={state} />
      )}
      <Trap />
      <button type="submit" className="mk-btn mk-btn-block" disabled={isPending}>{button}</button>
      <p className="mk-field-hint" style={{ marginTop: 14 }}>
        It starts right away and takes 5-7 minutes. {toggle}
      </p>
    </form>
  );
}
