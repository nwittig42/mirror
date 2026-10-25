import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import type { Db } from "@/db";
import { accountInvites, practiceMembers, practices, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { redeemInvite } from "@/services/account-invites";
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

  it("emails the prospect a set-up link, without making the login yet", async () => {
    const { db, practiceId } = await scanned();
    const sent: ReportEmail[] = [];
    await sendProspectReportFor(db, practiceId, { email: "dale@harbor.example", contactName: "Dale" },
      async email => { sent.push(email); }, async () => Buffer.from("%PDF-1"));

    expect(await db.select().from(users)).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("dale@harbor.example");
    expect(sent[0].attachments).toHaveLength(1);
    const token = /href="https:\/\/mirror\.example\/welcome\?token=([^"]+)"/.exec(sent[0].html)?.[1];
    expect(token).toBeTruthy();
    expect(sent[0].html).not.toContain("Temporary password");
    expect((await redeemInvite(db, token!, "a-long-enough-password", "operator@example.com")).ok).toBe(true);
  });

  it("sends someone who already has a password to log in, with no set-up link", async () => {
    const { db, practiceId } = await scanned();
    await db.insert(users).values({ email: "dale@harbor.example", role: "client", passwordHash: await hashPassword("their-own-password") });
    const sent: ReportEmail[] = [];
    await sendProspectReportFor(db, practiceId, { email: "dale@harbor.example", contactName: "Dale" },
      async email => { sent.push(email); }, async () => Buffer.from("%PDF-1"));
    expect(sent[0].html).toContain('href="https://mirror.example/login"');
    expect(sent[0].html).not.toContain("welcome?token");
    expect(await db.select().from(accountInvites)).toEqual([]);
    expect(await db.select().from(practiceMembers)).toHaveLength(1);
  });

  it("sends no set-up link to the operator's address, even before they have an account", async () => {
    const { db, practiceId } = await scanned();
    const sent: ReportEmail[] = [];
    await sendProspectReportFor(db, practiceId, { email: " Operator@Example.com ", contactName: "Nick" },
      async email => { sent.push(email); }, async () => Buffer.from("%PDF-1"));
    expect(sent[0].html).not.toContain("welcome?token");
    expect(await db.select().from(accountInvites)).toEqual([]);
  });

  it("finds a mixed-case account and links it instead of inviting again", async () => {
    const { db, practiceId } = await scanned();
    await db.insert(users).values({ email: "Dale@Harbor.example", role: "client", passwordHash: await hashPassword("their-own-password") });
    const sent: ReportEmail[] = [];
    await sendProspectReportFor(db, practiceId, { email: "dale@harbor.example", contactName: "Dale" },
      async email => { sent.push(email); }, async () => Buffer.from("%PDF-1"));
    expect(sent[0].html).not.toContain("welcome?token");
    expect(await db.select().from(accountInvites)).toEqual([]);
  });

  it("still sends the report, without a login, when the address is the operator's", async () => {
    const { db, practiceId } = await scanned();
    await db.insert(users).values({ email: "nick@mirror.example", role: "operator", passwordHash: "scrypt$x" });
    const sent: ReportEmail[] = [];
    await sendProspectReportFor(db, practiceId, { email: "nick@mirror.example", contactName: "Nick" },
      async email => { sent.push(email); }, async () => Buffer.from("%PDF-1"));
    expect(sent).toHaveLength(1);
    expect(sent[0].html).not.toContain("Your account");
  });
});
