import { describe, it, expect } from "bun:test";
import {
  getAssetYieldFraction,
  getEffectiveWeights,
  getPortfolioMarketValue,
  getPortfolioValuation,
  getPortfolioDividendYieldStatus,
  getQuoteFreshness,
  gainOnInvestedPercent,
  annualRateToMonthlyRate,
} from "@/lib/math/portfolio-returns";
import { Portfolio, PortfolioItem } from "@/types";

function makeItem(partial: Partial<PortfolioItem> & { ticker: string }): PortfolioItem {
  return {
    name: partial.name || partial.ticker,
    price: partial.price ?? 100,
    currency: "USD",
    quoteAsOf: new Date().toISOString(),
    changePercent: 0,
    history: partial.history || [],
    metrics: partial.metrics || { mer: null, yield: null },
    allocation: partial.allocation || { equities: 100, bonds: 0, cash: 0 },
    weight: partial.weight ?? 0,
    shares: partial.shares ?? 0,
    dividendYield: partial.dividendYield,
    ...partial,
  } as PortfolioItem;
}

describe("getAssetYieldFraction", () => {
  it("reads metrics.yield as percent", () => {
    const item = makeItem({ ticker: "SCHD", metrics: { mer: 0.06, yield: 3.5, yieldSource: "Issuer factsheet" } });
    expect(getAssetYieldFraction(item)).toBeCloseTo(0.035);
  });

  it("withholds Yahoo and source-free yield values from return projections", () => {
    const zeroMetrics = makeItem({
      ticker: "AAPL",
      metrics: { mer: 0, yield: 0, yieldSource: "Yahoo Finance quote" },
      dividendYield: 0.5,
    });
    expect(getAssetYieldFraction(zeroMetrics)).toBe(0);

    const noMetrics = makeItem({
      ticker: "MSFT",
      dividendYield: 0.8,
    });
    (noMetrics as any).metrics = undefined;
    expect(getAssetYieldFraction(noMetrics)).toBe(0);
  });

  it("does not treat a source-free yield number as known", () => {
    const item = makeItem({ ticker: "UNKNOWN", metrics: { yield: 8 }, dividendYield: 8 });
    expect(getPortfolioDividendYieldStatus([item]).yield).toBeNull();
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

describe("getPortfolioDividendYieldStatus", () => {
  it("value-weights yields across all assets", () => {
    // A: $1000 @ 4% yield, B: $1000 @ 0% yield → portfolio yield 2%
    const portfolio: Portfolio = [
      makeItem({
        ticker: "SCHD",
        price: 100,
        shares: 10,
        metrics: { mer: 0, yield: 4, yieldSource: "Issuer factsheet" },
      }),
      makeItem({
        ticker: "TSLA",
        price: 100,
        shares: 10,
        metrics: { mer: 0, yield: 0, yieldSource: "test" },
      }),
    ];
    expect(getPortfolioDividendYieldStatus(portfolio).yield).toBeCloseTo(0.02);
  });

  it("counts a 100% high-yield portfolio fully", () => {
    const portfolio: Portfolio = [
      makeItem({
        ticker: "JEPI",
        price: 50,
        shares: 20,
        metrics: { mer: 0.35, yield: 8, yieldSource: "Issuer factsheet" },
      }),
    ];
    expect(getPortfolioDividendYieldStatus(portfolio).yield).toBeCloseTo(0.08);
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

  it("refuses to add prices in different or unknown currencies", () => {
    expect(getPortfolioMarketValue([
      makeItem({ ticker: "US", price: 100, shares: 1, currency: "USD" }),
      makeItem({ ticker: "CA", price: 100, shares: 1, currency: "CAD" }),
    ])).toBeNaN();
    expect(getPortfolioMarketValue([
      makeItem({ ticker: "UNKNOWN", price: 100, shares: 1, currency: undefined }),
    ])).toBeNaN();
  });

  it("reports incomplete held quotes and refuses cross-currency base conversion", () => {
    const missingQuote = makeItem({ ticker: "MISSING", shares: 2, price: 0 });
    const incomplete = getPortfolioValuation([missingQuote]);
    expect(incomplete).toMatchObject({
      baseCurrency: "USD",
      totalValue: null,
      heldHoldings: 1,
      pricedHoldings: 0,
      complete: false,
    });

    const needsFx = getPortfolioValuation([
      makeItem({ ticker: "US", shares: 1, currency: "USD" }),
    ], "CAD");
    expect(needsFx.totalValue).toBeNull();
    expect(needsFx.complete).toBe(false);
    expect(needsFx.unavailableReason).toBe("fx-conversion-unavailable");

    const stale = getPortfolioValuation([
      makeItem({ ticker: "STALE", shares: 1, quoteStatus: "unavailable" }),
    ]);
    expect(stale.totalValue).toBeNull();
    expect(stale.unavailableReason).toBe("quote-unavailable");

    const now = Date.UTC(2026, 8, 26, 12);
    const oldQuote = makeItem({
      ticker: "OLD",
      shares: 1,
      quoteAsOf: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(getPortfolioValuation([oldQuote], undefined, now)).toMatchObject({
      totalValue: null,
      pricedHoldings: 0,
      unavailableReason: "quote-stale",
    });
  });

  it("uses market-value weights only for a complete same-currency valuation", () => {
    const portfolio = [
      makeItem({ ticker: "US", shares: 1, weight: 50, currency: "USD" }),
      makeItem({ ticker: "CA", shares: 1, weight: 50, currency: "CAD" }),
    ];
    expect(getEffectiveWeights(portfolio)).toEqual([0.5, 0.5]);
  });

  it("converts current mixed-currency values into an explicit CAD base", () => {
    const now = Date.UTC(2026, 8, 26, 12);
    const fx = { usdCad: 1.35, date: "2026-09-25" };
    const portfolio = [
      makeItem({ ticker: "US", price: 100, shares: 1, currency: "USD", quoteAsOf: new Date(now).toISOString() }),
      makeItem({ ticker: "CA", price: 100, shares: 1, currency: "CAD", quoteAsOf: new Date(now).toISOString() }),
    ];
    expect(getPortfolioValuation(portfolio, "CAD", now, fx)).toMatchObject({
      baseCurrency: "CAD", totalValue: 235, complete: true,
    });
    expect(getEffectiveWeights(portfolio, fx, "CAD", now)).toEqual([
      135 / 235, 100 / 235,
    ]);
  });

  it("inverts the official USD/CAD rate for USD base values", () => {
    const now = Date.UTC(2026, 8, 26, 12);
    const portfolio = [
      makeItem({ ticker: "CA", price: 135, shares: 1, currency: "CAD", quoteAsOf: new Date(now).toISOString() }),
      makeItem({ ticker: "US", price: 100, shares: 1, currency: "USD", quoteAsOf: new Date(now).toISOString() }),
    ];
    expect(getPortfolioValuation(portfolio, "USD", now, {
      usdCad: 1.35, date: "2026-09-25",
    }).totalValue).toBeCloseTo(200);
  });

  it("withholds mixed-currency totals when FX is missing or stale", () => {
    const now = Date.UTC(2026, 8, 26, 12);
    const portfolio = [
      makeItem({ ticker: "US", shares: 1, currency: "USD", quoteAsOf: new Date(now).toISOString() }),
      makeItem({ ticker: "CA", shares: 1, currency: "CAD", quoteAsOf: new Date(now).toISOString() }),
    ];
    expect(getPortfolioValuation(portfolio, "CAD", now).totalValue).toBeNull();
    expect(getPortfolioValuation(portfolio, "CAD", now, {
      usdCad: 1.35, date: "2026-09-20",
    }).totalValue).toBeNull();
  });

  it("rejects impossible and future FX observation dates", () => {
    const now = Date.UTC(2026, 8, 26, 23, 58);
    const portfolio = [
      makeItem({ ticker: "US", shares: 1, currency: "USD", quoteAsOf: new Date(now).toISOString() }),
      makeItem({ ticker: "CA", shares: 1, currency: "CAD", quoteAsOf: new Date(now).toISOString() }),
    ];

    for (const date of ["2026-02-30", "2026-09-27"]) {
      expect(getPortfolioValuation(portfolio, "CAD", now, {
        usdCad: 1.35, date,
      }).totalValue).toBeNull();
    }
    expect(getPortfolioValuation(portfolio, "CAD", now, {
      usdCad: 1.35, date: "2026-09-26",
    }).totalValue).toBe(235);
  });
});

describe("getQuoteFreshness", () => {
  const now = Date.UTC(2026, 8, 26, 12);

  it("requires a parseable quote timestamp", () => {
    expect(getQuoteFreshness(undefined, now)).toBe("missing");
    expect(getQuoteFreshness("not-a-date", now)).toBe("invalid");
    expect(getQuoteFreshness(123, now)).toBe("invalid");
  });

  it("allows five days for weekends and holidays, then marks older and future quotes", () => {
    expect(getQuoteFreshness(new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), now)).toBe("fresh");
    expect(getQuoteFreshness(new Date(now - 5 * 24 * 60 * 60 * 1000 - 1).toISOString(), now)).toBe("stale");
    expect(getQuoteFreshness(new Date(now + 6 * 60 * 1000).toISOString(), now)).toBe("future");
    expect(getQuoteFreshness(new Date(now + 4 * 60 * 1000).toISOString(), now)).toBe("fresh");
  });
});

describe("getPortfolioDividendYieldStatus", () => {
  it("marks a missing yield as incomplete instead of treating it as zero", () => {
    const result = getPortfolioDividendYieldStatus([
      makeItem({ ticker: "UNKNOWN", shares: 1, weight: 100 }),
    ]);
    expect(result).toEqual({
      yield: null,
      complete: false,
      missingTickers: ["UNKNOWN"],
    });
  });

  it("accepts a sourced zero yield", () => {
    const result = getPortfolioDividendYieldStatus([
      makeItem({
        ticker: "NOYIELD",
        shares: 1,
        weight: 100,
        metrics: { mer: 0, yield: 0, yieldSource: "provider" },
      }),
    ]);
    expect(result).toEqual({ yield: 0, complete: true, missingTickers: [] });
  });
});

describe("gainOnInvestedPercent", () => {
  it("does not count deposits as investment gain", () => {
    // $1,000 starting capital plus $100 per month for a year at 0% return.
    expect(gainOnInvestedPercent(2200, 2200)).toBe(0);
  });
});

describe("annualRateToMonthlyRate", () => {
  it("preserves the effective annual return when compounded monthly", () => {
    const monthly = annualRateToMonthlyRate(0.07);
    expect(Math.pow(1 + monthly, 12) - 1).toBeCloseTo(0.07, 10);
  });

  it("handles a total-loss return without producing NaN", () => {
    expect(annualRateToMonthlyRate(-1)).toBe(-1);
  });
});
