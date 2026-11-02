import { describe, expect, it } from "bun:test";
import { MIN_SLICE_BARS, splitMetrics } from "@/lib/lab/engine/holdout";

function weekdays(n: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(2020, 0, 1));
  while (out.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Equity that grows `up` a day for the first `at` bars, then `down` a day. */
function curve(n: number, at: number, up: number, down: number): Float64Array {
  const eq = new Float64Array(n);
  eq[0] = 1000;
  for (let t = 1; t < n; t++) eq[t] = eq[t - 1] * (1 + (t <= at ? up : down));
  return eq;
}

const sim = (equity: Float64Array, flows = new Float64Array(equity.length)) => ({ equity, flows, trades: [] });

describe("splitMetrics", () => {
  it("shows a rule that only worked early: strong in-sample, falling in the hold-out", () => {
    const dates = weekdays(500);
    const split = splitMetrics(dates, sim(curve(500, 349, 0.001, -0.001)))!;
    expect(split.inSample.cagr).toBeGreaterThan(0.2);
    expect(split.holdout.cagr).toBeLessThan(0);
    expect(split.holdout.maxDrawdown!.depth).toBeLessThan(-0.1);
  });

  it("splits by bar count and starts the hold-out on the first bar it earns a return", () => {
    const dates = weekdays(1001);
    const split = splitMetrics(dates, sim(curve(1001, 0, 0, 0)), { holdoutFraction: 0.3 })!;
    expect(split.inSample.startDate).toBe(dates[0]);
    expect(split.inSample.endDate).toBe(dates[700]);
    expect(split.splitDate).toBe(dates[701]);
    expect(split.holdout.startDate).toBe(dates[700]);
    expect(split.holdout.endDate).toBe(dates[1000]);
  });

  it("does not count contributions as performance", () => {
    const dates = weekdays(400);
    const equity = new Float64Array(400);
    const flows = new Float64Array(400);
    equity[0] = 1000;
    for (let t = 1; t < 400; t++) {
      if (t % 20 === 0) flows[t] = 500;
      equity[t] = (equity[t - 1] + flows[t]) * 1.0005;
    }
    const split = splitMetrics(dates, sim(equity, flows))!;
    expect(split.inSample.totalReturn).toBeCloseTo(1.0005 ** 279 - 1, 3);
    expect(split.holdout.volatility).toBeLessThan(1e-9);
  });

  it("returns null when a piece is too short to mean anything", () => {
    const dates = weekdays(MIN_SLICE_BARS + 10);
    expect(splitMetrics(dates, sim(curve(dates.length, 0, 0.001, 0.001)))).toBeNull();
  });

  it("rejects a fraction outside 0 to 1", () => {
    const dates = weekdays(300);
    expect(() => splitMetrics(dates, sim(curve(300, 0, 0, 0)), { holdoutFraction: 1 })).toThrow(RangeError);
  });
});
