import { describe, it, expect } from "bun:test";
import {
  getAssetYieldFraction,
  getEffectiveWeights,
  getPortfolioDividendYield,
  getPortfolioMarketValue,
  estimateAssetTotalReturn,
  annualYieldToDailyLogDrift,
} from "@/lib/math/portfolio-returns";
import { Portfolio, PortfolioItem } from "@/types";

function makeItem(partial: Partial<PortfolioItem> & { ticker: string }): PortfolioItem {
  return {
    name: partial.name || partial.ticker,
    price: partial.price ?? 100,
    changePercent: 0,
    history: partial.history || [],
    metrics: partial.metrics || { mer: 0, yield: 0 },
    allocation: partial.allocation || { equities: 100, bonds: 0, cash: 0 },
    weight: partial.weight ?? 0,
    shares: partial.shares ?? 0,
    dividendYield: partial.dividendYield,
    ...partial,
  } as PortfolioItem;
}

describe("getAssetYieldFraction", () => {
  it("reads metrics.yield as percent", () => {
    const item = makeItem({ ticker: "SCHD", metrics: { mer: 0.06, yield: 3.5 } });
    expect(getAssetYieldFraction(item)).toBeCloseTo(0.035);
  });

  it("falls back to dividendYield when metrics.yield is 0 or missing", () => {
    const zeroMetrics = makeItem({
      ticker: "AAPL",
      metrics: { mer: 0, yield: 0 },
      dividendYield: 0.5,
    });
    expect(getAssetYieldFraction(zeroMetrics)).toBeCloseTo(0.005);

    const noMetrics = makeItem({
      ticker: "MSFT",
      dividendYield: 0.8,
    });
    (noMetrics as any).metrics = undefined;
    expect(getAssetYieldFraction(noMetrics)).toBeCloseTo(0.008);
  });

  it("returns 0 for non-payers", () => {
    const item = makeItem({ ticker: "TSLA", metrics: { mer: 0, yield: 0 } });
    expect(getAssetYieldFraction(item)).toBe(0);
  });
});

describe("getEffectiveWeights", () => {
  it("uses market value (shares × price) when holdings have value", () => {
    const portfolio: Portfolio = [
      makeItem({ ticker: "A", price: 100, shares: 10, weight: 50 }), // $1000
      makeItem({ ticker: "B", price: 50, shares: 10, weight: 50 }), // $500
    ];
    const w = getEffectiveWeights(portfolio);
    expect(w[0]).toBeCloseTo(1000 / 1500);
    expect(w[1]).toBeCloseTo(500 / 1500);
    expect(w[0] + w[1]).toBeCloseTo(1);
  });

  it("falls back to explicit weights when no shares", () => {
    const portfolio: Portfolio = [
      makeItem({ ticker: "A", price: 100, shares: 0, weight: 70 }),
      makeItem({ ticker: "B", price: 50, shares: 0, weight: 30 }),
    ];
    const w = getEffectiveWeights(portfolio);
    expect(w[0]).toBeCloseTo(0.7);
    expect(w[1]).toBeCloseTo(0.3);
  });

  it("equal-weights when neither shares nor weights are set", () => {
    const portfolio: Portfolio = [
      makeItem({ ticker: "A", shares: 0, weight: 0 }),
      makeItem({ ticker: "B", shares: 0, weight: 0 }),
      makeItem({ ticker: "C", shares: 0, weight: 0 }),
    ];
    const w = getEffectiveWeights(portfolio);
    expect(w).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it("includes every asset (never drops holdings)", () => {
    const portfolio: Portfolio = [
      makeItem({ ticker: "A", price: 10, shares: 1, weight: 0 }),
      makeItem({ ticker: "B", price: 10, shares: 1, weight: 0 }),
      makeItem({ ticker: "C", price: 10, shares: 1, weight: 0 }),
    ];
    const w = getEffectiveWeights(portfolio);
    expect(w.length).toBe(3);
    expect(w.every((x) => x > 0)).toBe(true);
  });
});

describe("getPortfolioDividendYield", () => {
  it("value-weights yields across all assets", () => {
    // A: $1000 @ 4% yield, B: $1000 @ 0% yield → portfolio yield 2%
    const portfolio: Portfolio = [
      makeItem({
        ticker: "SCHD",
        price: 100,
        shares: 10,
        metrics: { mer: 0, yield: 4 },
      }),
      makeItem({
        ticker: "TSLA",
        price: 100,
        shares: 10,
        metrics: { mer: 0, yield: 0 },
      }),
    ];
    expect(getPortfolioDividendYield(portfolio)).toBeCloseTo(0.02);
  });

  it("counts a 100% high-yield portfolio fully", () => {
    const portfolio: Portfolio = [
      makeItem({
        ticker: "JEPI",
        price: 50,
        shares: 20,
        metrics: { mer: 0.35, yield: 8 },
      }),
    ];
    expect(getPortfolioDividendYield(portfolio)).toBeCloseTo(0.08);
  });
});

describe("getPortfolioMarketValue", () => {
  it("sums shares × price for all holdings", () => {
    const portfolio: Portfolio = [
      makeItem({ ticker: "A", price: 10, shares: 5 }),
      makeItem({ ticker: "B", price: 20, shares: 3 }),
    ];
    expect(getPortfolioMarketValue(portfolio)).toBe(10 * 5 + 20 * 3);
  });
});

describe("estimateAssetTotalReturn", () => {
  it("adds equity growth on top of yield", () => {
    const item = makeItem({
      ticker: "VTI",
      metrics: { mer: 0.03, yield: 1.5 },
      allocation: { equities: 100, bonds: 0, cash: 0 },
    });
    expect(estimateAssetTotalReturn(item)).toBeCloseTo(0.015 + 0.06);
  });

  it("treats bond tickers as low price-appreciation + yield", () => {
    const item = makeItem({
      ticker: "BND",
      metrics: { mer: 0.03, yield: 4 },
      allocation: { equities: 0, bonds: 100, cash: 0 },
    });
    expect(estimateAssetTotalReturn(item)).toBeCloseTo(0.04 + 0.01);
  });
});

describe("annualYieldToDailyLogDrift", () => {
  it("converts annual yield to daily log drift", () => {
    const daily = annualYieldToDailyLogDrift(0.05);
    // Compounding daily for 252 days ≈ 5%
    const compounded = Math.exp(daily * 252) - 1;
    expect(compounded).toBeCloseTo(0.05, 5);
  });

  it("returns 0 for zero / invalid", () => {
    expect(annualYieldToDailyLogDrift(0)).toBe(0);
    expect(annualYieldToDailyLogDrift(-1)).toBe(0);
  });
});
