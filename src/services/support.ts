import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { practices, supportRequests } from "@/db/schema";
import { escapeHtml } from "@/lib/html";
import { loadEnv } from "@/lib/env";
import { logActivity } from "@/services/activity";

/**
 * Client help requests. The request is stored first and emailed second, so a
 * Resend outage never loses one: the operator works the list in /admin, and
 * the email is just the nudge to go look.
 */

export const SUPPORT_TOPICS = {
  score: "My score changed",
  wrong_fact: "AI says something wrong about us",
  report: "A question about my report",
  account: "Login or account",
  billing: "Billing",
  other: "Something else",
} as const;
export type SupportTopic = keyof typeof SUPPORT_TOPICS;

export const supportRequestSchema = z.object({
  topic: z.enum(Object.keys(SUPPORT_TOPICS) as [SupportTopic, ...SupportTopic[]], {
    message: "Pick what this is about.",
  }),
  message: z.string().trim()
    .min(10, "Tell us a little more so we can help.")
    .max(2000, "Keep it under 2,000 characters."),
});

export interface SupportEmailArgs { to: string[]; from: string; subject: string; html: string; replyTo: string }
export type SupportTransport = (args: SupportEmailArgs) => Promise<void>;

const defaultTransport: SupportTransport = async ({ to, from, subject, html, replyTo }) => {
  const { Resend } = await import("resend");
  const resend = new Resend(loadEnv().RESEND_API_KEY);
  await resend.emails.send({ from, to, subject, html, replyTo });
};

const wrap = (inner: string) =>
  `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f5;">` +
  `<div style="max-width:560px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;font-family:sans-serif;font-size:15px;line-height:1.5;color:#111;">` +
  inner + `</div></body></html>`;

/** Internal notification: who asked, about what, with a link to the admin queue. */
export function composeSupportNotice(args: {
  practiceName: string; email: string; topic: SupportTopic; message: string; adminUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Support: ${args.practiceName} · ${SUPPORT_TOPICS[args.topic]}`,
    html: wrap(
      `<p style="margin:0 0 8px;color:#666;font-size:13px;">${escapeHtml(args.practiceName)} · ${escapeHtml(args.email)}</p>` +
      `<p style="margin:0 0 12px;font-weight:600;">${escapeHtml(SUPPORT_TOPICS[args.topic])}</p>` +
      `<p style="margin:0 0 16px;white-space:pre-wrap;">${escapeHtml(args.message)}</p>` +
      `<p style="margin:0;font-size:13px;"><a href="${escapeHtml(args.adminUrl)}" style="color:#2563eb;">Open the support queue</a>. Reply to this email to answer them directly.</p>`,
    ),
  };
}

/** Receipt to the client, so they know it landed and when to expect an answer. */
export function composeSupportReceipt(args: { appName: string; topic: SupportTopic; message: string }): { subject: string; html: string } {
  return {
    subject: `We got your message · ${args.appName}`,
    html: wrap(
      `<p style="margin:0 0 12px;">Thanks, we got your message and will reply within one business day.</p>` +
      `<p style="margin:0 0 4px;color:#666;font-size:13px;">${escapeHtml(SUPPORT_TOPICS[args.topic])}</p>` +
      `<p style="margin:0;white-space:pre-wrap;color:#444;">${escapeHtml(args.message)}</p>`,
    ),
  };
}

/**
 * Stores a help request and sends both emails. Returns the new request's id.
 * Email failures are logged, never thrown: the row is the record.
 */
export async function createSupportRequest(
  db: Db,
  input: { practiceId: string; userId: string | null; email: string; topic: SupportTopic; message: string },
  transport: SupportTransport = defaultTransport,
): Promise<string> {
  const [row] = await db.insert(supportRequests).values(input).returning();
  const [practice] = await db.select().from(practices).where(eq(practices.id, input.practiceId));

  const env = loadEnv();
  const inbox = env.SUPPORT_EMAIL ?? env.OPERATOR_EMAIL;
  const notice = composeSupportNotice({
    practiceName: practice?.name ?? "Unknown business", email: input.email, topic: input.topic,
    message: input.message, adminUrl: `${env.APP_URL}/admin/support`,
  });
  const receipt = composeSupportReceipt({ appName: env.NEXT_PUBLIC_APP_NAME, topic: input.topic, message: input.message });

  const results = await Promise.allSettled([
    transport({ to: [inbox], from: env.EMAIL_FROM, replyTo: input.email, ...notice }),
    transport({ to: [input.email], from: env.EMAIL_FROM, replyTo: inbox, ...receipt }),
  ]);
  if (results.some(r => r.status === "rejected")) {
    await logActivity(db, input.practiceId, `support email failed for request ${row.id}; it is still in the queue`);
  }
  return row.id;
}

/** Marks a request answered (or reopens it). */
export async function setSupportStatus(db: Db, id: string, status: "open" | "closed"): Promise<void> {
  await db.update(supportRequests)
    .set({ status, closedAt: status === "closed" ? new Date() : null })
    .where(eq(supportRequests.id, id));
}
