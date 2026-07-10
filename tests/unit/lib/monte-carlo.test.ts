import { describe, it, expect } from 'bun:test';
import {
  calculateLogReturns,
  calculateCovarianceMatrix,
  getCholeskyDecomposition,
  generateMonteCarloPaths,
} from '@/lib/monte-carlo';
import { annualYieldToDailyLogDrift } from '@/lib/math/portfolio-returns';

describe('Monte Carlo Math Library', () => {

  it('calculateLogReturns should compute correct log returns', () => {
    const prices = [100, 105, 102];
    const returns = calculateLogReturns(prices);

    // Expected:
    // r1 = ln(105/100) = 0.04879
    // r2 = ln(102/105) = -0.02898
    expect(returns.length).toBe(2);
    expect(returns[0]).toBeCloseTo(0.04879, 4);
    expect(returns[1]).toBeCloseTo(-0.02898, 4);
  });

  it('calculateLogReturns should handle empty or single price arrays', () => {
    expect(calculateLogReturns([])).toEqual([]);
    expect(calculateLogReturns([100])).toEqual([]);
  });

  it('calculateCovarianceMatrix should compute correct covariance', () => {
    // 2 Assets, 3 obs
    // Asset A Returns: [1, 2, 3] Mean=2
    // Asset B Returns: [2, 4, 6] Mean=4

    const returnsA = [1, 2, 3];
    const returnsB = [2, 4, 6];

    const matrix = calculateCovarianceMatrix([returnsA, returnsB]);

    // Variance A = sum((x-2)^2) / 2 = (1+0+1)/2 = 1
    // Variance B = sum((y-4)^2) / 2 = (4+0+4)/2 = 4
    // Cov(A,B) = sum((x-2)(y-4)) / 2 = ((-1*-2) + 0 + (1*2))/2 = (2+2)/2 = 2

    // Expected: [[1, 2], [2, 4]]

    expect(matrix.length).toBe(2);
    expect(matrix[0][0]).toBeCloseTo(1);
    expect(matrix[0][1]).toBeCloseTo(2);
    expect(matrix[1][0]).toBeCloseTo(2);
    expect(matrix[1][1]).toBeCloseTo(4);
  });

  it('getCholeskyDecomposition should return lower triangular matrix', () => {
    // Matrix [[4, 2], [2, 2]]
    // L such that L*L' = M
    // L11 = sqrt(4) = 2
    // L21 = 2/2 = 1
    // L22 = sqrt(2 - 1^2) = 1
    // Expected L = [[2, 0], [1, 1]]

    const cov = [[4, 2], [2, 2]];
    const L = getCholeskyDecomposition(cov);

    expect(L[0][0]).toBeCloseTo(2);
    expect(L[0][1]).toBeCloseTo(0);
    expect(L[1][0]).toBeCloseTo(1);
    expect(L[1][1]).toBeCloseTo(1);
  });

  it('getCholeskyDecomposition should throw on non-positive definite matrix', () => {
      // Matrix [[1, 2], [2, 1]] -> Determinant = 1-4 = -3 < 0. Not PD.
      const badCov = [[1, 2], [2, 1]];
      expect(() => getCholeskyDecomposition(badCov)).toThrow();
  });

  it('generateMonteCarloPaths compounds dividend yield in the drift', () => {
    // Zero-vol path: final value is deterministic from drift only
    const cholesky = [[0]]; // zero shocks
    const prices = [100];
    const weights = [1];
    const numDays = 252;
    const initial = 10_000;

    const noDiv = generateMonteCarloPaths(
      prices, weights, [0], cholesky, 1, numDays, initial,
    );
    const withDiv = generateMonteCarloPaths(
      prices,
      weights,
      [annualYieldToDailyLogDrift(0.05)],
      cholesky,
      1,
      numDays,
      initial,
    );

    const finalNoDiv = noDiv[0][noDiv[0].length - 1];
    const finalWithDiv = withDiv[0][withDiv[0].length - 1];

    // Zero drift → ~flat; 5% yield drift → ~+5%
    expect(finalNoDiv).toBeCloseTo(initial, 0);
    expect(finalWithDiv / initial).toBeCloseTo(1.05, 2);
    expect(finalWithDiv).toBeGreaterThan(finalNoDiv);
  });

  it('generateMonteCarloPaths includes every asset by weight', () => {
    // Two assets, zero vol, different drifts — blended outcome
    const L = [[0, 0], [0, 0]];
    const paths = generateMonteCarloPaths(
      [100, 50],
      [0.5, 0.5],
      [annualYieldToDailyLogDrift(0.10), annualYieldToDailyLogDrift(0)],
      L,
      1,
      252,
      10_000,
    );
    const final = paths[0][paths[0].length - 1];
    // 50/50 of +10% and +0% ≈ +5%
    expect(final / 10_000).toBeCloseTo(1.05, 1);
  });

});
