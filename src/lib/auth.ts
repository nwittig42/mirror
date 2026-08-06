import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, type Db } from "@/db";
import { accounts, practiceMembers, practices, sessions, users, verificationTokens } from "@/db/schema";
import { loadEnv } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/password";

export type Role = "operator" | "client";

/**
 * How the current session was established. Only "password" sessions are asked
 * for their current password before setting a new one: a "link" session got in
 * by proving control of the mailbox, which is exactly the forgot-password path,
 * where by definition the user cannot supply the password they've lost.
 */
export type AuthChannel = "password" | "link";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      mustChangePassword: boolean;
      channel: AuthChannel;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    mustChangePassword?: boolean;
    channel?: AuthChannel;
  }
}

/**
 * Pure authorization rule shared by every dashboard/admin guard: operators
 * can access any practice, clients only the ones they're a member of.
 */
export function canAccessPractice(
  user: { role: Role; memberPracticeIds: string[] },
  practiceId: string,
): boolean {
  if (user.role === "operator") return true;
  return user.memberPracticeIds.includes(practiceId);
}

export interface CredentialUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  mustChangePassword: boolean;
}

/**
 * The whole email+password sign-in rule, kept out of the NextAuth config so it
 * can be tested against a real database without standing up a request.
 *
 * Passwords are only ever compared against `users.password_hash` (scrypt, see
 * src/lib/password.ts). `OPERATOR_PASSWORD` is not a password to compare
 * against, it is a one-time bootstrap: it seeds the operator's hash the first
 * time they sign in, and is ignored forever after, so an operator who changes
 * their password in-app is not still reachable through a stale env var.
 *
 * A user with no hash cannot sign in this way at all. That is the normal state
 * of a client who has only ever used a magic link, and it must fail closed
 * rather than wave through any password.
 */
export async function authorizeCredentials(
  db: Db,
  env: { OPERATOR_EMAIL: string; OPERATOR_PASSWORD: string },
  input: { email: string; password: string },
): Promise<CredentialUser | null> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email || !password) return null;

  // Case-insensitive: `inviteClient` stores whatever case the operator typed,
  // so an exact match would lock out a client who signs in as "Client@..."
  // when the row says "client@...".
  const [existing] = await db.select().from(users)
    .where(sql`lower(${users.email}) = ${email}`);

  const isOperatorEmail = email === env.OPERATOR_EMAIL.trim().toLowerCase();

  if (existing?.passwordHash) {
    if (!(await verifyPassword(password, existing.passwordHash))) return null;

    // The operator email is authoritative over whatever the row says, matching
    // the pre-existing behaviour where signing in with it granted operator.
    if (isOperatorEmail && existing.role !== "operator") {
      await db.update(users).set({ role: "operator" }).where(eq(users.id, existing.id));
    }
    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      role: isOperatorEmail ? "operator" : existing.role,
      mustChangePassword: existing.mustChangePassword,
    };
  }

  if (!isOperatorEmail) return null;

  // Bootstrap. Guarded on a non-empty env password so a deployment that forgot
  // to set one cannot be signed into with an empty field.
  const bootstrap = env.OPERATOR_PASSWORD;
  if (!bootstrap || password !== bootstrap) return null;

  const passwordHash = await hashPassword(password);
  const user = existing
    ? (await db.update(users)
        .set({ role: "operator", passwordHash })
        .where(eq(users.id, existing.id))
        .returning())[0]
    : (await db.insert(users)
        .values({ email, role: "operator", passwordHash })
        .returning())[0];

  return {
    id: user.id, email: user.email, name: user.name, role: "operator",
    mustChangePassword: user.mustChangePassword,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = loadEnv();
  const db = getDb();

  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    trustHost: true,
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers: [
      Resend({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }),
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const email = typeof credentials?.email === "string" ? credentials.email : undefined;
          const password = typeof credentials?.password === "string" ? credentials.password : undefined;
          if (!email || !password) return null;
          return authorizeCredentials(db, env, { email, password });
        },
      }),
    ],
    callbacks: {
      async signIn({ user, account }) {
        // The operator account must only be reachable via the Credentials
        // provider (env-checked email+password). Without this, anyone who
        // knows OPERATOR_EMAIL could request a Resend magic link for that
        // address and sign in as the operator without ever knowing the
        // password, because email delivery isn't a secret the operator controls
        // the same way a password is, so the magic-link path is treated as
        // a distinct, lower-trust channel that operator identity is barred
        // from.
        if (
          account?.provider === "resend" &&
          user.email?.toLowerCase() === env.OPERATOR_EMAIL.toLowerCase()
        ) {
          return false;
        }
        return true;
      },
      async jwt({ token, user, account }): Promise<JWT> {
        if (user?.id) {
          token.id = user.id;
          token.channel = account?.provider === "credentials" ? "password" : "link";

          // Read role and the must-change flag from the row rather than from
          // the `user` object. On the credentials path that object is ours and
          // carries both, but on the magic-link path it comes from the Drizzle
          // adapter, and whether the adapter forwards non-standard columns is
          // its business, not something to bet a security gate on. One extra
          // query per sign-in, not per request: `user` is only set at sign-in.
          const [row] = await db.select({
            role: users.role,
            mustChangePassword: users.mustChangePassword,
          }).from(users).where(eq(users.id, user.id));

          token.role = row?.role ?? "client";
          token.mustChangePassword = row?.mustChangePassword ?? false;
        }
        return token;
      },
      async session({ session, token }) {
        if (token.id) session.user.id = token.id;
        if (token.role) session.user.role = token.role;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
        session.user.channel = token.channel ?? "link";
        return session;
      },
    },
  };
});

/** Every admin page must call this first. 404s (rather than redirects) for non-operators. */
export async function requireOperator() {
  const session = await auth();
  if (!session || session.user.role !== "operator") notFound();
  return session.user;
}

/**
 * Every dashboard page must call this. Loads the practice by slug and
 * returns it if the caller is an operator or a member (via `practice_members`);
 * 404s otherwise, including when the slug doesn't resolve to a practice.
 */
export async function requirePracticeAccess(slug: string) {
  const session = await auth();
  if (!session) notFound();

  const db = getDb();
  const [practice] = await db.select().from(practices).where(eq(practices.slug, slug));
  if (!practice) notFound();

  // Operators never need a practice_members lookup (canAccessPractice
  // short-circuits `true` on role alone), so only clients pay for the query.
  const memberPracticeIds = session.user.role === "operator"
    ? []
    : (
        await db.select({ practiceId: practiceMembers.practiceId })
          .from(practiceMembers)
          .where(eq(practiceMembers.userId, session.user.id))
      ).map((m) => m.practiceId);

  if (!canAccessPractice({ role: session.user.role, memberPracticeIds }, practice.id)) notFound();

  return practice;
}
