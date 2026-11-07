import { describe, expect, it } from "bun:test";
import { blumeAdjustBeta, computeWacc, terminalGrowthCap } from "@/lib/valuation/wacc";

const inputs = {
  riskFree: 0.045, beta: 1.1, equityRiskPremium: 0.045, preTaxCostOfDebt: 0.055,
  marginalTaxRate: 0.25, marketCap: 900, totalDebt: 100,
};

describe("computeWacc", () => {
  it("applies CAPM, after-tax debt cost and market weights", () => {
    const r = computeWacc(inputs);
    const ke = 0.045 + 1.1 * 0.045;
    const kd = 0.055 * 0.75;
    const wd = 100 / 1000;
    expect(r.costOfEquity).toBeCloseTo(ke, 12);
    expect(r.afterTaxCostOfDebt).toBeCloseTo(kd, 12);
    expect(r.debtWeight).toBeCloseTo(wd, 12);
    expect(r.equityWeight).toBeCloseTo(0.9, 12);
    expect(r.rawWacc).toBeCloseTo(0.9 * ke + wd * kd, 12);
    expect(r.wacc).toBeCloseTo(r.rawWacc, 12);
    expect(r.clamped).toBe(false);
    expect(r.warnings).toEqual([]);
  });

  it("with no debt, WACC is the cost of equity", () => {
    const r = computeWacc({ ...inputs, totalDebt: 0 });
    expect(r.wacc).toBeCloseTo(r.costOfEquity, 12);
    expect(r.debtWeight).toBe(0);
  });

  it("raises a low result to the 6% floor with a warning", () => {
    const r = computeWacc({ ...inputs, beta: 0.2, equityRiskPremium: 0.01, riskFree: 0.02 });
    expect(r.wacc).toBe(0.06);
    expect(r.clamped).toBe(true);
    expect(r.warnings.length).toBe(1);
  });

  it("lowers a high result to the 14% ceiling with a warning", () => {
    const r = computeWacc({ ...inputs, beta: 3, equityRiskPremium: 0.06 });
    expect(r.wacc).toBe(0.14);
    expect(r.clamped).toBe(true);
    expect(r.warnings.length).toBe(1);
  });

  it("rejects a non-positive market cap", () => {
    expect(() => computeWacc({ ...inputs, marketCap: 0 })).toThrow();
  });
});

describe("helpers", () => {
  it("Blume adjustment shrinks beta toward 1", () => {
    expect(blumeAdjustBeta(1.5)).toBeCloseTo(1.335, 12);
    expect(blumeAdjustBeta(1)).toBeCloseTo(1, 12);
  });

  it("terminal growth is capped at the risk-free rate and 4%", () => {
    expect(terminalGrowthCap(0.03)).toBe(0.03);
    expect(terminalGrowthCap(0.05)).toBe(0.04);
  });
});
