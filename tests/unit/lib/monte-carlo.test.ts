import { describe, it, expect } from 'bun:test';
import {
  calculateLogReturns,
  calculateCovarianceMatrix,
  getCholeskyDecomposition
} from '@/lib/monte-carlo';

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

});
