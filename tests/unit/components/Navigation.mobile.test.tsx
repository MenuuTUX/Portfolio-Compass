import { afterEach, describe, expect, it, mock } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import Navigation from "@/components/Navigation";

function renderNav(overrides: Partial<React.ComponentProps<typeof Navigation>> = {}) {
  const props = {
    activeTab: "TRENDING" as const,
    onTabChange: mock(() => {}),
    onBackToLanding: mock(() => {}),
    onOpenSettings: mock(() => {}),
    ...overrides,
  };
  render(<Navigation {...props} />);
  const mobile = screen.getByRole("navigation", { name: "Primary mobile" });
  return { props, mobile };
}

describe("Navigation mobile bar", () => {
  afterEach(cleanup);

  it("links to the TFSA planner", () => {
    const { mobile } = renderNav();
    const tfsa = within(mobile).getByRole("link", { name: /tfsa/i });
    expect(tfsa.getAttribute("href")).toBe("/tfsa");
  });

  it("has a Home button that goes back to the landing page", () => {
    const { mobile, props } = renderNav();
    fireEvent.click(within(mobile).getByRole("button", { name: /home/i }));
    expect(props.onBackToLanding).toHaveBeenCalledTimes(1);
  });

  it("offers every destination the desktop bar offers", () => {
    const { mobile } = renderNav();
    const labels = within(mobile)
      .getAllByRole("button")
      .concat(within(mobile).getAllByRole("link"))
      .map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim());
    expect(labels.sort()).toEqual(
      ["Backtest", "ETFs", "Home", "Markets", "Portfolio", "Settings", "Stocks", "TFSA"].sort(),
    );
  });

  it("keeps every mobile destination at least 44px tall with a visible label", () => {
    const { mobile } = renderNav();
    const targets = within(mobile).getAllByRole("button").concat(within(mobile).getAllByRole("link"));
    expect(targets.length).toBe(8);
    for (const target of targets) {
      expect(target.className).toContain("min-h-[44px]");
      expect(target.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});
