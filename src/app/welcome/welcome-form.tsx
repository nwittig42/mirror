"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { redeem, type RedeemState } from "./actions";

/** The password half of the set-up page. The token rides along hidden; the action checks it. */
export function WelcomeForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(redeem, {} satisfies RedeemState);
  return (
    <form action={formAction} noValidate style={{ marginTop: 24 }}>
      {state.error && <p className="mk-form-alert" role="alert">{state.error}</p>}
      <input type="hidden" name="token" value={token} />
      <div className="mk-field">
        <label htmlFor="password">Choose a password</label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          aria-describedby="password-hint"
          className="mk-input"
        />
        <p className="mk-field-hint" id="password-hint">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>
      <button type="submit" className="mk-btn mk-btn-block" disabled={isPending}>
        {isPending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
