"use client";

import { useActionState } from "react";
import type { Plan } from "@/core/plan";
import type { StartPlanState } from "./actions";

type Start = (prev: StartPlanState, formData: FormData) => Promise<StartPlanState>;

/** One plan's "Start" button, posting to the server action; works without script too. */
export function StartPlanButton({ plan, label, action, featured, disabled }: {
  plan: Plan; label: string; action: Start; featured?: boolean; disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } satisfies StartPlanState);
  if (state.status === "sent") {
    return <p className="rounded-[12px] bg-ok-soft p-4 text-[15px] font-medium leading-relaxed text-ok" role="status">{state.message}</p>;
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="plan" value={plan} />
      <button type="submit" disabled={pending || disabled}
        className={`h-11 w-full rounded-lg px-5 text-[14.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          featured ? "bg-ink text-ivory hover:bg-ink-soft" : "border border-line bg-paper text-ink hover:border-ink"}`}>
        {pending ? "Sending…" : label}
      </button>
      {state.status === "error" && <p className="mt-2 text-[13px] font-semibold text-flag" role="alert">{state.message}</p>}
    </form>
  );
}
