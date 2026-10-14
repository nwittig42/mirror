"use server";

import { signOut } from "@/lib/auth";

/** Signs the viewer out and sends them to the public home page. */
export async function signOutToHome(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
