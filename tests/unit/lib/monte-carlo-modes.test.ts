import { describe, it, expect } from 'bun:test';
import {
  createRandom,
  generateMonteCarloPaths,
  simulatePaths,
  fitReturnModel,
  summarizeOutcomes,
  maxDrawdown,
  returnHistogram,
  medianPathIndex,
  type SimulationInput,
} from '@/lib/monte-carlo';

/** Deterministic pseudo returns, about +-1.5% a day. */
function history(T: number, seed: number, drift = 0.0003): number[] {
  const random = createRandom(seed);
  return Array.from({ length: T }, () => drift + (random() - 0.5) * 0.03);
}

const T = 50;
const twoAssets = [history(T, 1), history(T, 2, 0.0001)];
const base: SimulationInput = {
  returns: twoAssets,
  currentPrices: [100, 40],
  weights: [0.6, 0.4],
  initialValue: 10_000,
  numPaths: 25,
  numDays: T * 3,
  seed: 7,
};

/** Buy-and-hold value after replaying every day once, in any order. */
function expectedReshuffleEnd(input: SimulationInput, copies: number) {
  return input.weights.reduce((sum, w, i) => {
    const total = input.returns[i].reduce((a, b) => a + b, 0) * copies;
    return sum + input.initialValue * w * Math.exp(total);
  }, 0);
}

describe('createRandom', () => {
  it('repeats a sequence for the same seed', () => {
    const a = createRandom(99);
    const b = createRandom(99);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });
});

describe('simulatePaths: reshuffle', () => {
  const run = simulatePaths('reshuffle', base);

  it('ends every path at the same value', () => {
    const expected = expectedReshuffleEnd(base, 3);
    for (const path of run.paths) {
      expect(path[path.length - 1] / expected).toBeCloseTo(1, 9);
    }
  });

  it('takes different routes to get there', () => {
    const mids = new Set(run.paths.map((p) => p[T].toFixed(6)));
    expect(mids.size).toBeGreaterThan(1);
  });

  it('replays each historical day exactly once per copy', () => {
    // Single asset whose return encodes the day index, so the step returns can be read back.
    const returns = [Array.from({ length: 10 }, (_, t) => (t + 1) * 1e-4)];
    const one = simulatePaths('reshuffle', {
      ...base, returns, currentPrices: [10], weights: [1], numPaths: 1, numDays: 20,
    });
    const steps = one.paths[0].slice(1).map((v, k) => Math.log(v / one.paths[0][k]));
    const sorted = steps.map((r) => Math.round(r / 1e-4)).sort((a, b) => a - b);
    expect(sorted).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]);
  });

  it('includes the historical order as a reference path that ends at the same value', () => {
    expect(run.referencePath).toBeDefined();
    const ref = run.referencePath!;
    expect(ref[ref.length - 1] / run.paths[0][run.paths[0].length - 1]).toBeCloseTo(1, 9);
    // First step of the reference is the first historical day.
    const firstDay = base.weights.reduce((s, w, i) => s + base.initialValue * w * Math.exp(base.returns[i][0]), 0);
    expect(ref[1]).toBeCloseTo(firstDay, 8);
  });

  it('is reproducible for a seed', () => {
    expect(simulatePaths('reshuffle', base).paths).toEqual(run.paths);
  });
});

describe('simulatePaths: resample', () => {
  const run = simulatePaths('resample', { ...base, numPaths: 200 });

  it('produces different ending values', () => {
    const ends = new Set(run.paths.map((p) => p[p.length - 1].toFixed(4)));
    expect(ends.size).toBeGreaterThan(100);
  });

  it('keeps every asset return from the same historical day together', () => {
    // Asset 2 returns are exactly double asset 1, so any mixing of days would break the ratio.
    const a = history(T, 3);
    const one = simulatePaths('resample', {
      ...base, returns: [a, a.map((r) => 2 * r)], currentPrices: [10, 10], weights: [0.5, 0.5], numPaths: 1, numDays: 40,
    });
    // Recover asset 1's daily return from the portfolio value via the 50/50 identity is awkward,
    // so check against direct replay: each step must equal some historical day.
    const valueAfter = (la: number) => 5_000 * Math.exp(la) + 5_000 * Math.exp(2 * la);
    let la = 0;
    for (let k = 1; k < one.paths[0].length; k++) {
      const match = a.find((r) => Math.abs(valueAfter(la + r) - one.paths[0][k]) < 1e-6);
      expect(match).toBeDefined();
      la += match!;
    }
  });

  it('copies whole blocks of consecutive days when blockDays is set', () => {
    const returns = [Array.from({ length: 30 }, (_, t) => (t + 1) * 1e-4)];
    const one = simulatePaths('resample', {
      ...base, returns, currentPrices: [10], weights: [1], numPaths: 1, numDays: 21, blockDays: 7, seed: 3,
    });
    const days = one.paths[0].slice(1).map((v, k) => Math.round(Math.log(v / one.paths[0][k]) / 1e-4) - 1);
    for (let block = 0; block < 3; block++) {
      for (let j = 1; j < 7; j++) {
        expect(days[block * 7 + j]).toBe((days[block * 7] + j) % 30);
      }
    }
  });

  it('has a mean ending log value close to the historical drift', () => {
    const big = simulatePaths('resample', {
      ...base, returns: [twoAssets[0]], currentPrices: [100], weights: [1], numPaths: 4000, numDays: 252, stepDays: 21,
    });
    const meanDaily = twoAssets[0].reduce((a, b) => a + b, 0) / T;
    const meanLog = big.paths.reduce((s, p) => s + Math.log(p[p.length - 1] / 10_000), 0) / 4000;
    expect(meanLog).toBeCloseTo(meanDaily * 252, 1);
  });
});

describe('simulatePaths: randomize', () => {
  it('matches generateMonteCarloPaths with the fitted model and the same seed', () => {
    const { meanReturns, cholesky } = fitReturnModel(base.returns);
    const direct = generateMonteCarloPaths(base.currentPrices, base.weights, meanReturns, cholesky, 25, T * 3, 10_000, 7);
    expect(simulatePaths('randomize', base).paths).toEqual(direct);
  });
});

describe('simulatePaths: stepDays', () => {
  it.each(['reshuffle', 'resample'] as const)('%s with 21-day steps equals the daily run sampled every 21 days', (mode) => {
    const daily = simulatePaths(mode, { ...base, numDays: 105 });
    const monthly = simulatePaths(mode, { ...base, numDays: 105, stepDays: 21 });
    expect(monthly.days).toEqual([0, 21, 42, 63, 84, 105]);
    monthly.paths.forEach((path, i) => {
      path.forEach((v, k) => expect(v).toBeCloseTo(daily.paths[i][monthly.days[k]], 8));
    });
  });

  it('records a shorter final step when the horizon is not a multiple', () => {
    const run = simulatePaths('resample', { ...base, numDays: 50, stepDays: 21 });
    expect(run.days).toEqual([0, 21, 42, 50]);
  });
});

describe('simulatePaths validation', () => {
  it('rejects ragged return rows', () => {
    expect(() => simulatePaths('resample', { ...base, returns: [history(10, 1), history(9, 2)] })).toThrow(RangeError);
  });
  it('rejects empty history', () => {
    expect(() => simulatePaths('reshuffle', { ...base, returns: [[], []] })).toThrow(RangeError);
  });
  it('rejects block lengths outside the history', () => {
    expect(() => simulatePaths('resample', { ...base, blockDays: 0 })).toThrow(RangeError);
    expect(() => simulatePaths('resample', { ...base, blockDays: T + 1 })).toThrow(RangeError);
  });
});

describe('summaries', () => {
  it('maxDrawdown is 0 for a rising path and finds the deepest fall', () => {
    expect(maxDrawdown([1, 2, 3])).toBe(0);
    expect(maxDrawdown([100, 120, 90, 110, 60, 130])).toBeCloseTo(0.5);
  });

  it('summarizeOutcomes reports percentiles, losses and drawdowns', () => {
    const paths = [
      [100, 80, 90],   // loss, dd 0.2
      [100, 110, 120], // gain, dd 0
      [100, 95, 105],  // gain, dd 0.05
      [100, 120, 60],  // loss, dd 0.5
      [100, 100, 100], // flat, not a loss
    ];
    const s = summarizeOutcomes(paths, 100);
    expect(s.p50).toBe(100);
    expect(s.p10).toBeCloseTo(72);
    expect(s.p90).toBeCloseTo(114);
    expect(s.chanceOfLoss).toBeCloseTo(0.4);
    expect(s.everBelowStart).toBeCloseTo(0.6);
    expect(s.maxDrawdown.p50).toBeCloseTo(0.05);
    expect(s.maxDrawdown.p90).toBeCloseTo(0.38);
  });

  it('returnHistogram puts 0 on a bin edge and counts every value', () => {
    const values = [-0.31, -0.2, -0.05, -0.0001, 0, 0.02, 0.4, 0.9];
    const bins = returnHistogram(values, 12);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(values.length);
    expect(bins.some((b) => Math.abs(b.from) < 1e-12)).toBe(true);
    for (const b of bins) expect(b.loss).toBe(b.to <= 1e-12);
    const zeroBin = bins.find((b) => Math.abs(b.from) < 1e-12)!;
    expect(zeroBin.loss).toBe(false);
    expect(zeroBin.count).toBeGreaterThanOrEqual(2); // 0 and 0.02
  });

  it('returnHistogram handles all-gain, all-loss and identical values', () => {
    expect(returnHistogram([0.1, 0.2, 0.3]).every((b) => !b.loss)).toBe(true);
    expect(returnHistogram([-0.1, -0.2, -0.3]).every((b) => b.loss)).toBe(true);
    expect(returnHistogram([0.5, 0.5])).toEqual([{ from: 0.5, to: 0.5, count: 2, loss: false }]);
    expect(returnHistogram([])).toEqual([]);
  });

  it('medianPathIndex picks the path with the median ending value', () => {
    expect(medianPathIndex([[1, 5], [1, 1], [1, 3]])).toBe(2);
    expect(medianPathIndex([])).toBe(-1);
  });
});
