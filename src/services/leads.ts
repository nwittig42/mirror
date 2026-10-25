import { and, desc, eq, gt, lte, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { leads, nameVariations, practices } from "@/db/schema";
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

export type LeadDetails = {
  contactName: string; email: string; phone?: string; bestTimes?: string;
  practiceName?: string; category?: string; location?: string;
};

/**
 * Starts a lead before any contact details exist: the audit runs at once and
 * the visitor's details arrive later through attachContact. With a website the
 * name is a guess to be read from it; without one the visitor gave the name.
 */
export async function startLead(
  db: Db,
  input: { websiteUrl: string } | { practiceName: string; category: string; location: string },
): Promise<{ id: string }> {
  const values = "websiteUrl" in input
    ? { websiteUrl: input.websiteUrl, practiceName: null, nameFromSite: true }
    : { websiteUrl: null, practiceName: input.practiceName, category: input.category, location: input.location };
  const [row] = await db.insert(leads).values(values).returning({ id: leads.id });
  return row;
}

/**
 * Adds the visitor's contact details to a lead. A different business name
 * than the one on file replaces it (and renames the practice, keeping the new
 * name as a name variation so scans recognise it). Null for an unknown lead.
 */
export async function attachContact(db: Db, leadId: string, details: LeadDetails) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return null;
  const set: Partial<typeof leads.$inferInsert> = {
    contactName: details.contactName, email: details.email.trim().toLowerCase(),
    phone: details.phone || null, bestTimes: details.bestTimes || null,
  };
  if (details.category) set.category = details.category;
  if (details.location) set.location = details.location;
  const name = details.practiceName?.trim();
  if (name && name !== lead.practiceName) {
    set.practiceName = name;
    set.nameFromSite = false;
    if (lead.practiceId) {
      await db.update(practices).set({ name }).where(eq(practices.id, lead.practiceId));
      await db.insert(nameVariations).values({ practiceId: lead.practiceId, text: name });
    }
  }
  const [updated] = await db.update(leads).set(set).where(eq(leads.id, leadId)).returning();
  return updated;
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
  // A lead with no website can't repeat another site.
  const mine = lead.websiteUrl;
  if (mine && others.some(o => o.websiteUrl && siteKey(o.websiteUrl) === siteKey(mine))) return false;
  return others.length < cap;
}

/**
 * Whether a lead that wasn't set up was turned away as a repeat of a site
 * booked in the day before it, rather than by the daily cap. Worked out the
 * way shouldPrepareLead decides, so the audit page can say which it was.
 */
export async function isRepeatSite(db: Db, leadId: string): Promise<boolean> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  const mine = lead?.websiteUrl;
  if (!mine) return false;
  const since = new Date(lead.createdAt.getTime() - 86_400_000);
  const earlier = await db.select({ websiteUrl: leads.websiteUrl }).from(leads)
    .where(and(ne(leads.id, leadId), gt(leads.createdAt, since), lte(leads.createdAt, lead.createdAt)));
  return earlier.some(o => o.websiteUrl && siteKey(o.websiteUrl) === siteKey(mine));
}

/** Marks a lead that won't be set up automatically, so admin doesn't show it "preparing" forever. */
export async function markNotPrepared(db: Db, leadId: string): Promise<void> {
  await db.update(leads).set({
    status: "needs_attention",
    note: "Not set up automatically: this website was already booked in the last day, or today's limit of automatic scans was reached. Set it up by hand if it's real.",
  }).where(eq(leads.id, leadId));
}
