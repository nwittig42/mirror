"use server";

import { auth, requirePracticeAccess } from "@/lib/auth";
import { getDb } from "@/db";
import { createSupportRequest, supportRequestSchema } from "@/services/support";
import { ADMIN_READ_ONLY_MESSAGE, isAdminViewer } from "@/lib/admin-view";

export interface HelpState {
  status: "idle" | "sent" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: { topic: string; message: string };
}

/** Server action behind the dashboard's "Need help?" form. */
export async function submitHelp(slug: string, _prev: HelpState, formData: FormData): Promise<HelpState> {
  const practice = await requirePracticeAccess(slug);
  const session = await auth();
  const email = session?.user?.email;
  const values = {
    topic: String(formData.get("topic") ?? ""),
    message: String(formData.get("message") ?? ""),
  };
  // An operator viewing this dashboard must never file a request (and send
  // the customer a receipt) as if they were the customer.
  if (isAdminViewer(session?.user?.role)) return { status: "error", message: ADMIN_READ_ONLY_MESSAGE, values };
  if (!email) return { status: "error", message: "Sign in again, then resend.", values };

  const parsed = supportRequestSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors, values };
  }

  try {
    await createSupportRequest(getDb(), {
      practiceId: practice.id, userId: session.user.id ?? null, email, ...parsed.data,
    });
  } catch {
    return { status: "error", message: "We couldn't send that just now. Please try again.", values };
  }
  return { status: "sent" };
}
