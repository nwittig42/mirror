import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../helpers/db";
import { setDbForTests, getDb } from "@/db";
import * as schema from "@/db/schema";
import { GET } from "@/app/api/audit/[id]/route";

const call = (id: string) => GET(new Request("http://x/api/audit/" + id), { params: Promise.resolve({ id }) });

describe("GET /api/audit/[id]", () => {
  beforeEach(async () => { setDbForTests(await makeTestDb()); });

  it("404s for an id that isn't a UUID", async () => {
    expect((await call("nope")).status).toBe(404);
  });

  it("404s for an unknown lead", async () => {
    expect((await call("00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });

  it("returns the progress, uncached", async () => {
    const [lead] = await getDb().insert(schema.leads).values({ websiteUrl: "https://glow.example" }).returning();
    const res = await call(lead.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ stage: "reading", percent: 5 });
  });
});
