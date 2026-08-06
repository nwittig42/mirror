"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { auth, signOut } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

// Type-only, so it is erased before the "use server" module is emitted. A
// runtime value exported from here would break the whole module: server-action
// files may only export async functions.
export type ChangePasswordState = { error?: string };

/**
 * Lets the signed-in user replace their own password.
 *
 * The current password is required only when the session was established by
 * typing one and the user is not mid-forced-change. The two exemptions are
 * deliberate: a magic-link session is the forgot-password path, where the user
 * by definition cannot supply the password they lost, and a forced change
 * follows the temporary password they just typed at the login form.
 *
 * On success the user is signed out. The session JWT carries the
 * must-change flag, and a stale token would otherwise keep middleware pinning
 * them to this page after they'd already complied. Signing back in with the
 * new password also proves to them that it took.
 */
export async function changePassword(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session) return { error: "Your session expired. Sign in again." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (newPassword !== confirmPassword) {
    return { error: "The two passwords don't match." };
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!user) return { error: "Your session expired. Sign in again." };

  const mustVerifyCurrent =
    session.user.channel === "password" && !user.mustChangePassword && user.passwordHash !== null;

  if (mustVerifyCurrent && !(await verifyPassword(currentPassword, user.passwordHash))) {
    return { error: "That current password isn't right." };
  }

  if (user.passwordHash && (await verifyPassword(newPassword, user.passwordHash))) {
    return { error: "Choose a different password from the one you have now." };
  }

  await db.update(users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false })
    .where(eq(users.id, user.id));

  await signOut({ redirectTo: "/login?changed=1" });
  return {};
}
