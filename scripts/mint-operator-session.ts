/**
 * Prints a signed Auth.js session cookie for the operator, for driving a
 * headless browser against the local dev server. Local verification only.
 * Usage: npx tsx --env-file=.env.local scripts/mint-operator-session.ts
 */
import { eq } from "drizzle-orm";
import { encode } from "next-auth/jwt";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { loadEnv } from "@/lib/env";

async function main() {
  const env = loadEnv();
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.email, env.OPERATOR_EMAIL));
  if (!row) throw new Error("no operator row");
  const salt = "authjs.session-token";
  const jwt = await encode({
    secret: env.AUTH_SECRET, salt, maxAge: 3600,
    token: { sub: row.id, id: row.id, email: row.email, role: "operator", mustChangePassword: false, channel: "password" },
  });
  process.stdout.write(jwt);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
