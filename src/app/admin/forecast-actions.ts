"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { BUSINESS_TYPES, type BusinessType } from "@/core/forecast";
import {
  EMPTY_SETUP, cleanArea, cleanKeywords, draftForecastSetup, fetchSearchVolume, saveForecastSnapshot,
  type ForecastSetup,
} from "@/services/forecast";
import { businessHref } from "@/app/admin/practices/[id]/tabs";

async function load(practiceId: string) {
  const db = getDb();
  const [practice] = await db.select().from(practices).where(eq(practices.id, practiceId));
  if (!practice) throw new Error("No such business.");
  return { db, practice, setup: { ...EMPTY_SETUP, ...(practice.forecast ?? {}) } as ForecastSetup };
}

async function store(practiceId: string, setup: ForecastSetup): Promise<void> {
  const db = getDb();
  await db.update(practices).set({ forecast: setup }).where(eq(practices.id, practiceId));
  await saveForecastSnapshot(db, practiceId);
  revalidatePath(`/admin/practices/${practiceId}`);
}

const back = (practiceId: string, error?: string) =>
  redirect(businessHref(practiceId, "setup", error ? { forecastError: error.slice(0, 200) } : {}, "forecast"));

/** Saves the area, the kind of business and the search terms. A term that was already counted keeps its number. */
export async function saveForecastSetup(
  practiceId: string, input: { area: string; businessType: string; keywords: string },
): Promise<void> {
  await requireOperator();
  const { setup } = await load(practiceId);
  const known = new Map(setup.keywords.map(k => [k.keyword, k]));
  const area = cleanArea(input.area);
  await store(practiceId, {
    ...setup,
    area,
    businessType: (BUSINESS_TYPES as string[]).includes(input.businessType) ? (input.businessType as BusinessType) : "other",
    // A new area makes every old number wrong.
    keywords: cleanKeywords(input.keywords).map(keyword =>
      (area === setup.area && known.get(keyword)) || { keyword, searches: null, cpc: null }),
    demandAt: area === setup.area ? setup.demandAt : null,
  });
  back(practiceId);
}

/** Has the AI pick the kind of business and the area again and add the searches a buyer types. Costs a fraction of a cent. */
export async function suggestForecastSetup(practiceId: string): Promise<void> {
  await requireOperator();
  const db = getDb();
  try {
    if (!(await draftForecastSetup(db, practiceId, { overwrite: true }))) {
      return back(practiceId, "Nothing to go on yet. Read their website into the Fact Sheet first.");
    }
  } catch (err) {
    return back(practiceId, err instanceof Error ? err.message : "Could not draft the forecast setup.");
  }
  await saveForecastSnapshot(db, practiceId);
  revalidatePath(`/admin/practices/${practiceId}`);
  back(practiceId);
}

/** Buys the monthly search count for every term in the area. One DataForSEO request, about 9 cents. */
export async function buyForecastDemand(practiceId: string): Promise<void> {
  await requireOperator();
  const { setup } = await load(practiceId);
  if (!setup.area) return back(practiceId, "Set the area first.");
  if (setup.keywords.length === 0) return back(practiceId, "Add search terms first.");
  let keywords;
  try {
    keywords = await fetchSearchVolume(setup.keywords.map(k => k.keyword), setup.area);
  } catch (err) {
    return back(practiceId, err instanceof Error ? err.message : "Could not get the search numbers.");
  }
  await store(practiceId, { ...setup, keywords, demandAt: new Date().toISOString() });
  back(practiceId);
}
