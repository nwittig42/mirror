/**
 * Escapes the five HTML-significant characters. Every dynamic string
 * interpolated into an outbound HTML email MUST pass through this.
 *
 * Two call sites, both handling untrusted input: the weekly Pulse
 * (`src/services/pulse-email.ts`), whose quotes are raw third-party LLM
 * output, and the audit-request notification
 * (`src/services/audit-request.ts`), whose every field is typed by an
 * anonymous visitor. Either can contain arbitrary markup, including script
 * tags, unless neutralized here.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
