import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { loadEnv } from "@/lib/env";
import * as schema from "@/db/schema";

// `Db` is typed against `PgDatabase<PgQueryResultHKT, typeof schema>`, the
// shared base class both `NeonHttpDatabase` (drizzle-orm/neon-http) and
// `PgliteDatabase` (drizzle-orm/pglite) extend. A concrete
// `ReturnType<typeof drizzle<typeof schema>>` from either driver is a
// *narrower* type (fixes the query-result HKT to that driver's own), so it
// is NOT assignable to the other driver's concrete type. Typing `Db` off
// the shared base class is what lets `setDbForTests` accept a real Neon
// client in production and a PGlite client in tests without a cast.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let override: Db | undefined;

export function setDbForTests(db: Db): void {
  override = db;
}

export function getDb(): Db {
  if (override) return override;
  const env = loadEnv();
  return drizzle(env.DATABASE_URL, { schema });
}
