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

  it('should allocate budget to best asset (Greedy Utility logic)', () => {
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

  it('should maximize Utility (Risk Neutral / Low Lambda)', () => {
    // Scenario: Low Risk Aversion (Lambda = 0.5)
    // A: Return 10%, Var 0.01. U = 0.10 - 0.5*0.01 = 0.095
    // B: Return 20%, Var 0.09. U = 0.20 - 0.5*0.09 = 0.155 (Winner)
    // C: Return 8%, Var 0.0025. U = 0.08 - 0.5*0.0025 = 0.07875

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
      lambda: 0.5,
      budget: 100
    };

    const result = optimizePortfolioGreedy(params);

    // B should be favored
    expect(result.shares['B']).toBeGreaterThan(result.shares['A'] || 0);
    expect(result.shares['B']).toBeGreaterThan(result.shares['C'] || 0);
  });

  it('should maximize Utility (High Risk Aversion / High Lambda)', () => {
    // Scenario: High Risk Aversion (Lambda = 10)
    // A: Return 10%, Var 0.01. U = 0.10 - 10*0.01 = 0.00
    // B: Return 20%, Var 0.09. U = 0.20 - 10*0.09 = -0.70
    // C: Return 8%, Var 0.0025. U = 0.08 - 10*0.0025 = 0.055 (Winner)

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
      lambda: 10,
      budget: 100
    };

    const result = optimizePortfolioGreedy(params);

    // C should be favored (Low Volatility)
    expect(result.shares['C']).toBeGreaterThan(result.shares['A'] || 0);
    expect(result.shares['C']).toBeGreaterThan(result.shares['B'] || 0);
  });
});
