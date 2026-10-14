"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePracticeAccess } from "@/lib/auth";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { isSafeHttpUrl } from "@/lib/url";
import { BUSINESS_TYPES, type BusinessType } from "@/core/forecast";
import { EMPTY_SETUP, cleanArea, cleanKeywords, saveForecastSnapshot } from "@/services/forecast";
import { logActivity } from "@/services/activity";

const text = (formData: FormData, name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max);

/**
 * Saves the business's own profile: its website, what it is, where it is and
 * how its customers find it. The name is not here: scans look for it in every
 * answer, so a change to it goes through us. Each change is noted in our log
 * (never the customer's), so we see what they corrected before the next scan.
 */
export async function saveProfile(slug: string, formData: FormData): Promise<void> {
  const practice = await requirePracticeAccess(slug);
  const db = getDb();
  const setup = { ...EMPTY_SETUP, ...(practice.forecast ?? {}) };

  const typed = text(formData, "website", 200);
  const website = typed && !/^https?:\/\//i.test(typed) ? `https://${typed}` : typed;
  const type = text(formData, "businessType", 40);
  const area = cleanArea(text(formData, "area", 120));
  const known = new Map(setup.keywords.map(k => [k.keyword, k]));

  const next = {
    // A blank or unusable address keeps the one we have: scans and the Fact Sheet read from it.
    website: website && isSafeHttpUrl(website) ? website : practice.website,
    category: text(formData, "category", 60) || null,
    location: text(formData, "location", 80) || null,
    forecast: {
      ...setup,
      businessType: (BUSINESS_TYPES as string[]).includes(type) ? (type as BusinessType) : setup.businessType,
      area,
      // Search numbers were counted inside the old area, so a new one clears them.
      keywords: cleanKeywords(text(formData, "keywords", 4000)).map(keyword =>
        (area === setup.area && known.get(keyword)) || { keyword, searches: null, cpc: null }),
      demandAt: area === setup.area ? setup.demandAt : null,
    },
  };
  await db.update(practices).set(next).where(eq(practices.id, practice.id));

  const changed = [
    next.website !== practice.website && "website",
    next.category !== practice.category && "kind of business",
    next.location !== practice.location && "city",
    next.forecast.businessType !== setup.businessType && "type of business",
    next.forecast.area !== setup.area && "area customers come from",
    next.forecast.keywords.map(k => k.keyword).join("|") !== setup.keywords.map(k => k.keyword).join("|") && "searches",
  ].filter(Boolean);
  if (changed.length) await logActivity(db, practice.id, `profile edited from the dashboard: ${changed.join(", ")}`);
  await saveForecastSnapshot(db, practice.id);
  revalidatePath(`/dashboard/${slug}`, "layout");
}
