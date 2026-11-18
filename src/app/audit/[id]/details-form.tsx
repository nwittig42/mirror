"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitDetails, type DetailsState } from "../actions";
import { ThankYou } from "./thank-you";
import { useAuditProgressIfAny } from "./audit-bar";

function Field({ name, label, type = "text", optional = false, autoComplete, state, inputRef }: {
  name: string; label: string; type?: string; optional?: boolean; autoComplete?: string; state: DetailsState;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const error = state.fieldErrors?.[name];
  return (
    <div className="mk-field">
      <label htmlFor={name}>
        {label}
        {optional && <span className="opt">Optional</span>}
      </label>
      <input
        id={name}
        ref={inputRef}
        name={name}
        type={type}
        defaultValue={state.values?.[name] ?? ""}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={error ? "mk-input mk-input-bad" : "mk-input"}
      />
      {error && <p className="mk-field-error" id={`${name}-error`}>{error}</p>}
    </div>
  );
}

/**
 * Who the audit is for. The business name, type and city start filled in
 * from the lead. As step 1 of the onboarding it hands over to the login step;
 * for an audit that didn't start or failed it becomes the thank-you and the
 * scheduler, without a page load.
 */
export function DetailsForm({ leadId, prefill, websiteUrl, calendlyUrl, step = false }: {
  leadId: string;
  prefill: { practiceName: string; category: string; location: string };
  websiteUrl?: string;
  calendlyUrl?: string;
  /**
   * Step 1 of the onboarding, while the audit runs: no phone (the call step
   * asks for it), and once saved the page moves on to the login step by
   * itself. Without it, this is the form for an audit that didn't start or
   * failed, which ends in the thank-you and the scheduler.
   */
  step?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    submitDetails.bind(null, leadId),
    { status: "idle", values: prefill } satisfies DetailsState,
  );
  // The action answers with the email only, so the typed name and business
  // are kept here for the scheduler's prefill.
  const [typed, setTyped] = useState<{ contactName?: string; practiceName?: string }>({});
  // Once the details are in, the server re-renders so the page knows the
  // email (the account form below no longer asks for it). Once only.
  const router = useRouter();
  const refreshed = useRef(false);
  useEffect(() => {
    if (state.status === "success" && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [state.status, router]);

  // The business name is read from their website a few seconds after this
  // form is drawn. When it arrives and the box is still empty, it is filled
  // in, never over something they typed.
  const siteName = useAuditProgressIfAny()?.businessName ?? null;
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (siteName && nameInput.current && !nameInput.current.value) nameInput.current.value = siteName;
  }, [siteName]);

  if (state.status === "success" && state.email && step) {
    // The refresh above brings the login step; this holds the place meanwhile.
    return <div className="mk-form-card" role="status"><p className="mk-body">Saved. One moment…</p></div>;
  }
  if (state.status === "success" && state.email) {
    return (
      <ThankYou
        email={state.email}
        calendlyUrl={calendlyUrl}
        prefill={{ contactName: typed.contactName, practiceName: typed.practiceName ?? prefill.practiceName, websiteUrl }}
      />
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={e => {
        const data = new FormData(e.currentTarget);
        setTyped({ contactName: String(data.get("contactName") ?? ""), practiceName: String(data.get("practiceName") ?? "") });
      }}
      className="mk-form-card"
      noValidate
    >
      <span className="mk-eyebrow">{step ? "Step 1 of 3" : "While you wait"}</span>
      <h2 className="mk-display mk-h3" style={{ marginTop: 14, marginBottom: 26 }}>
        {step ? "About you" : "Where should we send it?"}
      </h2>
      {state.message && <p className="mk-form-alert" role="alert">{state.message}</p>}
      <Field name="contactName" label="Your name" autoComplete="name" state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
      {!step && <Field name="phone" label="Phone" type="tel" optional autoComplete="tel" state={state} />}
      <Field name="practiceName" label="Business name" autoComplete="organization" state={state} inputRef={nameInput} />
      <Field name="category" label="Type of business" optional state={state} />
      <Field name="location" label="City" optional autoComplete="address-level2" state={state} />
      <button type="submit" className="mk-btn mk-btn-block" disabled={isPending}>
        {isPending ? "Saving…" : step ? "Continue" : "Send me my audit"}
      </button>
    </form>
  );
}
