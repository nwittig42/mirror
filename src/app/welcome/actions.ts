"use server";

import { AuthError } from "next-auth";
import { getDb } from "@/db";
import { signIn } from "@/lib/auth";
import { loadEnv } from "@/lib/env";
import { accountErrorMessage, redeemInvite } from "@/services/account-invites";

/** Server action behind the page a set-up link opens. Types only are exported besides the action. */

export interface RedeemState {
  error?: string;
}

export async function redeem(_prev: RedeemState, formData: FormData): Promise<RedeemState> {
  const token = formData.get("token");
  const password = formData.get("password");
  if (typeof token !== "string" || typeof password !== "string") return { error: accountErrorMessage("invalid") };

  const result = await redeemInvite(getDb(), token, password, loadEnv().OPERATOR_EMAIL);
  if (!result.ok) return { error: accountErrorMessage(result.reason) };
  try {
    // Redirects (by throwing) to /app on success.
    await signIn("credentials", { email: result.email, password, redirectTo: "/app" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Your password is set. Log in to continue." };
    throw error;
  }
  return {};
}
