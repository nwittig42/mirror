"use client";

import { useActionState } from "react";
// From password-policy, never from @/lib/password: that module imports
// node:crypto and cannot be pulled into a client bundle.
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { changePassword, type ChangePasswordState } from "./actions";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function ChangePasswordForm({ requireCurrent }: { requireCurrent: boolean }) {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(changePassword, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
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
        className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {pending ? "Saving..." : "Set password"}
      </button>
    </form>
  );
}
