import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { accounts, practiceMembers, practices, sessions, users, verificationTokens } from "@/db/schema";
import { loadEnv } from "@/lib/env";

export type Role = "operator" | "client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
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
          if (email !== env.OPERATOR_EMAIL || password !== env.OPERATOR_PASSWORD) return null;

          const [existing] = await db.select().from(users).where(eq(users.email, email));
          const user = existing ?? (await db.insert(users).values({ email, role: "operator" }).returning())[0];
          if (user.role !== "operator") {
            await db.update(users).set({ role: "operator" }).where(eq(users.id, user.id));
          }

          return { id: user.id, email: user.email, name: user.name, role: "operator" satisfies Role };
        },
      }),
    ],
    callbacks: {
      async signIn({ user, account }) {
        // The operator account must only be reachable via the Credentials
        // provider (env-checked email+password). Without this, anyone who
        // knows OPERATOR_EMAIL could request a Resend magic link for that
        // address and sign in as the operator without ever knowing the
        // password — email delivery isn't a secret the operator controls
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
      async jwt({ token, user }): Promise<JWT> {
        if (user) {
          token.id = user.id;
          const role = (user as { role?: Role }).role;
          token.role = role ?? "client";
        }
        return token;
      },
      async session({ session, token }) {
        if (token.id) session.user.id = token.id;
        if (token.role) session.user.role = token.role;
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

  if (session.user.role === "operator") return practice;

  const [membership] = await db
    .select()
    .from(practiceMembers)
    .where(and(eq(practiceMembers.userId, session.user.id), eq(practiceMembers.practiceId, practice.id)));
  if (!membership) notFound();

  return practice;
}
