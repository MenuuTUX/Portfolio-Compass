import { describe, it, expect } from "bun:test";
import {
  detectFundClass,
  positionsToAllocation,
  parseBondRatings,
  normalizeExpenseRatio,
  pickBeta,
  realizedAnnualVolatility,
  stockAnalysisPathForTicker,
  formatCreditRating,
} from "@/lib/asset-class";

describe("detectFundClass", () => {
  it("classifies bond funds by position", () => {
    expect(
      detectFundClass({
        name: "Vanguard Total Bond Market ETF",
        bondPosition: 0.98,
        stockPosition: 0,
        cashPosition: 0.02,
      }),
    ).toBe("bond");
  });

  it("classifies equity funds by position", () => {
    expect(
      detectFundClass({
        name: "S&P 500 ETF",
        stockPosition: 0.99,
        bondPosition: 0,
        cashPosition: 0.01,
      }),
    ).toBe("equity");
  });

  it("classifies leveraged products by name", () => {
    expect(
      detectFundClass({
        name: "BETAPRO NAT GAS LEV DAILY BULL",
        cashPosition: 1,
        stockPosition: 0,
        bondPosition: 0,
      }),
    ).toBe("leveraged");
  });
});

describe("normalizeExpenseRatio", () => {
  it("keeps explicit scraped zero fees and treats Yahoo zero as missing", () => {
    expect(normalizeExpenseRatio(0)).toBeUndefined();
    expect(normalizeExpenseRatio(0, "quote")).toBeUndefined();
    expect(normalizeExpenseRatio(0, "scraper")).toBe(0);
  });

  it("converts profile decimals to percent", () => {
    expect(normalizeExpenseRatio(0.0003, "profile")?.toFixed(2)).toBe("0.03");
    expect(normalizeExpenseRatio(0.000945, "profile")?.toFixed(4)).toBe(
      "0.0945",
    );
  });

  it("keeps quote/scraper values as percent", () => {
    expect(normalizeExpenseRatio(0.03, "quote")?.toFixed(2)).toBe("0.03");
    expect(normalizeExpenseRatio(0.0945, "quote")?.toFixed(4)).toBe("0.0945");
    expect(normalizeExpenseRatio(2.06, "scraper")?.toFixed(2)).toBe("2.06");
  });
});

describe("pickBeta", () => {
  it("prefers non-zero 5y beta", () => {
    expect(pickBeta(1.1, 0.9)).toBe(1.1);
  });

  it("falls back to 3y when 5y missing or zero", () => {
    expect(pickBeta(0, 0.98)).toBe(0.98);
    expect(pickBeta(undefined, 0.9)).toBe(0.9);
  });
});

describe("parseBondRatings", () => {
  it("flattens Yahoo rating rows and drops zeros", () => {
    const map = parseBondRatings([
      { aaa: 0.72 },
      { aa: 0.04 },
      { bb: 0 },
      { us_government: 0.5 },
    ]);
    expect(map["AAA"]).toBeCloseTo(0.72);
    expect(map["AA"]).toBeCloseTo(0.04);
    expect(map["US Government"]).toBeCloseTo(0.5);
    expect(map["BB"]).toBeUndefined();
  });
});

describe("positionsToAllocation", () => {
  it("returns percent weights", () => {
    const a = positionsToAllocation({
      stockPosition: 0,
      bondPosition: 0.98,
      cashPosition: 0.02,
    });
    expect(a?.bonds).toBeCloseTo(98);
    expect(a?.cash).toBeCloseTo(2);
  });
});

describe("realizedAnnualVolatility", () => {
  it("returns undefined for short series", () => {
    expect(realizedAnnualVolatility([
      { date: "2024-01-01", price: 1 },
      { date: "2024-01-02", price: 2 },
    ])).toBeUndefined();
  });

  it("estimates positive vol for a noisy series", () => {
    const start = Date.UTC(2024, 0, 1);
    const history = Array.from({ length: 220 }, (_, i) => ({
      date: new Date(start + i * 86400000).toISOString(),
      price: 100 + Math.sin(i) * 5 + i * 0.1,
    }));
    const v = realizedAnnualVolatility(history);
    expect(v).toBeGreaterThan(0);
  });

  it("annualizes daily and weekly observations at their observed cadence", () => {
    const makeHistory = (count: number, stepDays: number, weekdaysOnly = false) => {
      const history: { date: string; price: number }[] = [];
      let day = Date.UTC(2020, 0, 1);
      let price = 100;
      for (let i = 0; i < count; i++) {
        if (weekdaysOnly) {
          const weekday = new Date(day).getUTCDay();
          if (weekday === 0) day += 86400000;
          if (weekday === 6) day += 2 * 86400000;
        }
        history.push({ date: new Date(day).toISOString(), price });
        price *= Math.exp(Math.sin(i * 1.7) * 0.01);
        day += stepDays * 86400000;
      }
      return history;
    };

    const daily = realizedAnnualVolatility(makeHistory(220, 1, true));
    const weekly = realizedAnnualVolatility(makeHistory(220, 7));
    expect(daily).toBeGreaterThan(0);
    expect(weekly).toBeGreaterThan(0);
    // Equal per-point noise scales by observed points per year (~252 vs ~52).
    expect(daily! / weekly!).toBeGreaterThan(2);
    expect(daily! / weekly!).toBeLessThan(2.5);
  });

  it("does not annualize intraday ranges or insufficient daily history", () => {
    const start = Date.UTC(2024, 0, 1);
    const intraday = Array.from({ length: 220 }, (_, i) => ({
      date: new Date(start + i * 5 * 60_000).toISOString(),
      price: 100 + Math.sin(i),
    }));
    const shortDaily = Array.from({ length: 100 }, (_, i) => ({
      date: new Date(start + i * 86400000).toISOString(),
      price: 100 + Math.sin(i),
    }));
    expect(realizedAnnualVolatility(intraday)).toBeUndefined();
    expect(realizedAnnualVolatility(shortDaily)).toBeUndefined();
  });

  it("withholds a volatility estimate for sparse observations", () => {
    const start = Date.UTC(2024, 0, 1);
    const history = Array.from({ length: 101 }, (_, i) => ({
      date: new Date(start + i * 14 * 86400000).toISOString(),
      price: 100 + Math.sin(i),
    }));
    expect(realizedAnnualVolatility(history)).toBeUndefined();
  });
});

describe("stockAnalysisPathForTicker", () => {
  it("maps TSX tickers", () => {
    expect(stockAnalysisPathForTicker("HNU.TO")).toEqual({
      kind: "quote",
      path: "quote/tsx/hnu",
    });
    expect(stockAnalysisPathForTicker("XEQT.TO")).toEqual({
      kind: "quote",
      path: "quote/tsx/xeqt",
    });
  });

  it("maps plain US symbols as ETF paths", () => {
    expect(stockAnalysisPathForTicker("BND")).toEqual({
      kind: "etf",
      path: "etf/bnd",
    });
  });

  it("rejects unsupported international venues", () => {
    expect(stockAnalysisPathForTicker("XUO1.MU")).toBeNull();
    expect(stockAnalysisPathForTicker("0700.HK")).toBeNull();
  });
});

describe("formatCreditRating", () => {
  it("pretty-prints known keys", () => {
    expect(formatCreditRating("us_government")).toBe("US Government");
    expect(formatCreditRating("aaa")).toBe("AAA");
  });
});
