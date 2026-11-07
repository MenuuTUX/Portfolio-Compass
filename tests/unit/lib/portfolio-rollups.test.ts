import { describe, expect, it } from "bun:test";
import {
  assetAllocation,
  lookThroughExposure,
  normalizePercent,
  sectorAllocation,
  sectorBreakdown,
  sectorWeights,
  weightedBeta,
  weightedExpenseRatio,
} from "@/lib/math/portfolio-rollups";
import { parseUpperTickers } from "@/lib/api";
import type { Portfolio } from "@/types";

const item = (ticker: string, extra: Record<string, unknown> = {}) =>
  ({
    ticker,
    name: ticker,
    price: 100,
    shares: 1,
    currency: "USD",
    weight: 50,
    changePercent: 0,
    assetType: "ETF",
    history: [],
    metrics: {},
    allocation: { equities: 0, bonds: 0, cash: 0 },
    ...extra,
  }) as unknown as Portfolio[number];

describe("normalizePercent", () => {
  it("reads the whole set as percent when any value is above 1", () => {
    expect(normalizePercent([60, 0.4, 0])).toEqual([0.6, 0.004, 0]);
  });
  it("leaves fractions alone", () => {
    expect(normalizePercent([0.6, 0.4])).toEqual([0.6, 0.4]);
  });
});

describe("weighted averages", () => {
  it("averages beta and MER by weight, and is null when any holding lacks one", () => {
    const sourced = { mer: 0.2, merSource: "Yahoo" };
    const p = [
      item("A", { weight: 75, beta: 1, metrics: sourced }),
      item("B", { weight: 25, beta: 2, metrics: { mer: 0.4, merSource: "Yahoo" } }),
    ];
    expect(weightedBeta(p)).toBeCloseTo(1.25);
    expect(weightedExpenseRatio(p)).toBeCloseTo(0.25);
    expect(weightedBeta([...p, item("C", { weight: 10 })])).toBeNull();
    expect(weightedExpenseRatio([...p, item("C", { weight: 10 })])).toBeNull();
  });
});

describe("allocation and sectors", () => {
  it("rolls up asset mix as fractions whether holdings report fractions or percents", () => {
    const p = [
      item("A", { allocation: { equities: 100, bonds: 0, cash: 0 } }),
      item("B", { allocation: { equities: 0, bonds: 0.5, cash: 0.5 } }),
    ];
    expect(assetAllocation(p)).toEqual({ equities: 0.5, bonds: 0.25, cash: 0.25 });
  });

  it("titles sector slugs and counts holdings without sectors as Unknown", () => {
    const p = [item("A", { sectors: { financial_services: 0.5, technology: 50 } }), item("B")];
    const out = sectorBreakdown(p);
    expect(out["Financial Services"]).toBeCloseTo(0.5 * 0.5);
    expect(out.Technology).toBeCloseTo(0.5 * 0.5);
    expect(out.Unknown).toBeCloseTo(0.5);
  });

  it("scales sector amounts by target weight, or by market value when no targets are set", () => {
    const targeted = [item("A", { weight: 40, sectors: { technology: 0.5 } })];
    expect(sectorAllocation(targeted, sectorWeights(targeted))).toEqual({ Technology: 0.2 });

    const byValue = [
      item("A", { weight: 0, shares: 1, price: 100, sectors: { technology: 1 } }),
      item("B", { weight: 0, shares: 1, price: 300, sectors: { energy: 1 } }),
    ];
    const w = sectorWeights(byValue);
    expect(w.get("A")).toBeCloseTo(25);
    expect(w.get("B")).toBeCloseTo(75);
  });
});

describe("lookThroughExposure", () => {
  it("adds look-through weights, the unlisted remainder and the cash buffer", () => {
    const fund = item("FUND", {
      weight: 50,
      holdings: [{ ticker: "AAPL", name: "Apple", weight: 40 }],
    });
    const { rows, sources } = lookThroughExposure([fund, item("AAPL", { weight: 20, assetType: "STOCK" })]);
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName.AAPL.totalWeight).toBeCloseTo(40);
    expect(byName.AAPL.FUND).toBeCloseTo(20);
    expect(byName.AAPL.Direct).toBeCloseTo(20);
    expect(byName.Other.totalWeight).toBeCloseTo(30);
    expect(byName.Cash.totalWeight).toBeCloseTo(30);
    expect(sources).toEqual(["Direct", "FUND"]);
  });
});

describe("parseUpperTickers", () => {
  it("upper-cases, drops invalid entries and caps the count", () => {
    expect(parseUpperTickers([" aapl", "bad ticker", "brk.b", "msft"], 2)).toEqual(["AAPL", "BRK.B"]);
  });
});
