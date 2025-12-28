import { describe, it, expect } from 'bun:test';
import { optimizePortfolioGreedy, GreedyOptimizationParams } from '../../../lib/optimizer';

describe('optimizePortfolioGreedy', () => {
  it('should return initial state if budget is zero', () => {
    const params: GreedyOptimizationParams = {
      candidates: [
        { ticker: 'A', price: 100, expectedReturn: 0.1 }
      ],
      covarianceMatrix: [[0.01]],
      lambda: 1,
      budget: 0
    };

    const result = optimizePortfolioGreedy(params);
    expect(result.remainingBudget).toBe(0);
    expect(Object.keys(result.shares).length).toBe(0);
  });

  it('should allocate budget to best asset (Greedy/Sharpe logic)', () => {
    // A: High Return, Low Risk (Best)
    // B: Low Return, High Risk
    const params: GreedyOptimizationParams = {
      candidates: [
        { ticker: 'A', price: 10, expectedReturn: 0.2 },
        { ticker: 'B', price: 10, expectedReturn: 0.05 }
      ],
      covarianceMatrix: [
        [0.01, 0],
        [0, 0.04]
      ],
      lambda: 1,
      budget: 100 // Can buy 10 shares
    };

    const result = optimizePortfolioGreedy(params);

    // Expect mostly A
    expect(result.shares['A']).toBeGreaterThan(result.shares['B'] || 0);
    expect(result.remainingBudget).toBeLessThan(10); // Spent most budget
  });

  it('should respect budget constraints', () => {
    const params: GreedyOptimizationParams = {
      candidates: [
        { ticker: 'A', price: 60, expectedReturn: 0.1 },
        { ticker: 'B', price: 60, expectedReturn: 0.1 }
      ],
      covarianceMatrix: [[0.01, 0], [0, 0.01]],
      lambda: 1,
      budget: 100
    };

    const result = optimizePortfolioGreedy(params);
    // Can only buy 1 share of A or B
    const totalShares = (result.shares['A'] || 0) + (result.shares['B'] || 0);
    expect(totalShares).toBe(1);
    expect(result.remainingBudget).toBeGreaterThanOrEqual(40);
  });

  it('should maximize Sharpe Ratio (look-ahead check)', () => {
    // Scenario:
    // A: Return 10%, Vol 10% (Sharpe ~0.6 assuming Rf=0.04)
    // B: Return 20%, Vol 30% (Sharpe ~0.53)
    // C: Return 8%, Vol 5% (Sharpe ~0.8)
    // The optimizer should prefer C first.
    // Note: optimization loop maximizes Sharpe of *resulting* portfolio.

    // Covariance matrix (uncorrelated for simplicity)
    // A (idx 0), B (idx 1), C (idx 2)
    // Vars: 0.01, 0.09, 0.0025

    const params: GreedyOptimizationParams = {
      candidates: [
        { ticker: 'A', price: 10, expectedReturn: 0.10 },
        { ticker: 'B', price: 10, expectedReturn: 0.20 },
        { ticker: 'C', price: 10, expectedReturn: 0.08 }
      ],
      covarianceMatrix: [
        [0.01, 0, 0],
        [0, 0.09, 0],
        [0, 0, 0.0025]
      ],
      lambda: 1,
      budget: 100 // Buy 10 shares
    };

    const result = optimizePortfolioGreedy(params);

    // C should be favored because it has the highest Sharpe (0.08-0.04)/0.05 = 0.8 vs A: 0.6 vs B: 0.53
    expect(result.shares['C']).toBeGreaterThan(result.shares['A'] || 0);
    expect(result.shares['C']).toBeGreaterThan(result.shares['B'] || 0);
  });
});
