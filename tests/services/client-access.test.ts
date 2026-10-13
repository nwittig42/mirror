import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import type { Db } from "@/db";
import { practiceMembers, practices, users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { grantClientLogin, OperatorAddressError } from "@/services/client-access";
import { runScan } from "@/services/scan-runner";
import { sendProspectReportFor, type ReportEmail } from "@/services/prospect-audit-email";

describe("grantClientLogin", () => {
  let db: Db;
  let practiceId: string;
  beforeEach(async () => {
    db = await makeTestDb();
    ({ practiceId } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor" }));
  });

  it("creates a client who must change the temporary password, linked to the business", async () => {
    const login = await grantClientLogin(db, practiceId, "  Dale@Harbor.example ");
    expect(login.email).toBe("dale@harbor.example");
    const [user] = await db.select().from(users).where(eq(users.email, "dale@harbor.example"));
    expect(user).toMatchObject({ role: "client", mustChangePassword: true });
    expect(await verifyPassword(login.password!, user.passwordHash)).toBe(true);
    expect(await db.select().from(practiceMembers)).toEqual([{ userId: user.id, practiceId }]);
  });

  it("replaces an existing password unless told to keep it", async () => {
    const first = await grantClientLogin(db, practiceId, "dale@harbor.example");
    const kept = await grantClientLogin(db, practiceId, "dale@harbor.example", { keepExisting: true });
    expect(kept.password).toBeNull();
    const [user] = await db.select().from(users);
    expect(await verifyPassword(first.password!, user.passwordHash)).toBe(true);

    const reissued = await grantClientLogin(db, practiceId, "dale@harbor.example");
    const [after] = await db.select().from(users);
    expect(await verifyPassword(reissued.password!, after.passwordHash)).toBe(true);
    expect(await verifyPassword(first.password!, after.passwordHash)).toBe(false);
  });

  it("links someone who keeps their password to a second business", async () => {
    await grantClientLogin(db, practiceId, "dale@harbor.example");
    const { practiceId: second } = await seedPractice(db, { name: "Harbor Heating", slug: "harbor-heating" });
    await grantClientLogin(db, second, "dale@harbor.example", { keepExisting: true });
    expect((await db.select().from(practiceMembers)).map(m => m.practiceId).sort()).toEqual([practiceId, second].sort());
  });

  it("never touches the operator's account", async () => {
    await db.insert(users).values({ email: "nick@mirror.example", role: "operator", passwordHash: "scrypt$x" });
    await expect(grantClientLogin(db, practiceId, "nick@mirror.example")).rejects.toBeInstanceOf(OperatorAddressError);
    const [operator] = await db.select().from(users);
    expect(operator).toMatchObject({ passwordHash: "scrypt$x", mustChangePassword: false });
    expect(await db.select().from(practiceMembers)).toEqual([]);
  });
});

describe("sendProspectReportFor", () => {
  for (const env of ["DATABASE_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "PERPLEXITY_API_KEY", "RESEND_API_KEY", "CRON_SECRET", "AUTH_SECRET"]) process.env[env] ||= "k";
  process.env.APP_URL = "https://mirror.example";

  async function scanned() {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", slug: "harbor", category: "Plumber", location: "Portland, OR",
      prompts: [{ text: "Best plumber in Portland", kind: "category" }],
    });
    await db.update(practices).set({ active: false });
    await runScan(db, practiceId, [{ name: "openai", run: async () => ({ answer: "Rose City Plumbing is great.", citations: [] }) }],
      async () => ({ wrong: [], right: [] }), async () => ["Rose City Plumbing"]);
    return { db, practiceId };
  }

  it("makes the prospect a login and emails it with their summary", async () => {
    const { db, practiceId } = await scanned();
    const sent: ReportEmail[] = [];
    await sendProspectReportFor(db, practiceId, { email: "dale@harbor.example", contactName: "Dale" },
      async email => { sent.push(email); }, async () => Buffer.from("%PDF-1"));

    const [user] = await db.select().from(users);
    expect(user).toMatchObject({ email: "dale@harbor.example", role: "client", mustChangePassword: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("dale@harbor.example");
    expect(sent[0].attachments).toHaveLength(1);
    expect(sent[0].html).toContain('href="https://mirror.example/login"');
    const password = /Temporary password: <strong[^>]*>([^<]+)</.exec(sent[0].html)?.[1];
    expect(await verifyPassword(password!, user.passwordHash)).toBe(true);
  });

  it("still sends the report, without a login, when the address is the operator's", async () => {
    const { db, practiceId } = await scanned();
    await db.insert(users).values({ email: "nick@mirror.example", role: "operator", passwordHash: "scrypt$x" });
    const sent: ReportEmail[] = [];
    await sendProspectReportFor(db, practiceId, { email: "nick@mirror.example", contactName: "Nick" },
      async email => { sent.push(email); }, async () => Buffer.from("%PDF-1"));
    expect(sent).toHaveLength(1);
    expect(sent[0].html).not.toContain("Your dashboard is ready");
  });
});
