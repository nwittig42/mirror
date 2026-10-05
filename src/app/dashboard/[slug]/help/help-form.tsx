"use client";

import { useActionState } from "react";
import type { HelpState } from "./actions";

const INITIAL: HelpState = { status: "idle" };

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function HelpForm({
  action, topics, readOnlyNote,
}: {
  action: (prev: HelpState, formData: FormData) => Promise<HelpState>;
  topics: Record<string, string>;
  /** Set when an admin is viewing: the form shows but can't be sent. */
  readOnlyNote?: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  if (state.status === "sent") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        Got it. We&apos;ll reply by email within one business day. A copy of your message is on its way to your inbox.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <fieldset disabled={!!readOnlyNote} className="space-y-4">
      {state.message && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      )}
      <div>
        <label htmlFor="topic" className="mb-1 block text-sm font-medium text-black dark:text-zinc-50">What&apos;s it about?</label>
        <select id="topic" name="topic" defaultValue={state.values?.topic ?? ""} className={inputClass} required>
          <option value="" disabled>Choose one</option>
          {Object.entries(topics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        {state.fieldErrors?.topic && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.topic}</p>}
      </div>
      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium text-black dark:text-zinc-50">Your message</label>
        <textarea id="message" name="message" rows={5} defaultValue={state.values?.message ?? ""} className={inputClass} required
          placeholder="e.g. My score went from 48 to 41 this week. What happened?" />
        {state.fieldErrors?.message && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.message}</p>}
      </div>
      <button type="submit" disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
        {pending ? "Sending..." : "Send"}
      </button>
      </fieldset>
      {readOnlyNote && (
        <span className="inline-block rounded-md px-2.5 py-1 text-xs font-medium"
          style={{ background: "oklch(0.95 0.06 85)", color: "oklch(0.42 0.1 70)" }}>
          {readOnlyNote}
        </span>
      )}
    </form>
  );
}
