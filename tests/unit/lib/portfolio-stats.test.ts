import { describe, it, expect } from "bun:test";
import { calculatePortfolioHistoricalStats } from "@/lib/math/portfolio-stats";
import { Portfolio, PortfolioItem } from "@/types";

function makeHistory(days: number, startPrice: number, dailyRet: number) {
  const history: { date: string; price: number }[] = [];
  let p = startPrice;
  const start = new Date("2023-01-01").getTime();
  for (let i = 0; i < days; i++) {
    history.push({
      date: new Date(start + i * 86400000).toISOString(),
      price: p,
    });
    p *= 1 + dailyRet;
  }
  return history;
}

function makeItem(partial: Partial<PortfolioItem> & { ticker: string }): PortfolioItem {
  return {
    name: partial.ticker,
    price: partial.price ?? 100,
    currency: "USD",
    quoteAsOf: new Date().toISOString(),
    changePercent: 0,
    history: partial.history || [],
    metrics: partial.metrics || { mer: 0, yield: 0 },
    allocation: { equities: 100, bonds: 0, cash: 0 },
    weight: partial.weight ?? 50,
    shares: partial.shares ?? 10,
    ...partial,
  } as PortfolioItem;
}

describe("calculatePortfolioHistoricalStats", () => {
  it("does not treat today's dividend yield as a historical distribution", () => {
    const history = makeHistory(200, 100, 0);
    const portfolio: Portfolio = [
      makeItem({
        ticker: "DIV",
        price: 100,
        shares: 10,
        weight: 100,
        history,
        metrics: { mer: 0, yield: 4 },
      }),
    ];

    const stats = calculatePortfolioHistoricalStats(portfolio);
    expect(stats.annualizedReturn).toBeCloseTo(0);
  });

  it("reports unavailable when a held asset has no history", () => {
    const history = makeHistory(200, 100, 0.0002); // mild drift
    const portfolio: Portfolio = [
      makeItem({
        ticker: "HAS",
        price: 100,
        shares: 10,
        history,
        metrics: { mer: 0, yield: 1 },
      }),
      makeItem({
        ticker: "NOHIST",
        price: 50,
        shares: 20, // same $1000 value
        history: [],
        metrics: { mer: 0, yield: 6 },
      }),
    ];

    const stats = calculatePortfolioHistoricalStats(portfolio);
    expect(stats.annualizedReturn).toBeNull();
    expect(stats.annualizedVolatility).toBeNull();
  });

  it("uses dated history even when the latest quote is stale", () => {
    const stats = calculatePortfolioHistoricalStats([
      makeItem({
        ticker: "OLDQUOTE",
        quoteAsOf: "2020-01-01T00:00:00.000Z",
        history: makeHistory(200, 100, 0.0002),
      }),
    ]);
    expect(stats.annualizedReturn).not.toBeNull();
    expect(stats.annualizedReturn).toBeGreaterThan(0);
  });

  it("withholds historical stats when a saved share count is invalid", () => {
    const stats = calculatePortfolioHistoricalStats([
      makeItem({ ticker: "VALID", shares: 1, history: makeHistory(200, 100, 0.0002) }),
      makeItem({ ticker: "INVALID", shares: Number.NaN, history: makeHistory(200, 100, 0.0002) }),
    ]);
    expect(stats).toEqual({ annualizedReturn: null, annualizedVolatility: null });
  });

  it("keeps historical stats unavailable for mixed-currency holdings without dated FX history", () => {
    const history = makeHistory(200, 100, 0.0002);
    const stats = calculatePortfolioHistoricalStats([
      makeItem({ ticker: "USD", currency: "USD", history }),
      makeItem({ ticker: "CAD", currency: "CAD", history }),
    ]);
    expect(stats).toEqual({ annualizedReturn: null, annualizedVolatility: null });
  });

  it("uses held shares and aligned values for buy-and-hold return", () => {
    const start = Date.UTC(2024, 0, 1);
    const dates = [0, 61, 122, 183, 244, 305, 365].map((days) =>
      new Date(start + days * 86400000).toISOString(),
    );
    const historyA = [100, 116.7, 133.3, 150, 166.7, 183.3, 200].map(
      (price, i) => ({ date: dates[i], price }),
    );
    const historyB = [100, 91.7, 83.3, 75, 66.7, 58.3, 50].map(
      (price, i) => ({ date: dates[i], price }),
    );
    const portfolio: Portfolio = [
      makeItem({
        ticker: "A",
        price: 200,
        shares: 1,
        history: historyA,
        metrics: { mer: 0, yield: 0 },
        weight: 50,
      }),
      makeItem({
        ticker: "B",
        price: 50,
        shares: 1,
        history: historyB,
        metrics: { mer: 0, yield: 0 },
        weight: 50,
      }),
    ];

    const stats = calculatePortfolioHistoricalStats(portfolio);
    // One share of each: 200 at the start, 250 at the end.
    expect(stats.annualizedReturn).toBeCloseTo(0.25, 2);
    // Seven observations spread over a year cannot support daily volatility.
    expect(stats.annualizedVolatility).toBeNull();
  });

  it("preserves zero volatility for a flat historical series", () => {
    const portfolio: Portfolio = [
      makeItem({
        ticker: "FLAT",
        weight: 100,
        history: makeHistory(200, 100, 0),
      }),
    ];

    expect(
      calculatePortfolioHistoricalStats(portfolio).annualizedVolatility,
    ).toBeCloseTo(0);
  });
});
