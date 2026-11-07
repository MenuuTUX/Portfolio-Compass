import { describe, expect, it } from "bun:test";
import { estimateMarketBeta, MIN_BETA_OBSERVATIONS } from "@/lib/math/beta";

/** Deterministic daily series: market returns alternate in sign and size. */
function series(days: number, assetReturn: (marketReturn: number, i: number) => number) {
  const market: { date: string; price: number; adjPrice?: number }[] = [];
  const asset: { date: string; price: number; adjPrice?: number }[] = [];
  let m = 100;
  let a = 50;
  const start = Date.UTC(2025, 0, 1);
  for (let i = 0; i <= days; i++) {
    const date = new Date(start + i * 86_400_000).toISOString();
    if (i > 0) {
      const r = (i % 2 === 0 ? 1 : -1) * (0.004 + (i % 7) * 0.001);
      m *= 1 + r;
      a *= 1 + assetReturn(r, i);
    }
    market.push({ date, price: m, adjPrice: m });
    asset.push({ date, price: a, adjPrice: a });
  }
  return { market, asset };
}

describe("estimateMarketBeta", () => {
  it("recovers the slope of a fund that moves half as much as the market", () => {
    const { market, asset } = series(250, (r) => 0.5 * r);
    const estimate = estimateMarketBeta(asset, market);
    expect(estimate?.beta).toBe(0.5);
    expect(estimate?.observations).toBe(250);
    expect(estimate?.basis).toBe("total");
    expect(estimate?.source).toBe("Estimated vs SPY from 250 daily total returns");
  });

  it("gives a bond-like fund a low beta, unlike Yahoo's benchmark-relative 0.98", () => {
    // Uncorrelated noise plus a small market loading.
    const { market, asset } = series(250, (r, i) => 0.05 * r + (i % 3 === 0 ? 0.002 : -0.001));
    const estimate = estimateMarketBeta(asset, market);
    expect(estimate).not.toBeNull();
    expect(Math.abs(estimate!.beta)).toBeLessThan(0.2);
  });

  it("aligns by calendar day, not by index", () => {
    const { market, asset } = series(250, (r) => 2 * r);
    // Drop a market day in the middle: index slicing would misalign every
    // later return, date alignment just skips that day.
    const gapped = market.filter((_, i) => i !== 100);
    const estimate = estimateMarketBeta(asset, gapped);
    expect(estimate).not.toBeNull();
    expect(estimate!.beta).toBeGreaterThan(1.8);
    expect(estimate!.beta).toBeLessThan(2.2);
  });

  it("falls back to price returns when either series lacks adjusted closes", () => {
    const { market, asset } = series(250, (r) => r);
    const priceOnly = asset.map(({ date, price }) => ({ date, price }));
    expect(estimateMarketBeta(priceOnly, market)?.basis).toBe("price");
  });

  it("returns null for short overlap or a flat market", () => {
    const { market, asset } = series(MIN_BETA_OBSERVATIONS - 1, (r) => r);
    expect(estimateMarketBeta(asset, market)).toBeNull();

    const long = series(250, (r) => r);
    const flat = long.market.map((p) => ({ ...p, price: 100, adjPrice: 100 }));
    expect(estimateMarketBeta(long.asset, flat)).toBeNull();
  });
});
