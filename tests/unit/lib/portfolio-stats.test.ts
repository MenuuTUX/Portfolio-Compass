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
  it("adds dividend yield on top of price returns (total return)", () => {
    // ~200 trading days of flat prices (0% price return) + 4% yield
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
    // Price return ≈ 0, yield 4% → total ≈ 4%
    expect(stats.annualizedReturn).toBeGreaterThan(0.03);
    expect(stats.annualizedReturn).toBeLessThan(0.06);
  });

  it("includes assets without history via heuristic + yield", () => {
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
    // Must be a finite positive blend — both assets contribute
    expect(Number.isFinite(stats.annualizedReturn)).toBe(true);
    expect(stats.annualizedReturn).toBeGreaterThan(0);
  });

  it("uses value weights so share counts matter", () => {
    const historyA = makeHistory(200, 100, 0);
    const historyB = makeHistory(200, 100, 0);
    // A is 90% of value with 0% yield; B is 10% with 10% yield
    const portfolio: Portfolio = [
      makeItem({
        ticker: "A",
        price: 100,
        shares: 90,
        history: historyA,
        metrics: { mer: 0, yield: 0 },
        weight: 50, // misleading weight — market value should win
      }),
      makeItem({
        ticker: "B",
        price: 100,
        shares: 10,
        history: historyB,
        metrics: { mer: 0, yield: 10 },
        weight: 50,
      }),
    ];

    const stats = calculatePortfolioHistoricalStats(portfolio);
    // Value-weighted yield ≈ 1%, not 5%
    expect(stats.annualizedReturn).toBeGreaterThan(0.005);
    expect(stats.annualizedReturn).toBeLessThan(0.03);
  });
});
