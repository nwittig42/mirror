"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { THEME_COOKIE } from "@/lib/theme";

/**
 * Flips a Partner dashboard between its black look and the standard ivory
 * one. A preference of whoever is looking, kept in their browser; it changes
 * nothing about the business, so an operator viewing as admin can use it too.
 */
export async function toggleDashboardTheme(): Promise<void> {
  const jar = await cookies();
  const next = jar.get(THEME_COOKIE)?.value === "light" ? "dark" : "light";
  jar.set(THEME_COOKIE, next, { path: "/dashboard", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/dashboard", "layout");
}
