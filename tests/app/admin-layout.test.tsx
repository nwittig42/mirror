import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTestDb } from "../helpers/db";
import { setDbForTests } from "@/db";

const session = { user: { id: "u1", role: "client", email: "c@example.com" } };
vi.mock("@/lib/auth", async () => {
  const { notFound } = await import("next/navigation");
  return {
    requireOperator: vi.fn(async () => {
      if (session.user.role !== "operator") notFound();
      return session.user;
    }),
  };
});

import AdminLayout from "@/app/admin/layout";

describe("admin layout", () => {
  beforeEach(async () => setDbForTests(await makeTestDb()));

  it("is a not-found page for a customer, before anything renders", async () => {
    session.user.role = "client";
    await expect(AdminLayout({ children: <p>secret</p> })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("renders the top bar and the page for an operator", async () => {
    session.user.role = "operator";
    expect(await AdminLayout({ children: <p>page</p> })).toBeTruthy();
  });
});
