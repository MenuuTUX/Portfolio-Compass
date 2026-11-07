import { describe, expect, it } from "bun:test";
import { olsBeta, simpleReturns, weeklyPairs } from "@/lib/valuation/beta";

describe("simpleReturns", () => {
  it("computes period returns and marks bad prices", () => {
    const r = simpleReturns([100, 110, 99]);
    expect(r[0]).toBeCloseTo(0.1, 12);
    expect(r[1]).toBeCloseTo(-0.1, 12);
    expect(simpleReturns([100, 0, 5])[1]).toBeNaN();
  });
});

describe("olsBeta", () => {
  const market = Array.from({ length: 104 }, (_, i) => Math.sin(i / 3) * 0.02 + (i % 5) * 0.001);

  it("recovers the slope of a noiseless line", () => {
    const asset = market.map((m) => 1.5 * m + 0.001);
    const est = olsBeta(asset, market)!;
    expect(est.beta).toBeCloseTo(1.5, 10);
    expect(est.standardError).toBeLessThan(1e-9);
    expect(est.observations).toBe(104);
  });

  it("has a positive standard error with noise", () => {
    const asset = market.map((m, i) => 0.8 * m + (i % 7 - 3) * 0.002);
    const est = olsBeta(asset, market)!;
    expect(est.beta).toBeGreaterThan(0.5);
    expect(est.beta).toBeLessThan(1.1);
    expect(est.standardError).toBeGreaterThan(0);
  });

  it("returns null with too few observations or a flat market", () => {
    expect(olsBeta(market.slice(0, 20), market.slice(0, 20))).toBeNull();
    expect(olsBeta(market, market.map(() => 0))).toBeNull();
  });

  it("skips non-finite pairs", () => {
    const asset = market.map((m) => 2 * m);
    asset[10] = NaN;
    expect(olsBeta(asset, market)!.observations).toBe(103);
  });
});

describe("weeklyPairs", () => {
  it("keeps shared dates, prefers adjusted closes, and caps the window", () => {
    const asset = [
      { date: "2024-01-05T00:00:00Z", price: 10, adjPrice: 9 },
      { date: "2024-01-12", price: 11 },
      { date: "2024-01-19", price: 12 },
    ];
    const market = [
      { date: "2024-01-05", price: 100 },
      { date: "2024-01-19", price: 120, adjPrice: 118 },
    ];
    expect(weeklyPairs(asset, market)).toEqual({ asset: [9, 12], market: [100, 118] });

    const long = Array.from({ length: 200 }, (_, i) => ({ date: `d${i}`, price: i + 1 }));
    expect(weeklyPairs(long, long).asset).toHaveLength(105);
  });
});
