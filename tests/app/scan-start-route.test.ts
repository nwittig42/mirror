import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/env", () => ({ loadEnv: () => ({ CRON_SECRET: "s3cret", SCAN_RUNS: 3, APP_URL: "http://localhost:3000" }) }));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("@/db", () => ({ getDb: () => { throw new Error("the database must not be reached"); } }));

import { GET } from "@/app/api/cron/scan-start/route";

describe("GET /api/cron/scan-start", () => {
  it("refuses a request without the secret", async () => {
    const res = await GET(new Request("http://localhost/api/cron/scan-start?practice=b59028e6-932d-49a2-b4b6-a9af5c5bb6ef"));
    expect(res.status).toBe(401);
  });

  it("refuses a wrong secret", async () => {
    const res = await GET(new Request("http://localhost/api/cron/scan-start?practice=b59028e6-932d-49a2-b4b6-a9af5c5bb6ef", {
      headers: { authorization: "Bearer nope" },
    }));
    expect(res.status).toBe(401);
  });

  it("refuses a practice id that isn't one", async () => {
    const res = await GET(new Request("http://localhost/api/cron/scan-start?practice=1%20or%201", {
      headers: { authorization: "Bearer s3cret" },
    }));
    expect(res.status).toBe(400);
  });
});
