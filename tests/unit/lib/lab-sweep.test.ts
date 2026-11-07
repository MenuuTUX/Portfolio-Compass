import { describe, expect, it } from "bun:test";
import { series, weekdays } from "@/tests/helpers/lab-series";
import { runBacktest } from "@/lib/lab/engine/backtest";
import { DEFAULT_CONFIG } from "@/lib/lab/engine/simulate";
import { sweepTrend, sweepValues, type TrendStrategy } from "@/lib/lab/engine/sweep";

/** A wavy uptrend, so moving averages of different lengths trade differently. */
function wave(n: number): number[] {
  return Array.from({ length: n }, (_, t) => 100 * Math.exp(0.0003 * t + 0.08 * Math.sin(t / 15) + 0.03 * Math.sin(t / 4)));
}

const strategy: TrendStrategy = { kind: "trend", allocation: { A: 1 }, smaDays: 50, safe: "S" };
const base = (n: number) => ({
  series: [series("A", wave(n)), series("S", Array.from({ length: n }, (_, t) => 100 + t * 0.01))],
  config: DEFAULT_CONFIG,
  baseCurrency: "USD",
  strategy,
});

describe("sweepTrend", () => {
  it("matches a normal run of each value, hash included", async () => {
    const req = { ...base(900), values: [20, 60, 120] };
    const sweep = await sweepTrend(req);
    expect(sweep.points.map((p) => p.value)).toEqual([20, 60, 120]);
    for (const p of sweep.points) {
      const run = await runBacktest({ ...req, targets: { strategy: { ...strategy, smaDays: p.value } }, strategy: { code: JSON.stringify({ ...strategy, smaDays: p.value }) } });
      expect(p.hash).toBe(run.hash);
      expect(p.cagr).toBe(run.metrics.cagr);
      expect(p.sharpe).toBe(run.metrics.sharpe);
      expect(p.maxDrawdown).toBe(run.metrics.maxDrawdown?.depth ?? null);
    }
    expect(new Set(sweep.points.map((p) => p.hash)).size).toBe(3);
  });

  it("names the best value by Sharpe, which it calls out as chosen with hindsight", async () => {
    const sweep = await sweepTrend({ ...base(900), values: [20, 60, 120] });
    const top = [...sweep.points].sort((a, b) => (b.sharpe ?? -Infinity) - (a.sharpe ?? -Infinity))[0];
    expect(sweep.bestValue).toBe(top.value);
  });

  it("includes a walk-forward result only when the history is long enough", async () => {
    expect((await sweepTrend({ ...base(900), values: [20, 60] })).walkForward).toBeNull();
    const long = await sweepTrend({ ...base(2000), values: [20, 60, 120] });
    expect(long.walkForward).not.toBeNull();
    expect(long.walkForward!.windows.length).toBe(4);
  });

  it("adds the run's own length to the default list, sorted", () => {
    expect(sweepValues(75)).toEqual([20, 50, 75, 100, 150, 200, 250, 300]);
    expect(sweepValues(200)).toEqual([20, 50, 100, 150, 200, 250, 300]);
  });
});

describe("sweepTrend with a start date", () => {
  it("reports from the start date while still using the history before it", async () => {
    const n = 400;
    const startDate = weekdays(n)[300];
    const result = await sweepTrend({
      ...base(n),
      strategy: { ...strategy, smaDays: 200 },
      values: [50, 200],
      start: startDate,
    });
    expect(result.startDate).toBe(startDate);
    expect(result.points).toHaveLength(2);
  });
});

describe("sweepTrend deflation", () => {
  it("reports how the best value holds up after trying every value", async () => {
    const result = await sweepTrend({ ...base(800), values: [20, 50, 100, 150, 200] });
    expect(result.deflated).not.toBeNull();
    expect(result.deflated!.trials).toBe(5);
    expect(result.deflated!.probability).toBeGreaterThanOrEqual(0);
    expect(result.deflated!.probability).toBeLessThanOrEqual(1);
    expect(result.deflated!.luckSharpe).toBeGreaterThan(0);
  });

  it("has nothing to deflate with a single value", async () => {
    const result = await sweepTrend({ ...base(800), values: [50] });
    expect(result.deflated).toBeNull();
  });
});
