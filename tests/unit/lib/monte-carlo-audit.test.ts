import { describe, expect, it } from "bun:test";
import { calculateCovarianceMatrix } from "@/lib/math/stats";
import {
  createRandom,
  dropOutlierDays,
  rebaseLogDrift,
  simulatePaths,
} from "@/lib/monte-carlo";

const randomSeries = (seed: number, length: number, scale: number, drift = 0) => {
  const random = createRandom(seed);
  return Array.from({ length }, () => drift + (random() - 0.5) * scale);
};

const stdev = (values: number[]) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
};

describe("rebaseLogDrift", () => {
  it("moves the weighted annual drift to the target", () => {
    const returns = [
      randomSeries(1, 300, 0.02, 0.0004),
      randomSeries(2, 300, 0.01, 0.0001),
    ];
    const weights = [0.6, 0.4];
    const rebased = rebaseLogDrift(returns, weights, 0.05, 252);

    const annual = rebased.reduce(
      (sum, row, i) => sum + weights[i] * (row.reduce((a, b) => a + b, 0) / row.length) * 252,
      0,
    );
    expect(annual).toBeCloseTo(0.05, 12);
  });

  it("keeps volatility and correlation unchanged", () => {
    const returns = [
      randomSeries(3, 300, 0.02, 0.0002),
      randomSeries(4, 300, 0.015, -0.0003),
    ];
    const before = calculateCovarianceMatrix(returns);
    const rebased = rebaseLogDrift(returns, [0.5, 0.5], 0.08, 252);
    const after = calculateCovarianceMatrix(rebased);

    expect(stdev(rebased[0])).toBeCloseTo(stdev(returns[0]), 12);
    expect(stdev(rebased[1])).toBeCloseTo(stdev(returns[1]), 12);
    const corrBefore = before[0][1] / Math.sqrt(before[0][0] * before[1][1]);
    const corrAfter = after[0][1] / Math.sqrt(after[0][0] * after[1][1]);
    expect(corrAfter).toBeCloseTo(corrBefore, 12);
  });

  it("does not mutate the input", () => {
    const returns = [[0.01, -0.02, 0.005], [0.002, 0.001, -0.001]];
    const copy = returns.map((row) => [...row]);
    rebaseLogDrift(returns, [0.5, 0.5], 0.1, 252);
    expect(returns).toEqual(copy);
  });
});

describe("dropOutlierDays", () => {
  it("removes the date index for every asset when any asset breaks the limit", () => {
    const returns = [
      [0.01, 0.5, 0.01, -0.02],
      [0.01, 0.01, -0.4, 0.01],
    ];
    const result = dropOutlierDays(returns);

    expect(result.dropped).toBe(2);
    expect(result.returns).toEqual([
      [0.01, -0.02],
      [0.01, 0.01],
    ]);
  });

  it("keeps a return that is exactly at the limit", () => {
    const result = dropOutlierDays([[0.35, -0.35, 0.1]]);
    expect(result.dropped).toBe(0);
    expect(result.returns).toEqual([[0.35, -0.35, 0.1]]);
  });

  it("honours a custom limit", () => {
    const result = dropOutlierDays([[0.05, 0.12, -0.01]], 0.1);
    expect(result.dropped).toBe(1);
    expect(result.returns).toEqual([[0.05, -0.01]]);
  });
});

describe("simulatePaths contributions", () => {
  const flatReturns = () => [new Array(252).fill(0), new Array(252).fill(0)];

  it("ends at initial value plus all contributions when returns are flat", () => {
    // 10 years of 252 trading days, one 100 contribution every 21 days = 12 a year.
    for (const mode of ["reshuffle", "resample"] as const) {
      const run = simulatePaths(mode, {
        returns: flatReturns(),
        currentPrices: [10, 20],
        weights: [0.5, 0.5],
        initialValue: 10000,
        numPaths: 3,
        numDays: 2520,
        seed: 5,
        contribution: { amount: 100, everyDays: 21 },
      });
      for (const path of run.paths) {
        expect(path[path.length - 1]).toBeCloseTo(10000 + 120 * 100, 6);
      }
      expect(run.paths[0][21]).toBeCloseTo(10100, 9);
    }
  });

  it("adds exactly the contribution to the value on the contribution day", () => {
    const returns = [randomSeries(8, 300, 0.02), randomSeries(9, 300, 0.01)];
    const base = {
      returns,
      currentPrices: [10, 20],
      weights: [0.7, 0.3],
      initialValue: 5000,
      numPaths: 2,
      numDays: 120,
      seed: 11,
    };
    for (const mode of ["reshuffle", "resample", "randomize"] as const) {
      const plain = simulatePaths(mode, base);
      const withContribution = simulatePaths(mode, {
        ...base,
        contribution: { amount: 250, everyDays: 30 },
      });
      for (let p = 0; p < base.numPaths; p++) {
        expect(withContribution.paths[p][30] - plain.paths[p][30]).toBeCloseTo(250, 6);
        expect(withContribution.paths[p][29]).toBeCloseTo(plain.paths[p][29], 9);
      }
    }
  });

  it("is unchanged when the contribution amount is zero", () => {
    const returns = [randomSeries(12, 300, 0.02), randomSeries(13, 300, 0.01)];
    const base = {
      returns,
      currentPrices: [10, 20],
      weights: [0.5, 0.5],
      initialValue: 5000,
      numPaths: 2,
      numDays: 60,
      seed: 3,
    };
    const plain = simulatePaths("randomize", base);
    const zero = simulatePaths("randomize", { ...base, contribution: { amount: 0, everyDays: 10 } });
    expect(zero.paths).toEqual(plain.paths);
  });

  it("never lets wealth go negative on a withdrawal", () => {
    const run = simulatePaths("reshuffle", {
      returns: flatReturns(),
      currentPrices: [10, 20],
      weights: [0.5, 0.5],
      initialValue: 10000,
      numPaths: 1,
      numDays: 100,
      seed: 1,
      contribution: { amount: -20000, everyDays: 10 },
    });
    expect(run.paths[0].every((v) => v >= 0)).toBe(true);
    expect(run.paths[0][run.paths[0].length - 1]).toBe(0);
  });

  it("rejects a contribution interval that is not a positive whole number of days", () => {
    expect(() => simulatePaths("reshuffle", {
      returns: flatReturns(),
      currentPrices: [10, 20],
      weights: [0.5, 0.5],
      initialValue: 1000,
      numPaths: 1,
      numDays: 10,
      contribution: { amount: 10, everyDays: 0 },
    })).toThrow(RangeError);
  });
});
