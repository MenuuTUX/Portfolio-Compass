import { describe, expect, it } from "bun:test";
import { fromCompact, toCompact, type BarSeries } from "@/lib/lab/bar-types";
import { runBacktest, fixedTargets } from "@/lib/lab/engine/backtest";
import { buildFrame } from "@/lib/lab/engine/frame";
import { computeMetrics, dailyReturns, drawdowns } from "@/lib/lab/engine/metrics";
import { runHash } from "@/lib/lab/engine/run-hash";
import { DEFAULT_CONFIG, simulate, type BacktestConfig } from "@/lib/lab/engine/simulate";
import recorded from "@/tests/fixtures/lab-spy-agg-2023-2024.json";

const NO_COSTS: BacktestConfig = {
  ...DEFAULT_CONFIG,
  initialCash: 1000,
  costs: { commissionBps: 0, minCommission: 0, slippageBps: 0 },
};

/** Bars from [date, open, close] rows; adjClose equals close. */
function series(
  ticker: string,
  rows: [string, number, number][],
  extra: Partial<BarSeries> = {},
): BarSeries {
  return {
    ticker,
    currency: "USD",
    bars: rows.map(([date, open, close]) => ({ date, open, high: Math.max(open, close), low: Math.min(open, close), close, adjClose: close, volume: null })),
    dividends: [],
    splits: [],
    source: { provider: "Yahoo Finance", adjustment: "close: split-adjusted; adjClose: split- and dividend-adjusted", fetchedAt: "test" },
    ...extra,
  };
}

const D = ["2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"];

describe("simulate (hand-checked)", () => {
  it("fills a 50/50 target at the next open and marks at the close", () => {
    const frame = buildFrame([
      series("A", [[D[0], 10, 10], [D[1], 10, 11], [D[2], 12, 12], [D[3], 12, 13]]),
      series("B", [[D[0], 20, 20], [D[1], 20, 19], [D[2], 18, 18], [D[3], 18, 18]]),
    ], { baseCurrency: "USD" });
    const sim = simulate(frame, fixedTargets(frame, { A: 0.5, B: 0.5 }), NO_COSTS);

    // Day 2 open: $1000 buys 50 A at 10 and 25 B at 20.
    expect([...sim.equity]).toEqual([1000, 1025, 1050, 1100]);
    expect([...sim.holdings.subarray(6, 8)]).toEqual([50, 25]);
    expect(sim.trades.map((t) => [t.date, t.ticker, t.shares, t.price])).toEqual([
      [D[1], "A", 50, 10],
      [D[1], "B", 25, 20],
    ]);
  });

  it("never trades on the bar whose data produced the signal", () => {
    // The price gaps from 10 to 20 overnight; a target set at day 1's close must buy at 20.
    const frame = buildFrame([series("A", [[D[0], 10, 10], [D[1], 20, 20], [D[2], 20, 20]])], { baseCurrency: "USD" });
    for (const fill of ["next-open", "next-close"] as const) {
      const sim = simulate(frame, fixedTargets(frame, { A: 1 }), { ...NO_COSTS, fill });
      expect(sim.trades[0]).toMatchObject({ date: D[1], price: 20, shares: 50 });
      expect(sim.equity[2]).toBe(1000);
    }
  });

  it("rebalances a 50/50 portfolio back to target at each month end", () => {
    const dates = ["2024-01-30", "2024-01-31", "2024-02-01", "2024-02-29", "2024-03-01"];
    const frame = buildFrame([
      series("A", dates.map((d, i) => [d, i < 3 ? 10 : 20, i < 3 ? 10 : 20])),
      series("B", dates.map((d) => [d, 10, 10])),
    ], { baseCurrency: "USD" });
    const sim = simulate(frame, fixedTargets(frame, { A: 0.5, B: 0.5 }), {
      ...NO_COSTS,
      rebalance: { mode: "calendar", every: "M" },
    });

    // Feb 29: A doubled, so $1500 is 1000 A / 500 B. March 1 resets to 750 / 750.
    expect([...sim.holdings.subarray(8, 10)]).toEqual([37.5, 75]);
    expect(sim.trades.filter((t) => t.date === "2024-03-01").map((t) => [t.ticker, t.shares]))
      .toEqual([["A", -12.5], ["B", 25]]);
    expect(sim.equity[4]).toBe(1500);
  });

  it("rebalances only when holdings drift past the band", () => {
    const days = [...D, "2024-01-08"];
    const frame = buildFrame([
      series("A", [[days[0], 10, 10], [days[1], 10, 10], [days[2], 11, 11], [days[3], 14, 14], [days[4], 14, 14]]),
      series("B", days.map((d) => [d, 10, 10])),
    ], { baseCurrency: "USD" });
    const sim = simulate(frame, fixedTargets(frame, { A: 0.5, B: 0.5 }), {
      ...NO_COSTS,
      rebalance: { mode: "drift", band: 0.05 },
    });
    // Day 3: A is 52.4%, inside the band, so no trade on day 4.
    expect(sim.trades.filter((t) => t.date === days[3])).toEqual([]);
    // Day 4: A is 58.3% of $1200, so day 5 resets to $600 each: sell 7.142857 A, buy 10 B.
    expect(sim.trades.filter((t) => t.date === days[4]).map((t) => [t.ticker, t.shares]))
      .toEqual([["A", 600 / 14 - 50], ["B", 10]]);
  });

  it("charges slippage and a minimum commission, and never spends more than the cash", () => {
    const frame = buildFrame([series("A", [[D[0], 100, 100], [D[1], 100, 100]])], { baseCurrency: "USD" });
    const config: BacktestConfig = {
      ...NO_COSTS,
      costs: { commissionBps: 0, minCommission: 1, slippageBps: 10 },
    };
    const frac = simulate(frame, fixedTargets(frame, { A: 1 }), config);
    // Fill at 100.10; $1 commission leaves $999 for shares.
    expect(frac.trades[0].price).toBeCloseTo(100.1, 10);
    expect(frac.trades[0].shares).toBeCloseTo(999 / 100.1, 10);
    expect(frac.cash[1]).toBeCloseTo(0, 8);
    expect(frac.costsPaid).toBeCloseTo(1 + (999 / 100.1) * 0.1, 8);

    const whole = simulate(frame, fixedTargets(frame, { A: 1 }), { ...config, shares: "whole" });
    expect(whole.trades[0].shares).toBe(9);
    expect(whole.cash[1]).toBeCloseTo(1000 - 9 * 100.1 - 1, 8);
  });

  it("pays dividends on the ex-date and reinvests or holds them as cash", () => {
    const rows: [string, number, number][] = D.map((d) => [d, 10, 10]);
    const frame = buildFrame([series("A", rows, { dividends: [{ date: D[2], amount: 0.5 }] })], { baseCurrency: "USD" });
    const reinvest = simulate(frame, fixedTargets(frame, { A: 1 }), NO_COSTS);
    expect(reinvest.dividendsReceived).toBe(50);
    expect(reinvest.holdings[3]).toBe(105);
    expect(reinvest.equity[3]).toBe(1050);

    const cash = simulate(frame, fixedTargets(frame, { A: 1 }), { ...NO_COSTS, dividends: "cash" });
    expect(cash.holdings[3]).toBe(100);
    expect(cash.cash[3]).toBe(50);
    expect(cash.equity[3]).toBe(1050);
  });

  it("keeps a not-yet-listed ticker's weight in cash and says so", () => {
    const frame = buildFrame([
      series("A", D.map((d) => [d, 10, 10])),
      series("NEW", [[D[2], 5, 5], [D[3], 5, 5]]),
    ], { baseCurrency: "USD" });
    const sim = simulate(frame, fixedTargets(frame, { A: 0.5, NEW: 0.5 }), NO_COSTS);
    expect(sim.cash[1]).toBe(500);
    expect(sim.warnings.join(" ")).toContain("before its first bar");
    expect(Number.isNaN(sim.equity[0])).toBe(false);
  });

  it("rejects shorts and leverage, and treats NaN as 0", () => {
    const frame = buildFrame([series("A", D.map((d) => [d, 10, 10])), series("B", D.map((d) => [d, 10, 10]))], { baseCurrency: "USD" });
    expect(() => simulate(frame, fixedTargets(frame, { A: -0.1 }), NO_COSTS)).toThrow("must be 0 or more");
    expect(() => simulate(frame, fixedTargets(frame, { A: 0.7, B: 0.7 }), NO_COSTS)).toThrow("leverage");
    const sim = simulate(frame, fixedTargets(frame, { A: NaN, B: 1 }), NO_COSTS);
    expect(sim.warnings[0]).toContain("NaN");
    expect(sim.holdings[2]).toBe(0);
  });

  it("adds monthly contributions without counting them as returns", () => {
    const dates = ["2024-01-30", "2024-01-31", "2024-02-01", "2024-02-02", "2024-03-01"];
    const frame = buildFrame([series("A", dates.map((d) => [d, 10, 10]))], { baseCurrency: "USD" });
    const sim = simulate(frame, fixedTargets(frame, { A: 1 }), { ...NO_COSTS, cashFlow: { amount: 100, every: "M" } });
    expect([...sim.flows]).toEqual([0, 0, 100, 0, 100]);
    expect(sim.equity[4]).toBe(1200);
    expect(sim.holdings[4]).toBe(120);
    const metrics = computeMetrics(frame.dates, sim, { initialCash: 1000 });
    expect(metrics.totalReturn).toBeCloseTo(0, 12);
    expect(metrics.netContributions).toBe(1200);
  });

  it("counts a contribution as invested for the day it arrives", () => {
    // $1000 in, then $1000 more on Feb 1, a day the price rises 10%: that day returns +10%, not +20%.
    const dates = ["2024-01-30", "2024-01-31", "2024-02-01"];
    const frame = buildFrame([series("A", [[dates[0], 10, 10], [dates[1], 10, 10], [dates[2], 10, 11]])], { baseCurrency: "USD" });
    const contribution = simulate(frame, fixedTargets(frame, { A: 1 }), { ...NO_COSTS, cashFlow: { amount: 1000, every: "M" } });
    expect(contribution.equity[2]).toBeCloseTo(2200, 9);
    expect(dailyReturns(contribution.equity, contribution.flows)[2]).toBeCloseTo(0.1, 12);

    // Withdrawing $900 of $1000 the same day leaves $100 that earns 10%.
    const withdrawal = simulate(frame, fixedTargets(frame, { A: 1 }), { ...NO_COSTS, cashFlow: { amount: -900, every: "M" } });
    expect(withdrawal.equity[2]).toBeCloseTo(110, 9);
    expect(dailyReturns(withdrawal.equity, withdrawal.flows)[2]).toBeCloseTo(0.1, 12);
  });
});

describe("currencies", () => {
  const cad = series("XIC.TO", [[D[0], 40, 40], [D[1], 40, 40]], { currency: "CAD" });

  it("refuses to mix currencies without an FX series", () => {
    expect(() => buildFrame([cad], { baseCurrency: "USD" })).toThrow("FX series is required");
  });

  it("converts prices and dividends at the dated rate", () => {
    const frame = buildFrame([{ ...cad, dividends: [{ date: D[1], amount: 1 }] }], {
      baseCurrency: "USD",
      fx: { CAD: [{ date: "2023-12-29", rate: 0.75 }, { date: D[1], rate: 0.8 }] },
    });
    expect([...frame.close]).toEqual([30, 32]);
    expect(frame.dividend[1]).toBeCloseTo(0.8, 12);
  });

  it("refuses a date with no rate on or before it", () => {
    expect(() => buildFrame([cad], { baseCurrency: "USD", fx: { CAD: [{ date: D[1], rate: 0.8 }] } }))
      .toThrow(`No CAD FX rate on or before ${D[0]}`);
  });
});

describe("metrics", () => {
  it("finds the deepest drawdown, its recovery, and the longest one", () => {
    const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06"];
    const { max, longestDays } = drawdowns(dates, [1, 1.2, 0.9, 1.0, 1.3, 1.25]);
    expect(max).toEqual({ depth: 0.9 / 1.2 - 1, peak: "2024-01-02", trough: "2024-01-03", recovered: "2024-01-05" });
    expect(longestDays).toBe(3);
  });

  it("annualizes a doubling over one calendar year", () => {
    const dates = ["2023-01-02", "2023-07-03", "2024-01-02"];
    const m = computeMetrics(dates, {
      equity: Float64Array.from([100, 150, 200]),
      flows: new Float64Array(3),
      trades: [],
      costsPaid: 0,
      dividendsReceived: 0,
    }, { initialCash: 100 });
    expect(m.totalReturn).toBeCloseTo(1, 12);
    expect(m.cagr).toBeCloseTo(2 ** (365.25 / 365) - 1, 12);
    expect(m.maxDrawdown).toBeNull();
  });

  it("gives a beta of 1 and alpha of 0 against itself", () => {
    const equity = Float64Array.from([100, 101, 99, 103, 102]);
    const m = computeMetrics(D.concat("2024-01-08"), {
      equity, flows: new Float64Array(5), trades: [], costsPaid: 0, dividendsReceived: 0,
    }, { initialCash: 100, benchmark: equity });
    expect(m.beta).toBeCloseTo(1, 12);
    expect(m.alpha).toBeCloseTo(0, 12);
  });
});

describe("golden runs on recorded SPY and AGG, 2023-2024", () => {
  const data = recorded as BarSeries[];
  const spy = data[0];

  it("buy-and-hold SPY with dividends reinvested tracks Yahoo's adjusted total return", async () => {
    const report = await runBacktest({
      series: [spy],
      config: { ...NO_COSTS, initialCash: 100_000 },
      baseCurrency: "USD",
      targets: { SPY: 1 },
    });
    const e = report.sim.equity;
    // Invested at day 2's open, so compare from day 2's close.
    const engine = e[e.length - 1] / e[1];
    const adjusted = spy.bars.at(-1)!.adjClose / spy.bars[1].adjClose;
    expect(Math.abs(engine / adjusted - 1)).toBeLessThan(0.0005);
    expect(report.metrics.dividendsReceived).toBeGreaterThan(0);
  });

  it("a monthly 60/40 matches an independent adjusted-close reference", async () => {
    const report = await runBacktest({
      series: data,
      config: { ...NO_COSTS, initialCash: 100_000, fill: "next-close", rebalance: { mode: "calendar", every: "M" } },
      baseCurrency: "USD",
      targets: { SPY: 0.6, AGG: 0.4 },
      benchmark: "SPY",
    });

    // Reference: hold units of adjusted closes, reset to 60/40 at the close
    // of each month's first bar (the bar the engine fills on).
    const [s, a] = [data[0].bars, data[1].bars];
    let value = 1;
    let units = [0, 0];
    for (let t = 1; t < s.length; t++) {
      if (t === 1 || s[t].date.slice(0, 7) !== s[t - 1].date.slice(0, 7)) {
        if (t > 1) value = units[0] * s[t].adjClose + units[1] * a[t].adjClose;
        units = [(0.6 * value) / s[t].adjClose, (0.4 * value) / a[t].adjClose];
      }
    }
    const reference = units[0] * s.at(-1)!.adjClose + units[1] * a.at(-1)!.adjClose;
    const engine = report.sim.equity.at(-1)! / report.sim.equity[1];
    expect(Math.abs(engine / reference - 1)).toBeLessThan(0.0005);

    expect(report.benchmark?.ticker).toBe("SPY");
    expect(report.metrics.beta).toBeGreaterThan(0.4);
    expect(report.metrics.beta).toBeLessThan(0.8);
    expect(report.metrics.monthlyReturns).toHaveLength(24);
  });

  it("gives the same result after the compact transport's rounding", async () => {
    const run = (series: BarSeries[]) => runBacktest({
      series,
      config: { ...NO_COSTS, initialCash: 100_000, rebalance: { mode: "calendar", every: "M" } },
      baseCurrency: "USD",
      targets: { SPY: 0.6, AGG: 0.4 },
    });
    const exact = await run(data);
    const rounded = await run(data.map((s) => fromCompact(toCompact(s, "2024-12-31"))));
    expect(Math.abs(rounded.sim.equity.at(-1)! / exact.sim.equity.at(-1)! - 1)).toBeLessThan(1e-6);
  });

  it("reproduces the same numbers and hash, and the hash changes with settings", async () => {
    const request = {
      series: data,
      config: { ...DEFAULT_CONFIG, rebalance: { mode: "calendar", every: "Q" } } as BacktestConfig,
      baseCurrency: "USD",
      targets: { SPY: 0.6, AGG: 0.4 },
      strategy: { code: "fixed", params: { spy: 0.6 } },
    };
    const a = await runBacktest(request);
    const b = await runBacktest(request);
    expect(b.hash).toBe(a.hash);
    expect([...b.sim.equity]).toEqual([...a.sim.equity]);

    const c = await runBacktest({ ...request, strategy: { code: "fixed", params: { spy: 0.7 } } });
    expect(c.hash).not.toBe(a.hash);
    const frame = buildFrame(data, { baseCurrency: "USD" });
    expect(await runHash(frame, {}, { code: "x" })).toMatch(/^[0-9a-f]{64}$/);
  });
});
