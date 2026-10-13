"use client";

import { useActionState } from "react";
import { Tag, buttonClass } from "@/components/ui";
import type { HelpState } from "./actions";

const INITIAL: HelpState = { status: "idle" };

const inputClass =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-gold disabled:bg-ivory disabled:text-muted";
const labelClass = "mb-1.5 block text-[15px] font-semibold text-ink";
const errorClass = "mt-1.5 text-[13px] font-semibold text-flag";

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
      <div className="rounded-xl bg-ok-soft p-4 text-[15px] leading-relaxed text-ok" role="status">
        Got it. We&apos;ll reply by email within one business day. A copy of your message is on its way to your inbox.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <fieldset disabled={!!readOnlyNote} className="space-y-4">
        {state.message && (
          <p className="rounded-xl bg-flag-soft px-3.5 py-2.5 text-[15px] text-flag" role="alert">{state.message}</p>
        )}
        <div>
          <label htmlFor="topic" className={labelClass}>What&apos;s it about?</label>
          <select id="topic" name="topic" defaultValue={state.values?.topic ?? ""} className={inputClass} required>
            <option value="" disabled>Choose one</option>
            {Object.entries(topics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          {state.fieldErrors?.topic && <p className={errorClass}>{state.fieldErrors.topic}</p>}
        </div>
        <div>
          <label htmlFor="message" className={labelClass}>Your message</label>
          <textarea id="message" name="message" rows={5} defaultValue={state.values?.message ?? ""} className={inputClass} required
            placeholder="For example: my score went from 48 to 41 this week. What happened?" />
          {state.fieldErrors?.message && <p className={errorClass}>{state.fieldErrors.message}</p>}
        </div>
        <button type="submit" disabled={pending} className={`${buttonClass("primary")} disabled:opacity-60`}>
          {pending ? "Sending..." : "Send"}
        </button>
      </fieldset>
      {readOnlyNote && <Tag tone="gold">{readOnlyNote}</Tag>}
    </form>
  );
}
