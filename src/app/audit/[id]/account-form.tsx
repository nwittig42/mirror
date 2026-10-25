"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { createAccount, type AccountState } from "../actions";

/**
 * Makes their login from the finished audit and signs them in. Asks for an
 * email only when the lead has none: the one on file is the username.
 */
export function AccountForm({ leadId, askEmail }: { leadId: string; askEmail: boolean }) {
  const [state, formAction, isPending] = useActionState(createAccount.bind(null, leadId), {} satisfies AccountState);
  const emailError = state.fieldErrors?.email;
  return (
    <form action={formAction} noValidate style={{ marginTop: 20 }}>
      {state.error && <p className="mk-form-alert" role="alert">{state.error}</p>}
      {askEmail && (
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
