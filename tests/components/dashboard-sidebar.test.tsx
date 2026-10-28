import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let pathname = "/dashboard/harbor";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { DashboardSidebar, nextPlan } = await import("@/components/dashboard-sidebar");

/**
 * The sidebar groups the dashboard's pages under "What AI says" and "Next
 * steps", then Reports and Pricing, and ends with a button to the next plan up.
 */
describe("DashboardSidebar", () => {
  beforeEach(() => { pathname = "/dashboard/harbor"; });

  it("shows the business at the top, both groups, and Reports and Pricing", () => {
    const html = renderToStaticMarkup(<DashboardSidebar slug="harbor" practiceName="Harbor Plumbing" plan={null} />);
    for (const text of ["Harbor Plumbing", "Resources", "Sign out", "What AI says", "Next steps", ">Overview<", ">Answers<", ">Competitors<", ">Your plan<", ">Forecast<", ">Reports<", ">Pricing<"]) {
      expect(html).toContain(text);
    }
  });

  it("marks the page you are on, and an older page under its new link", () => {
    pathname = "/dashboard/harbor/fixes";
    expect(renderToStaticMarkup(<DashboardSidebar slug="harbor" practiceName="Harbor Plumbing" plan={null} />))
      .toMatch(/aria-current="page"[^>]*href="\/dashboard\/harbor\/fixes">(?:(?!<\/a>).)*Your plan</);
    pathname = "/dashboard/harbor/accuracy";
    const html = renderToStaticMarkup(<DashboardSidebar slug="harbor" practiceName="Harbor Plumbing" plan={null} />);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/dashboard\/harbor\/answers"/);
    expect(html).not.toMatch(/aria-current="page"[^>]*href="\/dashboard\/harbor"/);
  });

  it("offers the next plan up, and nothing on the top plan", () => {
    expect(nextPlan(null)).toBe("pulse");
    expect(nextPlan("pulse")).toBe("partner");
    expect(nextPlan("partner")).toBeNull();
    expect(renderToStaticMarkup(<DashboardSidebar slug="harbor" practiceName="Harbor Plumbing" plan={null} />)).toContain("Upgrade to Pulse");
    expect(renderToStaticMarkup(<DashboardSidebar slug="harbor" practiceName="Harbor Plumbing" plan="pulse" />)).toContain("Upgrade to Partner");
    expect(renderToStaticMarkup(<DashboardSidebar slug="harbor" practiceName="Harbor Plumbing" plan="partner" />)).not.toContain("Upgrade to");
  });
});
