import { describe, expect, it, afterEach } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PathFan from "@/components/simulation/PathFan";

afterEach(cleanup);

const base = {
  days: [0, 252, 504],
  daysPerYear: 252,
  years: 2,
  start: 1000,
  color: "#3b82f6",
  colorAlt: "#10b981",
  label: "Test fan",
};

function firstPathD(container: HTMLElement) {
  const path = container.querySelector("svg.mc-wave path");
  return path?.getAttribute("d") ?? "";
}

describe("PathFan log scale", () => {
  it("starts on a linear axis and labels the toggle for screen readers", () => {
    render(<PathFan {...base} paths={[[1000, 2000, 8000]]} />);
    const toggle = screen.getByLabelText("Log scale") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(toggle.disabled).toBe(false);
  });

  it("redraws the paths on a log axis when turned on", () => {
    const { container } = render(<PathFan {...base} paths={[[1000, 2000, 8000]]} />);
    const linearD = firstPathD(container);

    fireEvent.click(screen.getByLabelText("Log scale"));

    expect((screen.getByLabelText("Log scale") as HTMLInputElement).checked).toBe(true);
    expect(firstPathD(container)).not.toBe(linearD);
  });

  it("is unavailable when a plotted value is zero or below", () => {
    render(<PathFan {...base} paths={[[0, 1000, 2000]]} />);
    const toggle = screen.getByLabelText("Log scale") as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.checked).toBe(false);
  });
});
