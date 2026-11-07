import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HelpTip } from "@/components/ui/HelpTip";

function trigger(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[tabindex="0"]');
  if (!(el instanceof HTMLElement)) throw new Error("trigger missing");
  return el;
}

const tipOpen = () => screen.queryByRole("tooltip") !== null;

afterEach(cleanup);

describe("HelpTip", () => {
  it("opens on click and closes on a second click", () => {
    const { container } = render(<HelpTip term="Sharpe Ratio" />);
    expect(tipOpen()).toBe(false);

    fireEvent.click(trigger(container));
    expect(tipOpen()).toBe(true);

    fireEvent.click(trigger(container));
    expect(tipOpen()).toBe(false);
  });

  it("opens with Enter and Space from the keyboard", () => {
    const { container } = render(<HelpTip term="Sharpe Ratio" />);
    fireEvent.keyDown(trigger(container), { key: "Enter" });
    expect(tipOpen()).toBe(true);
    fireEvent.keyDown(trigger(container), { key: " " });
    expect(tipOpen()).toBe(false);
  });

  it("closes on Escape", () => {
    const { container } = render(<HelpTip term="Sharpe Ratio" />);
    fireEvent.click(trigger(container));
    expect(tipOpen()).toBe(true);

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(tipOpen()).toBe(false);
  });

  it("closes on a pointer down outside the term and its tip", () => {
    const { container } = render(<HelpTip term="Sharpe Ratio" />);
    fireEvent.click(trigger(container));
    expect(tipOpen()).toBe(true);

    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(tipOpen()).toBe(false);
  });

  it("keeps the tip open when pressing inside the tip", () => {
    const { container } = render(<HelpTip term="Sharpe Ratio" />);
    fireEvent.click(trigger(container));
    const tip = screen.getByRole("tooltip");

    act(() => {
      fireEvent.pointerDown(tip);
    });
    expect(tipOpen()).toBe(true);
  });

  it("still opens on focus and wires aria-describedby to the tip", () => {
    const { container } = render(<HelpTip term="Sharpe Ratio" />);
    const el = trigger(container);
    expect(el.getAttribute("aria-describedby")).toBeNull();

    fireEvent.focus(el);
    const tip = screen.getByRole("tooltip");
    expect(el.getAttribute("aria-describedby")).toBe(tip.id);
  });

  it("renders plain text for unknown terms", () => {
    render(<HelpTip term="Completely Made Up Metric XYZ" />);
    expect(screen.getByText("Completely Made Up Metric XYZ")).toBeTruthy();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps the tip inside a 375px phone screen, even for a term at the right edge", () => {
    const originalWidth = window.innerWidth;
    window.innerWidth = 375;
    try {
      const { container } = render(<HelpTip term="Sharpe Ratio" />);
      const el = trigger(container);
      el.getBoundingClientRect = () =>
        ({ left: 350, right: 370, top: 100, bottom: 120, width: 20, height: 20, x: 350, y: 100, toJSON: () => ({}) }) as DOMRect;

      fireEvent.click(el);
      const tip = screen.getByRole("tooltip") as HTMLElement;
      const left = parseFloat(tip.style.left);
      expect(left).toBeGreaterThanOrEqual(12);
      expect(left + 280).toBeLessThanOrEqual(375 - 12);
    } finally {
      window.innerWidth = originalWidth;
    }
  });
});
