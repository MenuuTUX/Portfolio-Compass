import { describe, expect, it } from "bun:test";
import { MIN_TRAIN_BARS, walkForward } from "@/lib/lab/engine/walkforward";

function weekdays(n: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(2010, 0, 1));
  while (out.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Seeded uniform numbers in [0, 1), so the tests never flake. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Daily returns with mean `drift` and noise of about `vol`, index 0 the base bar. */
function noise(n: number, drift: number, vol: number, next: () => number): Float64Array {
  const r = new Float64Array(n);
  for (let t = 1; t < n; t++) r[t] = drift + (next() + next() + next() - 1.5) * 2 * vol;
  return r;
}

describe("walkForward", () => {
  it("an overfit parameter wins in-sample and loses walk-forward", () => {
    // 24 candidates that are pure noise with no edge. Picking the best in hindsight finds a
    // flattering Sharpe; picking on past windows and applying it forward does not.
    const T = 2521;
    const next = rng(7);
    const values = Array.from({ length: 24 }, (_, i) => i + 1);
    const returns = values.map(() => noise(T, 0, 0.01, next));
    const wf = walkForward({ dates: weekdays(T), values, returns, trainBars: 504, testBars: 252 })!;
    expect(wf.windows.length).toBe(8);
    expect(wf.inSampleBest.sharpe!).toBeGreaterThan(0.5);
    expect(wf.outOfSample.sharpe!).toBeLessThan(wf.inSampleBest.sharpe! - 0.4);
    // The choice does not carry over: the winner of a train window is not the winner of the test window.
    const lost = wf.windows.filter((w) => w.testSharpe! < w.trainSharpe!).length;
    expect(lost).toBeGreaterThanOrEqual(6);
  });

  it("keeps choosing a value with a real edge and earns it out of sample", () => {
    const T = 1765;
    const next = rng(11);
    const values = [10, 20, 30, 40];
    const returns = values.map((v) => noise(T, v === 30 ? 0.0006 : 0, 0.004, next));
    const wf = walkForward({ dates: weekdays(T), values, returns, trainBars: 504, testBars: 252 })!;
    expect(wf.windows.filter((w) => w.chosen === 30).length).toBeGreaterThanOrEqual(4);
    expect(wf.outOfSample.cagr).toBeGreaterThan(0.05);
    expect(wf.inSampleBest.value).toBe(30);
  });

  it("stitches test windows with no gaps and no fill", () => {
    // Value 1 drifts up with a little alternating noise; value 2 only has the noise.
    const T = 1 + 126 + 3 * 200;
    const dates = weekdays(T);
    const wiggle = (drift: number) => Float64Array.from({ length: T }, (_, t) => (t === 0 ? 0 : drift + (t % 2 ? 0.002 : -0.002)));
    const up = wiggle(0.001);
    const wf = walkForward({ dates, values: [1, 2], returns: [up, wiggle(0)], trainBars: 126, testBars: 200 })!;
    expect(wf.windows.map((w) => w.chosen)).toEqual([1, 1, 1]);
    expect(wf.dates.length).toBe(3 * 200 + 1);
    expect(wf.dates[1]).toBe(wf.windows[0].testStart);
    expect(wf.dates.at(-1)).toBe(wf.windows[2].testEnd);
    let expected = 1;
    for (let t = 1 + 126; t < T; t++) expected *= 1 + up[t];
    expect(wf.equity.at(-1)).toBeCloseTo(expected, 9);
    expect(wf.equity.length).toBe(wf.dates.length);
  });

  it("does not treat a missing return as zero: that value is ineligible for the window", () => {
    const T = 1 + 4 * 150;
    const wiggle = (drift: number) => Float64Array.from({ length: T }, (_, t) => (t === 0 ? 0 : drift + (t % 2 ? 0.002 : -0.002)));
    const good = wiggle(0.0005);
    const better = wiggle(0.003); // would win every window if it were eligible
    better[200] = NaN; // inside the first window (train bars 1..126, test bars 127..276)
    const wf = walkForward({ dates: weekdays(T), values: [1, 2], returns: [good, better], trainBars: 126, testBars: 150 })!;
    expect(wf.windows[0].chosen).toBe(1);
    expect(wf.windows[1].chosen).toBe(1); // bar 200 is in this window's train bars too
    expect(wf.windows[2].chosen).toBe(2);
    expect(Number.isFinite(wf.outOfSample.cagr)).toBe(true);
  });

  it("returns null when the history is too short for two windows, or the windows are too small", () => {
    const T = 400;
    const r = new Float64Array(T);
    expect(walkForward({ dates: weekdays(T), values: [1, 2], returns: [r, r], trainBars: 252, testBars: 252 })).toBeNull();
    expect(walkForward({ dates: weekdays(T), values: [1, 2], returns: [r, r], trainBars: MIN_TRAIN_BARS - 1, testBars: 50 })).toBeNull();
    expect(walkForward({ dates: weekdays(T), values: [1], returns: [r], trainBars: 126, testBars: 50 })).toBeNull();
  });
});
