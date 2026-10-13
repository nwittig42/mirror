import { describe, it, expect } from "vitest";
import { fetchLogo } from "@/services/logo";

const respond = (body: string | Uint8Array, type: string, status = 200) =>
  new Response(body as BodyInit, { status, headers: { "content-type": type } });

describe("fetchLogo", () => {
  it("returns the first candidate that is a real, small image", async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      if (url === "https://shop.example.com") return respond(`<link rel="apple-touch-icon" href="/missing.png"><link rel="icon" href="/icon.png">`, "text/html");
      if (url.endsWith("/missing.png")) return respond("<html>not found</html>", "text/html", 200);
      if (url.endsWith("/icon.png")) return respond(new Uint8Array([1, 2, 3]), "image/x-icon; charset=binary");
      return respond("", "text/plain", 404);
    }) as unknown as typeof fetch;
    expect(await fetchLogo("shop.example.com", fake)).toBe("data:image/x-icon;base64,AQID");
    expect(calls).toEqual(["https://shop.example.com", "https://shop.example.com/missing.png", "https://shop.example.com/icon.png"]);
  });
  it("skips an image too big to store and gives up with null", async () => {
    const fake = (async (url: string) =>
      url === "https://shop.example.com" ? respond("", "text/html") : respond(new Uint8Array(200_001), "image/x-icon")
    ) as unknown as typeof fetch;
    expect(await fetchLogo("https://shop.example.com", fake)).toBeNull();
  });
  it("shrinks a large bitmap to a small PNG", async () => {
    const { default: sharp } = await import("sharp");
    const big = await sharp({ create: { width: 1024, height: 512, channels: 3, background: "#a8763e" } }).jpeg().toBuffer();
    const fake = (async (url: string) =>
      url === "https://shop.example.com" ? respond(`<link rel="icon" href="/big.jpg">`, "text/html") : respond(new Uint8Array(big), "image/jpeg")
    ) as unknown as typeof fetch;
    const logo = await fetchLogo("https://shop.example.com", fake);
    expect(logo).toMatch(/^data:image\/png;base64,/);
    const meta = await sharp(Buffer.from(logo!.split(",")[1], "base64")).metadata();
    expect([meta.width, meta.height]).toEqual([192, 96]);
  });
  it("never requests a private address", async () => {
    let called = false;
    const fake = (async () => { called = true; return respond("", "text/html"); }) as unknown as typeof fetch;
    expect(await fetchLogo("http://localhost:3000", fake)).toBeNull();
    expect(await fetchLogo("http://192.168.1.4", fake)).toBeNull();
    expect(called).toBe(false);
  });
  it("still tries the fallback addresses when the homepage can't be read", async () => {
    const fake = (async (url: string) => {
      if (url === "https://shop.example.com") throw new TypeError("fetch failed");
      return url.endsWith("/favicon.ico") ? respond(new Uint8Array([9]), "image/x-icon") : respond("", "text/plain", 404);
    }) as unknown as typeof fetch;
    expect(await fetchLogo("https://shop.example.com", fake)).toBe("data:image/x-icon;base64,CQ==");
  });
});
