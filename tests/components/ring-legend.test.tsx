import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RingLegend } from "@/components/ui";

describe("the key beside the score rings", () => {
  const html = renderToStaticMarkup(
    <RingLegend rings={[
      { key: "overall", label: "Overall", value: 8 },
      { key: "visibility", label: "Recommended by AI", value: 11, href: "/dashboard/harbor/competitors" },
      { key: "facts", label: "Accuracy", value: null, href: "/dashboard/harbor/fixes" },
    ]} />,
  );

  it("links a score to its page when it has one", () => {
    expect(html).toMatch(/<a[^>]*href="\/dashboard\/harbor\/competitors"[^>]*>.*Recommended by AI/);
    expect(html).toMatch(/<a[^>]*href="\/dashboard\/harbor\/fixes"[^>]*>.*Accuracy/);
  });
  it("leaves a score with no page as plain text", () => {
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain("Overall");
  });
  it("still shows N/A for a missing score inside a link", () => {
    expect(html).toContain("N/A");
  });
});
