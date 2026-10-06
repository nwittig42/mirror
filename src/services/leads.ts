import { and, desc, eq, gt, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { leads } from "@/db/schema";
import type { AuditRequest } from "@/services/audit-request";

/** Saves a /book submission. The row is the record of the lead; the emails are notices. */
export async function saveLead(db: Db, req: AuditRequest): Promise<{ id: string }> {
  const [row] = await db.insert(leads).values({
    practiceName: req.practiceName, websiteUrl: req.websiteUrl, contactName: req.contactName,
    email: req.email, phone: req.phone || null, bestTimes: req.bestTimes || null,
    category: req.category || null, location: req.location || null,
  }).returning({ id: leads.id });
  return row;
}

/** Every lead, newest first, for admin. */
export async function listLeads(db: Db, limit = 50) {
  return db.select().from(leads).orderBy(desc(leads.createdAt)).limit(limit);
}

/** "https://www.Glow.example/" and "glow.example" are the same site. */
function siteKey(url: string): string {
  return url.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

/** Automatic setups allowed per 24 hours. Each one is a full paid scan. */
export const DAILY_SETUP_CAP = 20;

/**
 * Whether this lead's report should be prepared automatically. Every setup
 * runs a full scan on paid AI keys, so a repeat booking for the same site
 * within a day, or anything past the daily cap (a bot, a double submit), is
 * saved as a lead but not scanned. The operator can still set it up by hand.
 */
export async function shouldPrepareLead(db: Db, leadId: string, cap = DAILY_SETUP_CAP): Promise<boolean> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return false;
  const since = new Date(Date.now() - 86_400_000);
  const others = await db.select({ websiteUrl: leads.websiteUrl }).from(leads)
    .where(and(ne(leads.id, leadId), gt(leads.createdAt, since)));
  if (others.some(o => siteKey(o.websiteUrl) === siteKey(lead.websiteUrl))) return false;
  return others.length < cap;
}

/** Marks a lead that won't be set up automatically, so admin doesn't show it "preparing" forever. */
export async function markNotPrepared(db: Db, leadId: string): Promise<void> {
  await db.update(leads).set({
    status: "needs_attention",
    note: "Not set up automatically: this website was already booked in the last day, or today's limit of automatic scans was reached. Set it up by hand if it's real.",
  }).where(eq(leads.id, leadId));
}
