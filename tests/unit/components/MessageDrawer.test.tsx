import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MessageDrawer from "@/components/MessageDrawer";

describe("MessageDrawer", () => {
  afterEach(cleanup);

  it("is a labelled modal dialog that shows its message", () => {
    render(<MessageDrawer isOpen onClose={() => {}} title="Heads up" message="Something happened" />);

    const dialog = screen.getByRole("dialog", { name: "Heads up" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("Something happened");
  });

  it("moves focus into the dialog and closes on Escape and the close button", async () => {
    let closed = 0;
    render(
      <MessageDrawer isOpen onClose={() => { closed += 1; }} title="Heads up" message="Something happened" />,
    );
    const dialog = screen.getByRole("dialog");

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(closed).toBe(2);
  });

  it("renders nothing while closed", () => {
    render(<MessageDrawer isOpen={false} onClose={() => {}} title="Heads up" message="Something happened" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
