import { describe, expect, it } from "bun:test";
import type { BarSeries } from "@/lib/lab/bar-types";
import { buildFrame } from "@/lib/lab/engine/frame";
import { runBacktest } from "@/lib/lab/engine/backtest";
import { periodsPerYear } from "@/lib/lab/engine/metrics";
import { DEFAULT_CONFIG, simulate, type BacktestConfig } from "@/lib/lab/engine/simulate";
import recorded from "@/tests/fixtures/lab-spy-agg-2023-2024.json";

const NO_COSTS: BacktestConfig = {
  ...DEFAULT_CONFIG,
  initialCash: 1000,
  costs: { commissionBps: 0, minCommission: 0, slippageBps: 0 },
};

const consecutive = (n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.UTC(2024, 0, 2) + i * 864e5).toISOString().slice(0, 10));

function series(ticker: string, days: string[], price: (i: number) => number): BarSeries {
  return {
    ticker,
    currency: "USD",
    bars: days.map((date, i) => ({ date, open: price(i), close: price(i), adjClose: price(i) })),
    dividends: [],
    splits: [],
    source: { provider: "Yahoo Finance", adjustment: "close: split-adjusted; adjClose: split- and dividend-adjusted", fetchedAt: "test" },
  } as BarSeries;
}

describe("periods per year", () => {
  it("keeps 252 for a US trading calendar", () => {
    const frame = buildFrame(recorded as unknown as BarSeries[], { baseCurrency: "USD" });
    expect(periodsPerYear(frame.dates)).toBe(252);
  });

  it("uses about 365 for an asset that trades every day", () => {
    expect(periodsPerYear(consecutive(366))).toBe(365);
  });

  it("annualizes volatility with the real number of periods", async () => {
    const days = consecutive(366);
    let p = 100;
    const bars = days.map((d, i) => {
      p *= i % 2 ? 1.01 : 0.99;
      return { date: d, open: p, close: p, adjClose: p };
    });
    const s = { ...series("BTC-USD", days, () => 1), bars } as BarSeries;
    const r = await runBacktest({ series: [s], config: NO_COSTS, baseCurrency: "USD", targets: { "BTC-USD": 1 } });

    const e = r.sim.equity;
    const x: number[] = [];
    for (let t = 1; t < e.length; t++) x.push(e[t] / e[t - 1] - 1);
    const m = x.reduce((a, b) => a + b, 0) / x.length;
    const sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
    expect(r.metrics.volatility).toBeCloseTo(sd * Math.sqrt(365), 2);
  });
});

describe("turnover", () => {
  it("is near zero for buy and hold", async () => {
    const r = await runBacktest({ series: [(recorded as unknown as BarSeries[])[0]], config: NO_COSTS, baseCurrency: "USD", targets: { SPY: 1 } });
    expect(r.metrics.turnover).toBeLessThan(0.05);
  });

  it("is large for a strategy that switches assets often", async () => {
    const days = consecutive(120);
    const A = series("A", days, (i) => 100 + i * 0.1);
    const B = series("B", days, (i) => 100 + i * 0.05);
    const matrix = new Float64Array(days.length * 2);
    for (let t = 0; t < days.length; t++) matrix[t * 2 + (Math.floor(t / 10) % 2)] = 1;
    const r = await runBacktest({ series: [A, B], config: NO_COSTS, baseCurrency: "USD", targets: matrix });
    expect(r.metrics.turnover).toBeGreaterThan(5);
  });
});

describe("cash interest and the risk-free rate", () => {
  it("pays interest on idle cash when a cash rate is set", () => {
    const days = consecutive(366);
    const frame = buildFrame([series("A", days, () => 10)], { baseCurrency: "USD" });
    const none = new Float64Array(days.length);
    const sim = simulate(frame, none, { ...NO_COSTS, cashRate: 0.05 });
    expect(sim.equity[days.length - 1]).toBeGreaterThan(1049);
    expect(sim.equity[days.length - 1]).toBeLessThan(1051);

    const flat = simulate(frame, none, NO_COSTS);
    expect(flat.equity[days.length - 1]).toBe(1000);
  });

  it("uses the cash rate as the risk-free rate in Sharpe", async () => {
    const spy = (recorded as unknown as BarSeries[])[0];
    const at = (cashRate: number) =>
      runBacktest({ series: [spy], config: { ...NO_COSTS, cashRate }, baseCurrency: "USD", targets: { SPY: 1 } });
    const zero = (await at(0)).metrics.sharpe!;
    const four = (await at(0.04)).metrics.sharpe!;
    expect(four).toBeLessThan(zero - 0.2);
  });
});
