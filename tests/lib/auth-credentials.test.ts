import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "../helpers/db";
import * as schema from "@/db/schema";
import { authorizeCredentials } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { Db } from "@/db";

const env = { OPERATOR_EMAIL: "operator@mirror.test", OPERATOR_PASSWORD: "bootstrap-secret" };

async function seedClient(db: Db, over: Partial<typeof schema.users.$inferInsert> = {}) {
  const [user] = await db.insert(schema.users)
    .values({ email: "client@practice.test", role: "client", ...over })
    .returning();
  return user;
}

describe("authorizeCredentials", () => {
  describe("clients", () => {
    it("signs in a client whose stored hash matches", async () => {
      const db = await makeTestDb();
      const user = await seedClient(db, { passwordHash: await hashPassword("temp-pass-1234") });

      const result = await authorizeCredentials(db, env, {
        email: "client@practice.test", password: "temp-pass-1234",
      });

      expect(result).toMatchObject({ id: user.id, email: "client@practice.test", role: "client" });
    });

    it("rejects a wrong password", async () => {
      const db = await makeTestDb();
      await seedClient(db, { passwordHash: await hashPassword("temp-pass-1234") });

      expect(await authorizeCredentials(db, env, {
        email: "client@practice.test", password: "temp-pass-9999",
      })).toBeNull();
    });

    it("rejects a client who has no password at all, rather than letting any password through", async () => {
      const db = await makeTestDb();
      await seedClient(db, { passwordHash: null });

      expect(await authorizeCredentials(db, env, {
        email: "client@practice.test", password: "anything",
      })).toBeNull();
      expect(await authorizeCredentials(db, env, {
        email: "client@practice.test", password: "",
      })).toBeNull();
    });

    it("rejects an unknown email", async () => {
      const db = await makeTestDb();
      expect(await authorizeCredentials(db, env, {
        email: "nobody@practice.test", password: "temp-pass-1234",
      })).toBeNull();
    });

    it("matches the email case-insensitively and ignores surrounding whitespace", async () => {
      const db = await makeTestDb();
      await seedClient(db, { passwordHash: await hashPassword("temp-pass-1234") });

      expect(await authorizeCredentials(db, env, {
        email: "  Client@Practice.Test ", password: "temp-pass-1234",
      })).toMatchObject({ role: "client" });
    });

    it("reports that a temp password must be changed", async () => {
      const db = await makeTestDb();
      await seedClient(db, {
        passwordHash: await hashPassword("temp-pass-1234"), mustChangePassword: true,
      });

      const result = await authorizeCredentials(db, env, {
        email: "client@practice.test", password: "temp-pass-1234",
      });

      expect(result?.mustChangePassword).toBe(true);
    });

    it("never promotes a client to operator, whatever their row says", async () => {
      const db = await makeTestDb();
      await seedClient(db, { passwordHash: await hashPassword("temp-pass-1234") });

      const result = await authorizeCredentials(db, env, {
        email: "client@practice.test", password: "temp-pass-1234",
      });

      expect(result?.role).toBe("client");
    });
  });

  describe("operator bootstrap", () => {
    it("creates the operator on first sign-in and seeds a hash from OPERATOR_PASSWORD", async () => {
      const db = await makeTestDb();

      const result = await authorizeCredentials(db, env, {
        email: "operator@mirror.test", password: "bootstrap-secret",
      });

      expect(result).toMatchObject({ email: "operator@mirror.test", role: "operator" });
      const [row] = await db.select().from(schema.users)
        .where(eq(schema.users.email, "operator@mirror.test"));
      expect(row.passwordHash).not.toBeNull();
      expect(row.passwordHash).not.toContain("bootstrap-secret");
      expect(await verifyPassword("bootstrap-secret", row.passwordHash)).toBe(true);
    });

    it("rejects the wrong bootstrap password without creating a user", async () => {
      const db = await makeTestDb();

      expect(await authorizeCredentials(db, env, {
        email: "operator@mirror.test", password: "guess",
      })).toBeNull();
      expect(await db.select().from(schema.users)).toHaveLength(0);
    });

    it("upgrades an existing client row to operator when it is the operator email", async () => {
      const db = await makeTestDb();
      await seedClient(db, { email: "operator@mirror.test", role: "client" });

      const result = await authorizeCredentials(db, env, {
        email: "operator@mirror.test", password: "bootstrap-secret",
      });

      expect(result?.role).toBe("operator");
      const [row] = await db.select().from(schema.users)
        .where(eq(schema.users.email, "operator@mirror.test"));
      expect(row.role).toBe("operator");
    });

    it("stops honouring OPERATOR_PASSWORD once the operator has a hash of their own", async () => {
      // The whole point of the bootstrap: after the operator changes their
      // password in-app, the env var is inert. If this ever passes with the
      // env value, a leaked or stale OPERATOR_PASSWORD is still a live key.
      const db = await makeTestDb();
      await seedClient(db, {
        email: "operator@mirror.test", role: "operator",
        passwordHash: await hashPassword("chosen-in-app"),
      });

      expect(await authorizeCredentials(db, env, {
        email: "operator@mirror.test", password: "bootstrap-secret",
      })).toBeNull();
      expect(await authorizeCredentials(db, env, {
        email: "operator@mirror.test", password: "chosen-in-app",
      })).toMatchObject({ role: "operator" });
    });

    it("does not bootstrap when the operator password is blank", async () => {
      const db = await makeTestDb();

      expect(await authorizeCredentials(db, { ...env, OPERATOR_PASSWORD: "" }, {
        email: "operator@mirror.test", password: "",
      })).toBeNull();
      expect(await db.select().from(schema.users)).toHaveLength(0);
    });
  });
});
