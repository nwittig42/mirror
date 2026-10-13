import { isSafeHttpUrl } from "@/lib/url";
import { logoCandidates } from "@/core/logo";

const TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 1_500_000;
/** A logo is stored in the practice's row, so it has to stay small. */
const MAX_LOGO_BYTES = 200_000;
/** Sites often publish their icon far larger than needed; up to this size it is downloaded and shrunk. */
const MAX_DOWNLOAD_BYTES = 5_000_000;
/** Twice the largest size the logo is drawn at, so it stays sharp on dense screens. */
const LOGO_PX = 192;
const BITMAP_TYPE = /^image\/(png|jpeg|gif|webp)$/i;
const MAX_TRIES = 6;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i;
const IMAGE_TYPE = /^image\/(png|jpeg|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)$/i;

type Fetch = typeof fetch;

const isPublic = (url: string) => isSafeHttpUrl(url) && !PRIVATE_HOST.test(new URL(url).hostname);

/**
 * A bitmap shrunk to fit `LOGO_PX` square, as PNG. Null when it can't be
 * done: the image is damaged, or the resizer (sharp, which ships with Next)
 * isn't installed. The caller then keeps the original if it is small enough.
 */
async function shrink(bytes: Buffer): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import("sharp");
    return await sharp(bytes).resize(LOGO_PX, LOGO_PX, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  } catch {
    return null;
  }
}

const request = (url: string, fetchImpl: Fetch) => fetchImpl(url, {
  headers: { "user-agent": "MirrorSiteCheck/1.0 (+AI readiness check)" },
  redirect: "follow",
  signal: AbortSignal.timeout(TIMEOUT_MS),
});

/**
 * The business's logo from its own website, as a `data:` address ready for an
 * `<img>`, or null when the site has none we can use. Stored instead of
 * linked so the dashboard never depends on the customer's site staying up,
 * and a customer's browser never calls a third party to draw the page.
 * Free: it is just our own requests to their public site.
 */
export async function fetchLogo(website: string, fetchImpl: Fetch = fetch): Promise<string | null> {
  const home = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  if (!isPublic(home)) return null;

  let html = "";
  let pageUrl = home;
  try {
    const res = await request(home, fetchImpl);
    if (res.ok) {
      html = (await res.text()).slice(0, MAX_HTML_BYTES);
      if (res.url && isPublic(res.url)) pageUrl = res.url;
    }
  } catch {
    // An unreadable homepage still leaves the two fallback addresses to try.
  }

  for (const url of logoCandidates(html, pageUrl).filter(isPublic).slice(0, MAX_TRIES)) {
    try {
      const res = await request(url, fetchImpl);
      if (!res.ok) continue;
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!IMAGE_TYPE.test(type)) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_DOWNLOAD_BYTES) continue;
      const small = BITMAP_TYPE.test(type) ? await shrink(bytes) : null;
      if (small) return `data:image/png;base64,${small.toString("base64")}`;
      if (bytes.length > MAX_LOGO_BYTES) continue;
      return `data:${type};base64,${bytes.toString("base64")}`;
    } catch {
      continue;
    }
  }
  return null;
}
