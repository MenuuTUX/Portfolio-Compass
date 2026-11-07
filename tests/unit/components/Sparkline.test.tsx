import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import Sparkline from "@/components/Sparkline";

afterEach(cleanup);

const data = [
  { date: "2024-01-02", price: 10 },
  { date: "2024-01-03", price: 14 },
  { date: "2024-01-04", price: 7 },
  { date: "2024-01-05", price: 12 },
  { date: "2024-01-08", price: 11 },
];

describe("Sparkline screen-reader summary", () => {
  it("renders one summary row, not one row per point", () => {
    const { container } = render(<Sparkline data={data} color="#000" name="SPY" />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);
  });

  it("summarises first, last, low, high and count", () => {
    const { container } = render(<Sparkline data={data} color="#000" name="SPY" />);
    const cells = Array.from(container.querySelectorAll("tbody tr td")).map((td) => td.textContent ?? "");
    expect(cells).toHaveLength(5);
    expect(cells[0]).toContain("10");
    expect(cells[1]).toContain("11");
    expect(cells[2]).toContain("7");
    expect(cells[3]).toContain("14");
    expect(cells[4]).toBe("5");
  });

  it("keeps the table caption with the ticker", () => {
    const { container } = render(<Sparkline data={data} color="#000" name="SPY" />);
    expect(container.querySelector("caption")?.textContent).toContain("SPY");
  });
});
