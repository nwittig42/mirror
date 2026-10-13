"use client";

import { useActionState } from "react";
// From password-policy, never from @/lib/password: that module imports
// node:crypto and cannot be pulled into a client bundle.
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { changePassword, type ChangePasswordState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-line bg-paper px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:border-gold";

export function ChangePasswordForm({ requireCurrent }: { requireCurrent: boolean }) {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(changePassword, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && (
        <p className="rounded-xl bg-flag-soft px-4 py-3 text-[14px] font-medium text-flag">
          {state.error}
        </p>
      )}

      {requireCurrent && (
        <>
          <label className="sr-only" htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Current password"
            className={inputClass}
          />
        </>
      )}

      <label className="sr-only" htmlFor="new-password">New password</label>
      <input
        id="new-password"
        name="newPassword"
        type="password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete="new-password"
        placeholder="New password"
        className={inputClass}
      />

      <label className="sr-only" htmlFor="confirm-password">Confirm new password</label>
      <input
        id="confirm-password"
        name="confirmPassword"
        type="password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete="new-password"
        placeholder="Confirm new password"
        className={inputClass}
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-ivory hover:bg-ink-raised disabled:opacity-50"
      >
        {pending ? "Saving..." : "Set password"}
      </button>
    </form>
  );
}
