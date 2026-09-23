"use server";

import { auditRequestSchema, sendAuditRequest } from "@/services/audit-request";

/**
 * Server action behind the /book form. Follows the `"use server"` pattern the
 * login page uses rather than an API route, so there is no unauthenticated
 * JSON endpoint to find and hammer.
 */

export interface BookingState {
  status: "idle" | "success" | "error";
  /** Shown above the form when the whole submission failed. */
  message?: string;
  /** Keyed by field name, rendered under the offending input. */
  fieldErrors?: Record<string, string>;
  /** Echoed back so a failed submit doesn't wipe what they typed. */
  values?: Record<string, string>;
  /** Address to fall back to when the send itself broke. */
  fallbackEmail?: string;
}

// No non-function exports live here: a "use server" module may only export
// async functions, so the form owns its own initial state.

const FIELDS = ["practiceName", "websiteUrl", "contactName", "email", "phone", "bestTimes"] as const;

/**
 * Read defensively rather than through loadEnv(): this runs in the catch, and
 * loadEnv() throwing on some unrelated missing key is one of the failures we
 * are recovering from.
 */
function fallbackEmail(): string | undefined {
  return process.env.LEADS_EMAIL || process.env.OPERATOR_EMAIL || undefined;
}

export async function requestAudit(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const values: Record<string, string> = {};
  for (const field of FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === "string" ? raw : "";
  }

  // Honeypot. Real people never see this input, so anything in it is a bot.
  // Answer with the success screen rather than an error: a bot that learns it
  // was caught just comes back having learned something.
  const trap = formData.get("fax");
  if (typeof trap === "string" && trap.trim() !== "") {
    return { status: "success" };
  }

  const parsed = auditRequestSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      // First message per field wins; a second one on the same input has
      // nowhere to render.
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors, values };
  }

  try {
    await sendAuditRequest(parsed.data);
  } catch {
    return {
      status: "error",
      message: "We couldn't submit that just now.",
      values,
      fallbackEmail: fallbackEmail(),
    };
  }

  // `values` rides along on success so the scheduler that replaces this form
  // can prefill the name and email they just typed. Retyping them one line
  // below where they entered them is the kind of friction that loses the
  // booking, which is the only step that actually matters here.
  return { status: "success", values };
}
