import { afterEach, describe, expect, it, mock } from "bun:test";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import MessageDrawer from "@/components/MessageDrawer";

describe("MessageDrawer layering and scrolling", () => {
  afterEach(cleanup);

  it("sits above the tab bar, under the sheet, and does not pass scroll to the page", () => {
    render(
      <MessageDrawer isOpen onClose={mock(() => {})} title="Heads up" message="Something happened" />,
    );

    const dialog = screen.getByRole("dialog");
    const scrim = document.querySelector("div.fixed.inset-0") as HTMLElement;

    // Tab bar is z-40, scrim z-50, sheet z-[60].
    expect(scrim.className).toContain("z-50");
    expect(dialog.className).toContain("z-[60]");
    expect(dialog.className).toContain("overscroll-contain");
    expect(dialog.className).toContain("app-sheet-safe");
  });
});
