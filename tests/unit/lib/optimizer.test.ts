import { describe, it, expect } from 'bun:test';
import {
  calculatePortfolioUtility,
  getOptimizerInputGaps,
  optimizePortfolioGreedy,
  GreedyOptimizationParams,
} from '../../../lib/optimizer';

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

  it('rejects non-finite or negative budgets before allocating shares', () => {
    const base = {
      candidates: [{ ticker: 'A', price: 100, expectedReturn: 0.1 }],
      covarianceMatrix: [[0.01]],
      lambda: 1,
    };
    expect(() => optimizePortfolioGreedy({ ...base, budget: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => optimizePortfolioGreedy({ ...base, budget: Number.NaN })).toThrow(RangeError);
    expect(() => optimizePortfolioGreedy({ ...base, budget: -1 })).toThrow(RangeError);
  });

  it('reports the score of the current portfolio when no new cash is available', () => {
    const result = optimizePortfolioGreedy({
      candidates: [{ ticker: 'A', price: 100, expectedReturn: 0.1 }],
      covarianceMatrix: [[0.01]],
      lambda: 1,
      budget: 0,
      initialShares: { A: 1 },
    });
    expect(result.utility).toBeCloseTo(0.09);
  });

  it('requires issuer-sourced yield and beta before showing a score', () => {
    const items = [
      {
        ticker: 'MISSING',
        metrics: { yield: null },
        dividendYield: null,
        beta: undefined,
      },
      {
        ticker: 'YAHOO',
        metrics: { yield: 1.5, yieldSource: 'Yahoo Finance quote' },
        dividendYield: null,
        beta: 1,
      },
      {
        ticker: 'NO_SOURCE',
        metrics: { yield: 1.5 },
        dividendYield: null,
        beta: 1,
      },
      {
        ticker: 'ISSUER',
        metrics: { yield: 1.5, yieldSource: 'Issuer factsheet' },
        dividendYield: null,
        beta: 1,
      },
    ] as unknown as import('@/types').PortfolioItem[];

    expect(getOptimizerInputGaps(items)).toEqual(['MISSING', 'YAHOO', 'NO_SOURCE']);
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

  it('carries an initial holding that has no matching candidate', () => {
    // Dropping it would silently lose a position from the caller's portfolio.
    const result = optimizePortfolioGreedy({
      candidates: [{ ticker: 'A', price: 100, expectedReturn: 0.07 }],
      covarianceMatrix: [[0.0225]],
      lambda: 1,
      budget: 1000,
      initialShares: { A: 5, GHOST: 40 },
    });

    expect(result.shares['GHOST']).toBe(40);
    expect(result.shares['A']).toBe(5);
    expect(result.remainingBudget).toBe(1000);
    // GHOST has no price, so it cannot be weighted.
    expect(result.weights['GHOST']).toBeUndefined();
  });

  it('scores candidates per dollar, not per lot', () => {
    // Identical risk and return; only the share price differs. Comparing
    // utility levels let the expensive asset win on step size alone.
    const result = optimizePortfolioGreedy({
      candidates: [
        { ticker: 'CHEAP', price: 20, expectedReturn: 0.08 },
        { ticker: 'PRICEY', price: 400, expectedReturn: 0.08 },
      ],
      covarianceMatrix: [
        [0.0225, 0],
        [0, 0.0225],
      ],
      lambda: 1,
      budget: 40000,
    });

    // Discrete lots stop this being exactly 50/50, but it must be close.
    expect(Math.abs(result.weights['CHEAP'] - 0.5)).toBeLessThan(0.05);
  });

  it('stays responsive as the budget grows', () => {
    // The step used to be a flat $100, making iterations linear in the budget:
    // a 100-asset portfolio at a $20M target blocked the main thread for 98s.
    const n = 60;
    const candidates = Array.from({ length: n }, (_, k) => ({
      ticker: `A${k}`,
      price: 40 + (k % 20) * 15,
      expectedReturn: 0.04 + (k % 7) * 0.01,
    }));
    const covarianceMatrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0.0225 : 0.01)),
    );

    const started = performance.now();
    optimizePortfolioGreedy({
      candidates,
      covarianceMatrix,
      lambda: 5,
      budget: 20_000_000,
    });
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('ignores a candidate whose price failed to hydrate', () => {
    const result = optimizePortfolioGreedy({
      candidates: [
        { ticker: 'GOOD', price: 100, expectedReturn: 0.07 },
        { ticker: 'NOQUOTE', price: 0, expectedReturn: 0.07 },
      ],
      covarianceMatrix: [
        [0.0225, 0],
        [0, 0.0225],
      ],
      lambda: 5,
      budget: 10000,
    });

    expect(result.shares['NOQUOTE']).toBe(0);
    expect(Number.isFinite(result.shares['GOOD'])).toBe(true);
    expect(Number.isFinite(result.remainingBudget)).toBe(true);
  });

  it('keeps cash when every affordable purchase has no score gain', () => {
    const result = optimizePortfolioGreedy({
      candidates: [{ ticker: 'LOSS', price: 100, expectedReturn: -0.1 }],
      covarianceMatrix: [[0.04]],
      lambda: 1,
      budget: 100,
      initialShares: { LOSS: 1 },
    });

    expect(result.addedShares.LOSS).toBe(0);
    expect(result.remainingBudget).toBe(100);
    expect(result.utility).toBeCloseTo(
      calculatePortfolioUtility(
        [{ ticker: 'LOSS', price: 100, expectedReturn: -0.1 }],
        [[0.04]],
        1,
        [1],
      ),
    );
  });
});
