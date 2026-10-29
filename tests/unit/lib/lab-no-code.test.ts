import { describe, expect, it } from "bun:test";
import type { BarSeries } from "@/lib/lab/bar-types";
import { buildFrame } from "@/lib/lab/engine/frame";
import { BLANK_FORM, rowsFromPortfolio, TEMPLATES, toRequest } from "@/lib/lab/lab-form";
import { compileStrategy, strategyTickers } from "@/lib/lab/no-code";

function series(ticker: string, closes: number[]): BarSeries {
  return {
    ticker,
    currency: "USD",
    bars: closes.map((c, i) => ({
      date: `2024-01-${String(i + 2).padStart(2, "0")}`,
      open: c, high: c, low: c, close: c, adjClose: c, volume: null,
    })),
    dividends: [],
    splits: [],
    source: { provider: "Yahoo Finance", adjustment: "close: split-adjusted; adjClose: split- and dividend-adjusted", fetchedAt: "test" },
  };
}

const row = (w: Float64Array, t: number, n: number) => [...w.subarray(t * n, (t + 1) * n)];

describe("compileStrategy", () => {
  it("repeats a fixed allocation on every bar", () => {
    const frame = buildFrame([series("A", [1, 2, 3]), series("B", [1, 1, 1])], { baseCurrency: "USD" });
    const w = compileStrategy(frame, { kind: "fixed", allocation: { A: 0.6, B: 0.4 } });
    expect(row(w, 2, 2)).toEqual([0.6, 0.4]);
  });

  it("moves weight to the safe asset when the close falls below its moving average", () => {
    const frame = buildFrame([series("A", [10, 11, 12, 9, 13]), series("SAFE", [1, 1, 1, 1, 1])], { baseCurrency: "USD" });
    const w = compileStrategy(frame, { kind: "trend", allocation: { A: 1 }, smaDays: 3, safe: "SAFE" });
    // Bar 3: 9 < mean(11, 12, 9) = 10.67, so out. Bar 4: 13 > mean(12, 9, 13), so back in.
    expect([0, 1, 2, 3, 4].map((t) => row(w, t, 2))).toEqual([[1, 0], [1, 0], [1, 0], [0, 1], [1, 0]]);
  });

  it("holds cash when no safe asset is given", () => {
    const frame = buildFrame([series("A", [10, 11, 12, 9])], { baseCurrency: "USD" });
    const w = compileStrategy(frame, { kind: "trend", allocation: { A: 1 }, smaDays: 3 });
    expect(w[3]).toBe(0);
  });

  it("ranks by trailing return and applies the absolute check", () => {
    const frame = buildFrame([
      series("UP", [10, 11, 12, 13]),
      series("FLAT", [10, 10, 10.1, 10.2]),
      series("DOWN", [10, 9, 8, 7]),
      series("SAFE", [1, 1, 1, 1]),
    ], { baseCurrency: "USD" });
    const w = compileStrategy(frame, { kind: "momentum", universe: ["UP", "FLAT", "DOWN"], lookbackDays: 2, top: 2, absolute: true, safe: "SAFE" });
    expect(row(w, 0, 4)).toEqual([0, 0, 0, 0]);
    expect(row(w, 3, 4)).toEqual([0.5, 0.5, 0, 0]);

    const losers = compileStrategy(frame, { kind: "momentum", universe: ["DOWN"], lookbackDays: 2, top: 1, absolute: true, safe: "SAFE" });
    expect(row(losers, 3, 4)).toEqual([0, 0, 0, 1]);
  });

  it("lists every ticker a strategy needs", () => {
    expect(strategyTickers({ kind: "momentum", universe: ["SPY", "EFA"], lookbackDays: 252, top: 1, absolute: true, safe: "AGG" }))
      .toEqual(["SPY", "EFA", "AGG"]);
  });
});

describe("lab form", () => {
  it("builds a valid request for every template", () => {
    for (const t of TEMPLATES) {
      const out = toRequest({ ...BLANK_FORM, ...t.form() });
      expect("request" in out ? out.request.tickers.length : out.errors).toBeGreaterThan(0);
    }
  });

  it("turns percent weights into fractions and adds the benchmark", () => {
    const out = toRequest({ ...BLANK_FORM, rows: [{ ticker: "spy", weight: 60 }, { ticker: "AGG", weight: 40 }], benchmark: "qqq", rebalance: "drift", band: 5 });
    if (!("request" in out)) throw new Error(out.errors.join());
    expect(out.request.strategy).toEqual({ kind: "fixed", allocation: { SPY: 0.6, AGG: 0.4 } });
    expect(out.request.tickers).toEqual(["SPY", "AGG", "QQQ"]);
    expect(out.request.config.rebalance).toEqual({ mode: "drift", band: 0.05 });
  });

  it("explains leverage, duplicate tickers and bad dates in plain words", () => {
    const out = toRequest({
      ...BLANK_FORM,
      rows: [{ ticker: "SPY", weight: 80 }, { ticker: "SPY", weight: 40 }],
      start: "2020-01-01",
      end: "2019-01-01",
    });
    expect("errors" in out && out.errors).toEqual([
      "Each ticker can appear only once.",
      "Weights add up to 120.00%. The Lab does not use leverage, so the total must be 100% or less.",
      "Choose a start date before the end date.",
    ]);
  });

  it("weights the portfolio by value, then by targets, then equally", () => {
    const items = [{ ticker: "vti", weight: 3, shares: 10 }, { ticker: "BND", weight: 1, shares: 20 }];
    expect(rowsFromPortfolio(items, { VTI: 300, BND: 75 }))
      .toEqual({ basis: "value", rows: [{ ticker: "VTI", weight: 66.67 }, { ticker: "BND", weight: 33.33 }] });
    // A missing price means value weights are unknown, so the targets are used.
    expect(rowsFromPortfolio(items, { VTI: 300 }))
      .toEqual({ basis: "target", rows: [{ ticker: "VTI", weight: 75 }, { ticker: "BND", weight: 25 }] });
    const blank = rowsFromPortfolio([{ ticker: "A", weight: 0, shares: 0 }, { ticker: "B", weight: 0, shares: 0 }, { ticker: "C", weight: 0, shares: 0 }]);
    expect(blank.basis).toBe("equal");
    expect(blank.rows.map((r) => r.weight)).toEqual([33.33, 33.33, 33.33]);
  });
});
