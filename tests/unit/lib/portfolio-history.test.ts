import { describe, expect, it } from "bun:test";
import type { PortfolioItem } from "@/types";
import { availableRanges, buildPortfolioIndex, sliceIndex } from "@/lib/portfolio-history";

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
