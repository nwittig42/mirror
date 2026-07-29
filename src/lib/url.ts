/**
 * True only for absolute http:/https: URLs. Used to gate which citation
 * URLs (verbatim third-party engine output, i.e. untrusted input) are
 * rendered as clickable `<a href>` links — a `javascript:` or other
 * non-http(s) scheme would otherwise execute on click.
 */
export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
