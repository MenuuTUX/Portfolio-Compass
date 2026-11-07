import { describe, expect, it } from "bun:test";
import { deflatedSharpe, expectedMaxSharpe, normCdf, normInv, periodSharpe } from "@/lib/lab/engine/deflated-sharpe";

describe("normal helpers", () => {
  it("match known values", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 7);
    expect(normCdf(1.959964)).toBeCloseTo(0.975, 5);
    expect(normInv(0.975)).toBeCloseTo(1.959964, 5);
    expect(normInv(0.5)).toBeCloseTo(0, 9);
    expect(normCdf(normInv(0.123))).toBeCloseTo(0.123, 8);
  });
});

describe("expectedMaxSharpe", () => {
  it("is zero for a single trial and grows with the number of trials", () => {
    expect(expectedMaxSharpe(1, 1)).toBe(0);
    expect(expectedMaxSharpe(10, 1)).toBeCloseTo(1.575, 2);
    expect(expectedMaxSharpe(100, 1)).toBeGreaterThan(expectedMaxSharpe(10, 1));
  });

  it("scales with the spread of the trials", () => {
    expect(expectedMaxSharpe(10, 4)).toBeCloseTo(2 * expectedMaxSharpe(10, 1), 9);
  });
});

describe("deflatedSharpe", () => {
  const base = { sharpe: 0.1, observations: 1000, skew: 0, kurtosis: 3 };

  it("with one trial is the probability the true Sharpe is above zero", () => {
    const r = deflatedSharpe({ ...base, trials: 1, trialSharpeVariance: 0 });
    // z = 0.1 * sqrt(999) / sqrt(1 + 2 * 0.01 / 4) is about 3.15
    expect(r.probability).toBeGreaterThan(0.999);
    expect(deflatedSharpe({ ...base, sharpe: 0, trials: 1, trialSharpeVariance: 0 }).probability).toBeCloseTo(0.5, 6);
  });

  it("falls as more variants were tried", () => {
    const few = deflatedSharpe({ ...base, sharpe: 0.06, trials: 3, trialSharpeVariance: 0.0004 });
    const many = deflatedSharpe({ ...base, sharpe: 0.06, trials: 200, trialSharpeVariance: 0.0004 });
    expect(many.probability).toBeLessThan(few.probability);
    expect(many.benchmarkSharpe).toBeGreaterThan(few.benchmarkSharpe);
  });

  it("is a probability even for extreme inputs", () => {
    const r = deflatedSharpe({ sharpe: -2, observations: 5, skew: -3, kurtosis: 30, trials: 50, trialSharpeVariance: 1 });
    expect(r.probability).toBeGreaterThanOrEqual(0);
    expect(r.probability).toBeLessThanOrEqual(1);
  });
});

describe("periodSharpe", () => {
  it("is the mean excess return over the standard deviation", () => {
    const r = [0.01, -0.01, 0.02, 0.0];
    const m = 0.005;
    const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / 3);
    expect(periodSharpe(r, 0)).toBeCloseTo(m / sd, 10);
    expect(periodSharpe(r, 0.001)).toBeCloseTo((m - 0.001) / sd, 10);
  });

  it("is null when returns do not vary", () => {
    expect(periodSharpe([0.01, 0.01, 0.01], 0)).toBeNull();
  });
});
