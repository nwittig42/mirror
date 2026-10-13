/** The four tabs of the business page, chosen by `?tab=`. Setup is the default and has no param. */
export const BUSINESS_TABS = [
  { key: "setup", label: "Setup" },
  { key: "scans", label: "Scans" },
  { key: "work", label: "Work" },
  { key: "access", label: "Access" },
] as const;

export type BusinessTab = (typeof BUSINESS_TABS)[number]["key"];

/** A link to one tab of a business page, optionally with query values and a `#section`. */
export function businessHref(practiceId: string, tab: BusinessTab = "setup", extra: Record<string, string> = {}, hash = ""): string {
  const query = new URLSearchParams({ ...(tab === "setup" ? {} : { tab }), ...extra }).toString();
  return `/admin/practices/${practiceId}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}
