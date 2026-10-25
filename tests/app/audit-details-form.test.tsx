import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/audit/actions", () => ({ submitDetails: vi.fn() }));

// A static render runs no effects and never submits, so the form's state is
// pinned to "details saved" and effects run as the render goes by.
let status: "idle" | "success" = "success";
vi.mock("react", async importOriginal => {
  const real = await importOriginal<typeof import("react")>();
  return {
    ...real,
    default: real,
    useActionState: () => [{ status, email: "kim@glow.example" }, vi.fn(), false],
    useEffect: (fn: () => void) => { fn(); },
  };
});

import { DetailsForm } from "@/app/audit/[id]/details-form";

const render = () => renderToStaticMarkup(
  <DetailsForm leadId="l1" prefill={{ practiceName: "Glow", category: "", location: "" }} />,
);

describe("DetailsForm", () => {
  beforeEach(() => { refresh.mockReset(); status = "success"; });

  it("refreshes the page once the details are saved, so the page knows the email", () => {
    const markup = render();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(markup).toContain("kim@glow.example");
  });

  it("does not refresh before anything is submitted", () => {
    status = "idle";
    render();
    expect(refresh).not.toHaveBeenCalled();
  });
});
