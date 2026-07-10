import { describe, it, expect } from "bun:test";
import { getGlossaryEntry, hasGlossaryEntry } from "@/lib/glossary";
import {
  applyMarketFilters,
  DEFAULT_MARKET_FILTERS,
} from "@/components/MarketFilters";

describe("glossary", () => {
  it("resolves common metric labels", () => {
    expect(getGlossaryEntry("Market Cap")?.label).toBe("Market Cap");
    expect(getGlossaryEntry("PE Ratio")?.what).toMatch(/Price-to-Earnings/i);
    expect(getGlossaryEntry("Div Yield")?.means.length).toBeGreaterThan(10);
    expect(getGlossaryEntry("Beta")?.what).toMatch(/market/i);
    expect(getGlossaryEntry("Expense Ratio")?.label).toMatch(/Expense/i);
  });

  it("handles aliases and case", () => {
    expect(hasGlossaryEntry("p/e ratio")).toBe(true);
    expect(hasGlossaryEntry("52W HIGH")).toBe(true);
    expect(getGlossaryEntry("MER")?.what).toMatch(/fee|Expense|Management/i);
  });

  it("returns null for unknown jargon", () => {
    expect(getGlossaryEntry("Completely Made Up Metric XYZ")).toBeNull();
  });
});

describe("applyMarketFilters", () => {
  const sample = [
    {
      ticker: "AAPL",
      name: "Apple",
      price: 200,
      changePercent: 1.5,
      marketCap: 3e12,
      peRatio: 30,
      metrics: { yield: 0.5, mer: 0 },
    },
    {
      ticker: "SCHD",
      name: "Schwab Dividend",
      price: 80,
      changePercent: -0.8,
      marketCap: 50e9,
      peRatio: 15,
      metrics: { yield: 3.5, mer: 0.06 },
    },
    {
      ticker: "TSLA",
      name: "Tesla",
      price: 250,
      changePercent: 0.1,
      marketCap: 800e9,
      peRatio: 60,
      metrics: { yield: 0, mer: 0 },
    },
  ];

  it("filters gainers", () => {
    const out = applyMarketFilters(sample, {
      ...DEFAULT_MARKET_FILTERS,
      performance: "gainers",
    });
    expect(out.map((x) => x.ticker)).toEqual(["AAPL"]);
  });

  it("filters high yield", () => {
    const out = applyMarketFilters(sample, {
      ...DEFAULT_MARKET_FILTERS,
      yieldFilter: "high",
    });
    expect(out.map((x) => x.ticker)).toEqual(["SCHD"]);
  });

  it("sorts by yield descending", () => {
    const out = applyMarketFilters(sample, {
      ...DEFAULT_MARKET_FILTERS,
      sort: "yield_desc",
    });
    expect(out[0].ticker).toBe("SCHD");
    expect(out[out.length - 1].ticker).toBe("TSLA");
  });

  it("filters value PE", () => {
    const out = applyMarketFilters(sample, {
      ...DEFAULT_MARKET_FILTERS,
      pe: "value",
    });
    expect(out.map((x) => x.ticker)).toEqual(["SCHD"]);
  });

  it("filters ultra-low MER", () => {
    const out = applyMarketFilters(sample, {
      ...DEFAULT_MARKET_FILTERS,
      mer: "ultra_low",
    });
    expect(out.map((x) => x.ticker)).toEqual(["SCHD"]);
  });
});
