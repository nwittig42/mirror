"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { EMPTY_SETUP, saveForecastSnapshot } from "@/services/forecast";

/** A percentage as typed ("4", "4.5%") as a fraction, or null when blank or not a sensible rate. */
function rate(value: FormDataEntryValue | null): number | null {
  const n = parseFloat(String(value ?? "").replace(/[%\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n / 100 : null;
}

function dollars(value: FormDataEntryValue | null): number | null {
  const n = parseFloat(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 10_000_000 ? Math.round(n * 100) / 100 : null;
}

/**
 * Saves the business's own conversion rates and customer value, which replace
 * the industry defaults in its forecast. A blank field goes back to the
 * default. The owner can set these; so can an operator, after the call.
 */
export async function saveOwnNumbers(slug: string, formData: FormData): Promise<void> {
  const { practice, locked } = await requirePracticeView(slug);
  if (locked) return;
  const db = getDb();
  const before = { ...EMPTY_SETUP, ...(practice.forecast ?? {}) };
  const billing = formData.get("billing") === "monthly" ? "monthly" : "once";
  const typed = dollars(formData.get("customerValue"));
  // A drafted value changed to the other way of paying, with no new figure, is dropped rather than read the other way.
  const value = before.valueFrom === "prices" && typed === before.customerValue && billing !== before.billing ? null : typed;
  await db.update(practices).set({
    forecast: {
      ...before,
      visitToLead: rate(formData.get("visitToLead")),
      leadToCustomer: rate(formData.get("leadToCustomer")),
      customerValue: value,
      billing,
      // Unchanged from what was read off their prices, it stays marked as that.
      valueFrom: value === null ? null : before.valueFrom === "prices" && value === before.customerValue ? "prices" : "owner",
      // Cleared, the value goes with its drafted working, so a trusted figure cannot come back unseen.
      valueEstimate: value === null ? null : before.valueEstimate,
    },
  }).where(eq(practices.id, practice.id));
  await saveForecastSnapshot(db, practice.id);
  revalidatePath(`/dashboard/${slug}/forecast`);
}
