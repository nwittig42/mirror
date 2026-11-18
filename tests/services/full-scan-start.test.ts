import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import type { Db } from "@/db";
import type { ScanResult } from "@/services/scan-runner";
import { completionFor } from "@/services/scan-completion";
import { claimFullScan, makeFullScanTrigger, quickLookFirst, startFullAudit } from "@/services/full-scan-start";

async function quickScanFor(db: Db, status: "complete" | "blocked" | "failed" = "complete") {
  const { practiceId } = await seedPractice(db, { name: "Proof Bakery" });
  const [lead] = await db.insert(schema.leads).values({
    practiceName: "Proof Bakery", websiteUrl: "https://proofbakery.com", practiceId, status: "preparing",
  }).returning();
  const [scan] = await db.insert(schema.scans).values({ practiceId, status, purpose: "quick" }).returning();
  return { practiceId, leadId: lead.id, scanId: scan.id };
}

const result = (scanId: string, blocked: boolean): ScanResult => ({
  scanId, score: blocked ? null : 60, newFindings: [], blocked,
  coverage: { asked: 20, answered: blocked ? 10 : 20, blocked, engines: [] } as unknown as ScanResult["coverage"],
});

const quietProspect = { notify: vi.fn().mockResolvedValue(undefined), sendAudit: vi.fn().mockResolvedValue(undefined) };

describe("what a quick scan's end sets off", () => {
  it("a complete quick scan starts the full audit", async () => {
    const db = await makeTestDb();
    const { practiceId, scanId } = await quickScanFor(db);
    const startFull = vi.fn().mockResolvedValue(undefined);
    await completionFor("quick", { startFull, prospect: quietProspect }).onComplete(db, scanId, result(scanId, false));
    expect(startFull).toHaveBeenCalledWith(practiceId);
  });

  it("a blocked quick scan starts the full audit too", async () => {
    const db = await makeTestDb();
    const { practiceId, leadId, scanId } = await quickScanFor(db, "blocked");
    const startFull = vi.fn().mockResolvedValue(undefined);
    await completionFor("quick", { startFull, prospect: quietProspect }).onComplete(db, scanId, result(scanId, true));
    expect(startFull).toHaveBeenCalledWith(practiceId);
    expect((await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)))[0].status).toBe("preparing");
  });

  it("a failed quick scan starts the full audit", async () => {
    const db = await makeTestDb();
    const { practiceId, leadId, scanId } = await quickScanFor(db, "failed");
    const startFull = vi.fn().mockResolvedValue(undefined);
    await completionFor("quick", { startFull, prospect: quietProspect }).onFailed(db, scanId, "it broke");
    expect(startFull).toHaveBeenCalledWith(practiceId);
    expect((await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)))[0].status).toBe("preparing");
  });

  it("marks the lead when the full audit can't be started", async () => {
    const db = await makeTestDb();
    const { leadId, scanId } = await quickScanFor(db);
    const startFull = vi.fn().mockRejectedValue(new Error("scan-start 500"));
    await completionFor("quick", { startFull, prospect: quietProspect }).onComplete(db, scanId, result(scanId, false));
    const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId));
    expect(lead.status).toBe("needs_attention");
    expect(lead.note).toContain("couldn't be started");
  });
});

describe("claimFullScan", () => {
  it("claims the full scan once", async () => {
    const db = await makeTestDb();
    const { practiceId } = await quickScanFor(db);
    const first = await claimFullScan(db, practiceId, 3);
    expect(first).toEqual(expect.any(String));
    const [row] = await db.select().from(schema.scans).where(eq(schema.scans.id, first!));
    expect(row).toMatchObject({ purpose: "prospect", runs: 3, status: "running", practiceId });
    expect(await claimFullScan(db, practiceId, 3)).toBeNull();
    expect((await db.select().from(schema.scans).where(eq(schema.scans.practiceId, practiceId)))
      .filter(s => s.purpose === "prospect")).toHaveLength(1);
  });
});

describe("makeFullScanTrigger", () => {
  it("calls the start route with the secret", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const trigger = makeFullScanTrigger({
      appUrl: "https://app.example/", cronSecret: "s3cret", bypassSecret: "byp",
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, headers: init.headers as Record<string, string> });
        return new Response(null, { status: 202 });
      }) as unknown as typeof fetch,
    });
    await trigger("practice-1");
    expect(calls[0].url).toBe("https://app.example/api/cron/scan-start?practice=practice-1");
    expect(calls[0].headers).toMatchObject({ authorization: "Bearer s3cret", "x-vercel-protection-bypass": "byp" });
  });

  it("throws on a refused request", async () => {
    const trigger = makeFullScanTrigger({
      appUrl: "https://app.example", cronSecret: "s",
      fetchImpl: (async () => new Response(null, { status: 401 })) as unknown as typeof fetch,
    });
    await expect(trigger("practice-1")).rejects.toThrow("scan-start 401");
  });
});

describe("quickLookFirst", () => {
  it("leaves the full audit to the quick look's own end when the quick look runs", async () => {
    const startFull = vi.fn().mockResolvedValue(undefined);
    expect(await quickLookFirst(async () => "scan-1", startFull)).toBe("started");
    expect(startFull).not.toHaveBeenCalled();
  });

  it("goes on to the full audit when the quick look throws, instead of failing the lead", async () => {
    const startFull = vi.fn().mockResolvedValue(undefined);
    expect(await quickLookFirst(async () => { throw new Error("database dropped"); }, startFull)).toBe("started");
    expect(startFull).toHaveBeenCalledTimes(1);
  });

  it("fails only when the full audit can't be started either", async () => {
    const startFull = vi.fn().mockRejectedValue(new Error("scan-start 500"));
    await expect(quickLookFirst(async () => { throw new Error("database dropped"); }, startFull)).rejects.toThrow("scan-start 500");
  });
});

describe("startFullAudit", () => {
  it("runs the first step of a newly claimed full scan", async () => {
    const db = await makeTestDb();
    const { practiceId } = await quickScanFor(db);
    const runFirstStep = vi.fn().mockResolvedValue(undefined);
    const onNotStarted = vi.fn().mockResolvedValue(undefined);
    await startFullAudit(db, practiceId, 3, { runFirstStep, onNotStarted });
    expect(runFirstStep).toHaveBeenCalledWith(expect.any(String));
    expect(onNotStarted).not.toHaveBeenCalled();
  });

  it("does nothing when the full scan was already claimed", async () => {
    const db = await makeTestDb();
    const { practiceId } = await quickScanFor(db);
    await claimFullScan(db, practiceId, 3);
    const runFirstStep = vi.fn();
    const onNotStarted = vi.fn();
    await startFullAudit(db, practiceId, 3, { runFirstStep, onNotStarted });
    expect(runFirstStep).not.toHaveBeenCalled();
    expect(onNotStarted).not.toHaveBeenCalled();
  });

  it("says so when the scan can't even be opened, so the lead isn't left waiting forever", async () => {
    const broken = { execute: async () => { throw new Error("connection refused"); } } as unknown as Db;
    const runFirstStep = vi.fn();
    const onNotStarted = vi.fn().mockResolvedValue(undefined);
    await startFullAudit(broken, "b59028e6-932d-49a2-b4b6-a9af5c5bb6ef", 3, { runFirstStep, onNotStarted });
    expect(runFirstStep).not.toHaveBeenCalled();
    expect(onNotStarted).toHaveBeenCalledWith(expect.stringContaining("connection refused"));
  });

  it("leaves a first step that throws to the scan's own failure handling", async () => {
    const db = await makeTestDb();
    const { practiceId } = await quickScanFor(db);
    const onNotStarted = vi.fn();
    await startFullAudit(db, practiceId, 3, { runFirstStep: async () => { throw new Error("step broke"); }, onNotStarted });
    expect(onNotStarted).not.toHaveBeenCalled();
  });
});
