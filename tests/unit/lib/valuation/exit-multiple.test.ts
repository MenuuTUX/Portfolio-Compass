import { describe, expect, it } from "bun:test";
import { dcfValue, impliedGrowth, type DcfInputs } from "@/lib/valuation/dcf";
import { describeResult, exitMultipleWarning } from "@/lib/valuation/summarize";

const base: DcfInputs = {
  rev0: 1000, g1: 0.05, gT: 0.025, margin0: 0.25, tax: 0.25, ronic: 0.2,
  wacc: 0.09, netClaims: 200, shares: 100, midYear: true, stub: 1,
};

describe("terminal value as a multiple of terminal-year profit", () => {
  it("divides the undiscounted terminal value by that year's after-tax operating profit and by its operating profit", () => {
    const r = dcfValue(base);
    const last = r.years[r.years.length - 1];
    expect(r.terminalMultipleNopat).toBeCloseTo(r.terminalValue / last.nopat, 9);
    expect(r.terminalMultipleEbit).toBeCloseTo(r.terminalValue / (last.revenue * last.margin), 9);
    expect(r.terminalMultipleEbit!).toBeLessThan(r.terminalMultipleNopat!);
  });

  it("is null when that year's profit is not positive", () => {
    const r = dcfValue({ ...base, margin0: -0.5 });
    expect(r.terminalMultipleNopat).toBeNull();
    expect(r.terminalMultipleEbit).toBeNull();
  });

  it("does not change the solved growth rate", () => {
    const solved = impliedGrowth(base, dcfValue({ ...base, g1: 0.08 }).perShare);
    expect(solved.status).toBe("solved");
    if (solved.status === "solved") expect(solved.g).toBeCloseTo(0.08, 4);
  });
});

describe("exit multiple in the headline", () => {
  const price = dcfValue({ ...base, g1: 0.08 }).perShare;
  const solved = { implied: impliedGrowth(base, price) };

  it("adds one sentence comparing the terminal value with after-tax operating profit", () => {
    const d = describeResult(solved, base);
    expect(d.terminalShare).toMatch(/That terminal value equals about \d+ times that year's operating profit after tax, which you can compare with how similar companies trade\./);
    expect(d.exitMultiple).not.toBeNull();
  });

  it("gives the same multiple the model reports, rounded", () => {
    const d = describeResult(solved, base);
    const forward = dcfValue({ ...base, g1: 0.08 });
    expect(d.exitMultiple!.afterTax).toBeCloseTo(forward.terminalMultipleNopat!, 9);
    expect(d.terminalShare).toContain(`about ${Math.round(forward.terminalMultipleNopat!)} times`);
  });

  it("shows no multiple when no growth rate is solved", () => {
    const d = describeResult({ implied: { status: "price-above-range" } }, base);
    expect(d.exitMultiple).toBeNull();
    expect(d.terminalShare).toBeNull();
  });

  it("shows no multiple when the terminal value share is a failure", () => {
    const d = describeResult({ implied: { status: "solved", g: 0.1 } }, { ...base, margin0: -0.5 });
    expect(d.exitMultiple).toBeNull();
  });
});

describe("exit multiple warning", () => {
  it("warns above 35 times after-tax operating profit", () => {
    const w = exitMultipleWarning({ afterTax: 40, operating: 30 });
    expect(w).toMatch(/stretched/);
    expect(w).toMatch(/40 times/);
  });

  it("warns below 6 times after-tax operating profit", () => {
    expect(exitMultipleWarning({ afterTax: 4, operating: 3 })).toMatch(/stretched/);
  });

  it("does not warn inside the 6 to 35 range, including the edges", () => {
    expect(exitMultipleWarning({ afterTax: 18, operating: 14 })).toBeNull();
    expect(exitMultipleWarning({ afterTax: 35, operating: 27 })).toBeNull();
    expect(exitMultipleWarning({ afterTax: 6, operating: 5 })).toBeNull();
  });

  it("is silent when no multiple is shown", () => {
    expect(exitMultipleWarning(null)).toBeNull();
  });

  it("uses plain words with no em dash", () => {
    const w = exitMultipleWarning({ afterTax: 50, operating: 40 })!;
    expect(w.includes("—")).toBe(false);
    expect(/fair value|target price/i.test(w)).toBe(false);
  });
});
