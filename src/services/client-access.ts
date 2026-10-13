import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { practiceMembers, users } from "@/db/schema";
import { generateTempPassword, hashPassword } from "@/lib/password";

/**
 * A client login for one business: the `users` row (role `client`) and its
 * `practice_members` link. Shared by the operator's "issue a password" button
 * and by the automatic login a prospect gets with their first report.
 */

export interface ClientLogin {
  email: string;
  /**
   * The temporary password, in plain text, exactly once. Null when the person
   * already had a password of their own, which is left alone.
   */
  password: string | null;
}

/** The address is the operator's own account, which a client login must never touch. */
export class OperatorAddressError extends Error {
  constructor() {
    super("That address is the operator account. Issue a client password to a client address.");
  }
}

/**
 * Gives `email` access to the business with a fresh temporary password they
 * must change at first sign-in. With `keepExisting`, someone who already has
 * a password keeps it and is only linked to the business.
 */
export async function grantClientLogin(
  db: Db, practiceId: string, email: string, opts: { keepExisting?: boolean } = {},
): Promise<ClientLogin> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("An email address is required.");

  const [existing] = await db.select().from(users).where(eq(users.email, normalized));
  // The operator's own password is bootstrapped from OPERATOR_PASSWORD and
  // changed at /change-password. Overwriting it here would both strand the
  // operator behind a must-change prompt and hand their credential to
  // whoever receives the password.
  if (existing?.role === "operator") throw new OperatorAddressError();

  if (existing?.passwordHash && opts.keepExisting) {
    await db.insert(practiceMembers).values({ userId: existing.id, practiceId }).onConflictDoNothing();
    return { email: normalized, password: null };
  }

  const password = generateTempPassword();
  const passwordHash = await hashPassword(password);
  const user = existing
    ? (await db.update(users)
        .set({ passwordHash, mustChangePassword: true })
        .where(eq(users.id, existing.id))
        .returning())[0]
    : (await db.insert(users)
        .values({ email: normalized, role: "client", passwordHash, mustChangePassword: true })
        .returning())[0];

  await db.insert(practiceMembers).values({ userId: user.id, practiceId }).onConflictDoNothing();
  return { email: normalized, password };
}
