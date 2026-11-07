import { describe, expect, it } from "bun:test";
import type { PortfolioItem } from "@/types";
import { availableRanges, buildPortfolioIndexWithBasis, sliceIndex } from "@/lib/portfolio-history";

const buildPortfolioIndex = (portfolio: PortfolioItem[]) => buildPortfolioIndexWithBasis(portfolio).points;

const item = (ticker: string, weight: number, prices: number[]) =>
  ({
    ticker,
    weight,
    history: prices.map((price, i) => ({ date: `2026-01-0${i + 1}`, price })),
  }) as unknown as PortfolioItem;

describe("buildPortfolioIndex", () => {
  it("starts at 100 and applies target weights to past prices", () => {
    const points = buildPortfolioIndex([item("A", 50, [10, 20]), item("B", 50, [10, 10])]);
    expect(points.map((p) => p.v)).toEqual([100, 150]);
  });

  it("returns nothing when a holding has no history", () => {
    expect(buildPortfolioIndex([item("A", 50, [10, 20]), item("B", 50, [])])).toEqual([]);
  });

  it("ignores zero-weight holdings", () => {
    expect(buildPortfolioIndex([item("A", 100, [10, 15]), item("B", 0, [])]).map((p) => p.v)).toEqual([100, 150]);
  });
});

describe("range helpers", () => {
  it("only offers ranges the data covers", () => {
    const points = buildPortfolioIndex([item("A", 100, [1, 2, 3])]);
    expect(availableRanges(points)).toEqual(["ALL"]);
    expect(sliceIndex(points, "ALL")).toEqual(points);
  });
});

describe("portfolio history date keys", () => {
  it("matches an ISO timestamp with a date-only string for the same day", () => {
    const item = (ticker: string, dates: string[]) => ({
      ticker, weight: 50, shares: 1, price: 10,
      history: dates.map((date, i) => ({ date, price: 10 + i })),
    }) as unknown as Parameters<typeof buildPortfolioIndex>[0][number];
    const points = buildPortfolioIndex([
      item("A", ["2024-01-02T00:00:00.000Z", "2024-01-03T00:00:00.000Z"]),
      item("B", ["2024-01-02", "2024-01-03"]),
    ]);
    expect(points.map((p) => p.t)).toEqual(["2024-01-02", "2024-01-03"]);
  });
});
