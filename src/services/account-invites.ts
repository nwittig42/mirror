import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { accountInvites, practiceMembers, users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

/**
 * Set-up links. A prospect's report email carries a link; opening it lets them
 * choose their own password, which creates their client login. The link holds
 * a random token, and only its hash is stored, so a copy of the table can't
 * be used to set anyone's password.
 */

const INVITE_DAYS = 14;

export type AccountResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "used" | "expired" | "has-account" | "weak" };

/** What to tell the visitor when a set-up attempt is refused. */
export function accountErrorMessage(reason: Extract<AccountResult, { ok: false }>["reason"]): string {
  switch (reason) {
    case "has-account": return "This email already has an account. Log in instead.";
    case "weak": return `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
    case "used": return "This set-up link has already been used. If you set a password, log in instead.";
    case "expired": return "This set-up link has expired. Ask us for a new one.";
    default: return "This set-up link isn't valid. Ask us for a new one.";
  }
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A set-up link's token for `email` and the business, valid for 14 days. Only its hash is stored. */
export async function createInvite(db: Db, practiceId: string, email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(accountInvites).values({
    tokenHash: hashToken(token),
    email: email.trim().toLowerCase(),
    practiceId,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
  });
  return token;
}

/** Whose a set-up link is, for the page it opens. Null for an unknown, used or expired link. */
export async function inviteEmail(db: Db, token: string): Promise<string | null> {
  const [invite] = await db.select().from(accountInvites).where(eq(accountInvites.tokenHash, hashToken(token)));
  if (!invite || invite.usedAt || invite.expiresAt.getTime() < Date.now()) return null;
  return invite.email;
}

/** The address is the operator's, which a visitor must never get to set a password on, even before it is bootstrapped. */
const isOperatorAddress = (email: string, operatorEmail: string) => email === operatorEmail.trim().toLowerCase();

/** Case-insensitive, as sign-in is, so a mixed-case row is found. */
const findUser = async (db: Db, email: string) =>
  (await db.select().from(users).where(sql`lower(${users.email}) = ${email}`))[0];

/**
 * Gives `email` a client login with the chosen password, linked to the
 * business. Someone who already has a password (or the operator) is refused,
 * so a set-up link can never replace a password. `allowExisting` lets a
 * passwordless existing user get one, which only a redeemed link may do.
 */
async function createLogin(
  db: Db, practiceId: string, email: string, password: string, operatorEmail: string, allowExisting: boolean,
): Promise<AccountResult> {
  if (isOperatorAddress(email, operatorEmail)) return { ok: false, reason: "has-account" };
  const existing = await findUser(db, email);
  if (existing && (!allowExisting || existing.role === "operator" || existing.passwordHash)) {
    return { ok: false, reason: "has-account" };
  }
  const passwordHash = await hashPassword(password);
  const user = existing
    ? (await db.update(users).set({ passwordHash, mustChangePassword: false }).where(eq(users.id, existing.id)).returning())[0]
    : (await db.insert(users).values({ email, role: "client", passwordHash, mustChangePassword: false }).returning())[0];
  await db.insert(practiceMembers).values({ userId: user.id, practiceId }).onConflictDoNothing();
  return { ok: true, email };
}

/** Uses a set-up link: checks it, then makes the login with the password they chose. */
export async function redeemInvite(db: Db, token: string, password: string, operatorEmail: string): Promise<AccountResult> {
  const [invite] = await db.select().from(accountInvites).where(eq(accountInvites.tokenHash, hashToken(token)));
  if (!invite) return { ok: false, reason: "invalid" };
  if (invite.usedAt) return { ok: false, reason: "used" };
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: "weak" };

  // A person who already has a password is refused before the link is spent.
  const existing = await findUser(db, invite.email);
  if (isOperatorAddress(invite.email, operatorEmail) || existing?.role === "operator" || existing?.passwordHash) {
    return { ok: false, reason: "has-account" };
  }

  // The link is claimed by one conditional update, so two opens at once can't both use it.
  const [claimed] = await db.update(accountInvites).set({ usedAt: new Date() })
    .where(and(eq(accountInvites.id, invite.id), isNull(accountInvites.usedAt))).returning();
  if (!claimed) return { ok: false, reason: "used" };
  // The database driver has no transactions, so a login that couldn't be made
  // gives the link back instead.
  const release = () => db.update(accountInvites).set({ usedAt: null }).where(eq(accountInvites.id, invite.id));
  try {
    const result = await createLogin(db, invite.practiceId, invite.email, password, operatorEmail, true);
    if (!result.ok) await release();
    return result;
  } catch (err) {
    await release();
    throw err;
  }
}

/**
 * Makes the login straight from the audit page, where the visitor types their
 * password and no link proves the address is theirs. So only a brand-new
 * address is allowed: anyone already known (with or without a password) is
 * refused, since typing their address must never take over their account.
 */
export async function createAccountFromAudit(
  db: Db, practiceId: string, email: string, password: string, operatorEmail: string,
): Promise<AccountResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false, reason: "invalid" };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: "weak" };
  // One login per business from this page: otherwise anyone holding the audit's
  // address could keep adding logins to it with new emails.
  const [member] = await db.select({ id: users.id }).from(practiceMembers)
    .innerJoin(users, eq(users.id, practiceMembers.userId))
    .where(and(eq(practiceMembers.practiceId, practiceId), eq(users.role, "client"))).limit(1);
  if (member) return { ok: false, reason: "has-account" };
  return createLogin(db, practiceId, normalized, password, operatorEmail, false);
}
