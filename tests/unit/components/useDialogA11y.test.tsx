import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useDialogA11y } from "@/hooks/useDialogA11y";

// The arrow below is a new function on every render, as real callers pass.
function Dialog({ onClosed }: { onClosed: () => void }) {
  const dialogRef = useDialogA11y<HTMLDivElement>(true, () => onClosed());
  return (
    <div>
      <button type="button">Outside</button>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Test dialog">
        <button type="button">First</button>
        <input aria-label="Second" />
      </div>
    </div>
  );
}

describe("useDialogA11y", () => {
  afterEach(cleanup);

  it("keeps focus on the control the user moved to when the parent re-renders", async () => {
    const view = render(<Dialog onClosed={() => {}} />);

    // The hook focuses the first control on the next frame.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" })));

    const second = screen.getByLabelText("Second");
    second.focus();
    expect(document.activeElement).toBe(second);

    view.rerender(<Dialog onClosed={() => {}} />);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(document.activeElement).toBe(second);
  });

  it("calls the latest onClose on Escape after a re-render", async () => {
    const calls: string[] = [];
    const view = render(<Dialog onClosed={() => calls.push("first")} />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" })));

    view.rerender(<Dialog onClosed={() => calls.push("latest")} />);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(calls).toEqual(["latest"]);
  });
});
