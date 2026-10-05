import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import {
  composeSupportNotice, createSupportRequest, setSupportStatus, supportRequestSchema, type SupportEmailArgs,
} from "@/services/support";

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://x";
  process.env.OPENAI_API_KEY = "k";
  process.env.ANTHROPIC_API_KEY = "k";
  process.env.GEMINI_API_KEY = "k";
  process.env.PERPLEXITY_API_KEY = "k";
  process.env.RESEND_API_KEY = "k";
  process.env.CRON_SECRET = "s";
  process.env.AUTH_SECRET = "s";
  process.env.APP_URL = "http://localhost:3000";
  process.env.EMAIL_FROM = "mirror@example.com";
  process.env.SUPPORT_EMAIL = "help@mirror.example";
});

describe("supportRequestSchema", () => {
  it("requires a known topic and a real message", () => {
    expect(supportRequestSchema.safeParse({ topic: "score", message: "Why did my score drop this week?" }).success).toBe(true);
    expect(supportRequestSchema.safeParse({ topic: "vibes", message: "Why did my score drop?" }).success).toBe(false);
    expect(supportRequestSchema.safeParse({ topic: "score", message: "why" }).success).toBe(false);
  });
});

describe("composeSupportNotice", () => {
  it("escapes the client's message", () => {
    const { html } = composeSupportNotice({
      practiceName: "Glow", email: "a@b.c", topic: "other", message: "<script>x</script>", adminUrl: "http://x/admin",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("createSupportRequest", () => {
  it("stores the request and emails the inbox and the client", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const sent: SupportEmailArgs[] = [];
    const id = await createSupportRequest(db, {
      practiceId, userId: null, email: "kim@glow.example", topic: "score", message: "Why did my score drop?",
    }, async args => { sent.push(args); });

    const [row] = await db.query.supportRequests.findMany();
    expect(row).toMatchObject({ id, status: "open", topic: "score", email: "kim@glow.example" });
    expect(sent.map(s => s.to[0]).sort()).toEqual(["help@mirror.example", "kim@glow.example"]);
    const notice = sent.find(s => s.to[0] === "help@mirror.example")!;
    expect(notice.replyTo).toBe("kim@glow.example");
    expect(notice.subject).toContain("Glow MedSpa");
  });

  it("keeps the request when email fails, and notes it internally", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    await createSupportRequest(db, {
      practiceId, userId: null, email: "kim@glow.example", topic: "other", message: "Hello there, a question.",
    }, async () => { throw new Error("resend down"); });

    expect(await db.query.supportRequests.findMany()).toHaveLength(1);
    const activities = await db.query.activities.findMany();
    expect(activities[0]).toMatchObject({ visibility: "internal" });
    expect(activities[0].description).toMatch(/support email failed/);
  });

  it("closes and reopens", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const id = await createSupportRequest(db, {
      practiceId, userId: null, email: "a@b.c", topic: "other", message: "Hello there, a question.",
    }, async () => {});
    await setSupportStatus(db, id, "closed");
    let [row] = await db.query.supportRequests.findMany();
    expect(row.status).toBe("closed");
    expect(row.closedAt).not.toBeNull();
    await setSupportStatus(db, id, "open");
    [row] = await db.query.supportRequests.findMany();
    expect(row).toMatchObject({ status: "open", closedAt: null });
  });
});
