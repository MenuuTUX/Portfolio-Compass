import { describe, expect, it } from "bun:test";
import { HARNESS_PY } from "@/lib/lab/strategy/python";
import { LESSONS } from "@/lib/lab/lessons";
import { CODE_TEMPLATES } from "@/lib/lab/strategy/templates";

describe("day.price() and day.adj_price()", () => {
  it("price() reads the split-adjusted close, and adj_price() the dividend-adjusted series", () => {
    expect(HARNESS_PY).toContain("def adj_price(self, ticker):");
    expect(HARNESS_PY).toContain('s = self.closes[ticker]');
    expect(HARNESS_PY).toContain('elif kind == "adj_price":');
  });

  it("documents that price() is not dividend-adjusted and points returns and averages at adj_price()", () => {
    expect(HARNESS_PY).toContain("split-adjusted closing price, not adjusted for dividends");
    expect(HARNESS_PY).toContain("For returns and moving averages use adj_price().");
  });

  it("does not warn about or cache adj_price as an indicator with a period", () => {
    expect(HARNESS_PY).toContain('if kind in ("price", "adj_price"):');
  });

  it("lessons and templates use adj_price() or indicators, never price() for returns or averages", () => {
    const code = [...LESSONS.map((l) => l.code), ...CODE_TEMPLATES.map((t) => t.python)].join("\n");
    expect(code).not.toMatch(/day\.price\(/);
    expect(LESSONS.find((l) => l.id === "moving-average")!.code).toContain('day.adj_price("SPY")');
  });
});
