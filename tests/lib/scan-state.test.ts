import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { scanNotice, noticeText } from "@/lib/scan-state";

let db: Db;
let practiceId: string;
beforeEach(async () => {
  db = await makeTestDb();
  ({ practiceId } = await seedPractice(db, { name: "Proof Bakery" }));
});

const ago = (ms: number) => new Date(Date.now() - ms);
const scan = (values: Partial<typeof schema.scans.$inferInsert>) =>
  db.insert(schema.scans).values({ practiceId, ...values });
const lead = (status: "preparing" | "ready" | "needs_attention") =>
  db.insert(schema.leads).values({ websiteUrl: "https://proofbakery.com", practiceId, status });

describe("scanNotice", () => {
  it("says the full audit is running behind a quick look", async () => {
    await scan({ purpose: "quick", status: "complete", startedAt: ago(60_000) });
    await scan({ purpose: "prospect", status: "running", startedAt: ago(5_000) });
    expect(await scanNotice(db, practiceId)).toBe("quick-full-running");
  });

  it("says so too in the moment before the full audit's scan exists", async () => {
    await lead("preparing");
    await scan({ purpose: "quick", status: "complete" });
    expect(await scanNotice(db, practiceId)).toBe("quick-full-running");
  });

  it("says the full audit is being finished by hand when it failed or was blocked", async () => {
    await scan({ purpose: "quick", status: "complete", startedAt: ago(60_000) });
    await scan({ purpose: "prospect", status: "blocked", startedAt: ago(5_000) });
    expect(await scanNotice(db, practiceId)).toBe("quick-full-failed");
  });

  it("says by hand when the full audit could not even be started", async () => {
    await lead("needs_attention");
    await scan({ purpose: "quick", status: "complete" });
    expect(await scanNotice(db, practiceId)).toBe("quick-full-failed");
  });

  it("stops promising a full audit that never started", async () => {
    await lead("preparing");
    await scan({ purpose: "quick", status: "complete", startedAt: ago(30 * 60_000), finishedAt: ago(29 * 60_000) });
    expect(await scanNotice(db, practiceId)).toBe("quick-full-failed");
  });

  it("says the first scan is running when nothing is complete yet", async () => {
    await lead("preparing");
    await scan({ purpose: "quick", status: "running" });
    expect(await scanNotice(db, practiceId)).toBe("first-running");
  });

  it("says something went wrong when nothing completed and the lead needs a look", async () => {
    await lead("needs_attention");
    await scan({ purpose: "quick", status: "blocked", startedAt: ago(60_000) });
    await scan({ purpose: "prospect", status: "failed", startedAt: ago(5_000) });
    expect(await scanNotice(db, practiceId)).toBe("first-failed");
  });

  it("says nothing once a full scan is showing", async () => {
    await scan({ purpose: "quick", status: "complete", startedAt: ago(60_000) });
    await scan({ purpose: "prospect", status: "complete", startedAt: ago(5_000) });
    expect(await scanNotice(db, practiceId)).toBeNull();
  });

  it("says nothing for an ordinary business between weekly scans", async () => {
    await scan({ purpose: "weekly", status: "complete", startedAt: ago(60_000) });
    await scan({ purpose: "weekly", status: "running", startedAt: ago(5_000) });
    expect(await scanNotice(db, practiceId)).toBeNull();
  });
});

describe("noticeText", () => {
  it("names the quick look's own tools", () => {
    expect(noticeText("quick-full-running", "ChatGPT and Claude")).toBe(
      "This is a quick look from ChatGPT and Claude. Your full audit across every AI tool is running and will replace it in a few minutes.",
    );
    expect(noticeText("quick-full-failed", "Claude")).toBe(
      "This is a quick look from Claude. We're finishing your full audit by hand and will email you.",
    );
    expect(noticeText("first-failed", "ChatGPT and Claude")).toBe(
      "Something went wrong on our side. We'll finish your audit by hand and email it to you.",
    );
    expect(noticeText("first-running", "ChatGPT and Claude")).toBe(
      "Your first scan is running. Your scores fill in here when it finishes.",
    );
  });
});
