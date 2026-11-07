/**
 * Times the heaviest resample Monte Carlo cases (10 assets, 5000 paths x 30 years, and the 2000 x 10 year default).
 * Timing only, nothing is asserted.
 *
 *   bun scripts/bench-monte-carlo.ts
 */
import { createRandom, simulatePaths } from "@/lib/monte-carlo";

/** Deterministic pseudo returns, about +-1.5% a day. */
function history(T: number, seed: number, drift = 0.0003): number[] {
  const random = createRandom(seed);
  return Array.from({ length: T }, () => drift + (random() - 0.5) * 0.03);
}

const returns = Array.from({ length: 10 }, (_, i) => history(250, i + 10));
const shared = {
  returns,
  currentPrices: Array(10).fill(50),
  weights: Array(10).fill(0.1),
  initialValue: 10_000,
  stepDays: 21,
  seed: 1,
};

const t0 = performance.now();
simulatePaths("resample", { ...shared, numPaths: 5000, numDays: 30 * 252 });
const t1 = performance.now();
simulatePaths("resample", { ...shared, numPaths: 2000, numDays: 10 * 252 });
console.log(`heavy ${(t1 - t0).toFixed(0)} ms, default ${(performance.now() - t1).toFixed(0)} ms`);
