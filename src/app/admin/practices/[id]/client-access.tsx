"use client";

import { useActionState } from "react";

export interface ClientMember {
  id: string;
  email: string;
  hasPassword: boolean;
  mustChangePassword: boolean;
}

export interface IssueResult {
  email?: string;
  password?: string;
  error?: string;
}

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const primaryButtonClass =
  "rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200";
/**
 * Client access panel. A client component rather than a plain server form
 * because the issued password has to come *back* to the screen, and the two
 * obvious server-only routes both leak it: a redirect puts it in the URL, and
 * therefore in browser history and access logs, and storing it to read on the
 * next render means writing a plaintext password down. `useActionState` keeps
 * it in the response to this one submit and nowhere else.
 */
export function ClientAccess({
  members,
  issue,
}: {
  members: ClientMember[];
  issue: (previous: IssueResult, formData: FormData) => Promise<IssueResult>;
}) {
  const [state, formAction, pending] = useActionState(issue, {});

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Client access</h2>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
        Creates the account and a one-time password to read to the client on the onboarding call.
        They sign in at /login and are asked to choose their own password before they see anything.
      </p>

      <form action={formAction} className="flex gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="client@practice.com"
          className={`${inputClass} flex-1`}
        />
        <button type="submit" disabled={pending} className={`${primaryButtonClass} disabled:opacity-50`}>
          {pending ? "Working..." : "Create password"}
        </button>
      </form>

      {state.error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      {state.password && (
        <div className="mt-3 rounded-md border border-zinc-300 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Temporary password for {state.email}. Read it out now. It is not shown again and is not
            stored anywhere you can look it up.
          </p>
          <p className="mt-2 font-mono text-lg tracking-wide text-black dark:text-zinc-50">
            {state.password}
          </p>
        </div>
      )}

      {members.length > 0 && (
        <ul className="mt-4 space-y-2">
          {members.map(member => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-2 text-sm dark:border-zinc-800"
            >
              <span className="text-black dark:text-zinc-50">{member.email}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {!member.hasPassword
                  ? "No password, magic link only"
                  : member.mustChangePassword
                    ? "Temporary password, not changed yet"
                    : "Password set"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {members.length > 0 && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          To reset a password, submit the same address again. The old one stops working immediately.
        </p>
      )}
    </section>
  );
}
