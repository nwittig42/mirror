import { describe, it, expect } from "vitest";
import { isSafeHttpUrl } from "@/lib/url";

describe("isSafeHttpUrl", () => {
  it("accepts https URLs", () => expect(isSafeHttpUrl("https://example.com/a")).toBe(true));
  it("accepts http URLs", () => expect(isSafeHttpUrl("http://example.com/a")).toBe(true));
  it("rejects javascript: URLs", () => expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false));
  it("rejects garbage strings", () => expect(isSafeHttpUrl("not a url")).toBe(false));
});
