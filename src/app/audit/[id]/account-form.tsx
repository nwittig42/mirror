"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { createAccount, type AccountState } from "../actions";

/**
 * Step 2: their login, made while the audit is still running. The email
 * from step 1 is the username. Another address is asked for only when that
 * one already has a login, with the way to log in beside it.
 */
export function AccountForm({ leadId, email, ready }: {
  leadId: string;
  /** The address from step 1. */
  email: string;
  /** The audit has already finished, as on a link opened later. */
  ready: boolean;
}) {
  const [state, formAction, isPending] = useActionState(createAccount.bind(null, leadId), {} satisfies AccountState);
  const emailError = state.fieldErrors?.email;
  const taken = state.reason === "has-account";
  return (
    <form action={formAction} className="mk-form-card" noValidate>
      <span className="mk-eyebrow">Step 2 of 3</span>
      <h2 className="mk-display mk-h3" style={{ marginTop: 14 }}>Create your login</h2>
      <p className="mk-body" style={{ marginTop: 12, marginBottom: 22 }}>
        {ready
          ? "Your audit is ready. Create your login to see it."
          : "Your audit opens in your own dashboard. Choose a password and it will be waiting for you there."}
      </p>

      {state.error && (
        <p className="mk-form-alert" role="alert">
          {state.error}
          {taken && <> <a href="/login">Log in</a>, or use a different email below.</>}
        </p>
      )}

      {taken || emailError ? (
        <div className="mk-field">
          <label htmlFor="account-email">Email</label>
          <input
            id="account-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "account-email-error" : undefined}
            className={emailError ? "mk-input mk-input-bad" : "mk-input"}
          />
          {emailError && <p className="mk-field-error" id="account-email-error">{emailError}</p>}
        </div>
      ) : (
        <div className="mk-field">
          <span className="mk-field-label">Email</span>
          <p className="mk-body" style={{ marginTop: 6 }}><strong>{email}</strong></p>
        </div>
      )}

      <div className="mk-field">
        <label htmlFor="account-password">Choose a password</label>
        <PasswordInput
          id="account-password"
          name="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          aria-describedby="account-password-hint"
          className="mk-input"
        />
        <p className="mk-field-hint" id="account-password-hint">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>
      <button type="submit" className="mk-btn mk-btn-block" disabled={isPending}>
        {isPending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
