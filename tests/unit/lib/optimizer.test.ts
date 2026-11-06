import { describe, it, expect } from 'bun:test';
import {
  calculatePortfolioUtility,
  getOptimizerBeta,
  getOptimizerReturnProxy,
  weightsFromShares,
  optimizePortfolioGreedy,
  GreedyOptimizationParams,
  RISK_FREE,
  EQUITY_PREMIUM,
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
    // The budget is invested in the one priced candidate.
    expect(result.shares['A']).toBe(15);
    expect(result.remainingBudget).toBe(0);
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

  it('never buys an asset whose expected return is not positive', () => {
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

  it('invests the full budget from an empty portfolio at the mean-variance mix', () => {
    // Fully invested optimum for this pair: w_EQ = (μE − μB + 2λ(σB² − σEB)) / (2λ(σE² + σB² − 2σEB)).
    const candidates = [
      { ticker: 'EQ', price: 100, expectedReturn: 0.075 },
      { ticker: 'BD', price: 50, expectedReturn: 0.039 },
    ];
    const cov = [[0.0225, 0.0005], [0.0005, 0.0016]];
    for (const [riskProfile, lambda] of [['conservative', 3], ['balanced', 1.4], ['growth', 0.9]] as const) {
      const r = optimizePortfolioGreedy({ candidates, covarianceMatrix: cov, riskProfile, budget: 7000 });
      expect(r.remainingBudget).toBeLessThan(50);
      const optimum = (0.075 - 0.039 + 2 * lambda * (0.0016 - 0.0005)) / (2 * lambda * (0.0225 + 0.0016 - 0.001));
      expect(Math.abs(r.weights.EQ - optimum)).toBeLessThan(0.02);
    }
  });

  it('spends the budget down to less than the cheapest share', () => {
    // The fixed 400-iteration cap used to stop the greedy loop with $5,060 left
    // of a $50,000 budget. The final sweep must spend the rest one share at a time.
    const candidates = [
      { ticker: 'A', price: 100, expectedReturn: 0.075 },
      { ticker: 'B', price: 50, expectedReturn: 0.039 },
      { ticker: 'C', price: 30, expectedReturn: 0.05 },
    ];
    const covarianceMatrix = [
      [0.0225, 0.0005, 0.004],
      [0.0005, 0.0016, 0.0002],
      [0.004, 0.0002, 0.01],
    ];
    for (const budget of [10_000, 50_000, 1_000_000]) {
      const r = optimizePortfolioGreedy({ candidates, covarianceMatrix, riskProfile: 'balanced', budget });
      expect(r.remainingBudget).toBeLessThan(30);
      expect(r.remainingBudget).toBeGreaterThanOrEqual(0);
      const spent = candidates.reduce((sum, c) => sum + (r.addedShares[c.ticker] || 0) * c.price, 0);
      expect(budget - spent).toBeCloseTo(r.remainingBudget, 6);
    }
  });

  it('prices 200 assets in under a second', () => {
    // A factor-model covariance (PSD by construction) keeps the greedy walk realistic.
    const n = 200;
    const candidates = Array.from({ length: n }, (_, k) => ({
      ticker: `T${k}`,
      price: 20 + (k % 37) * 7,
      expectedReturn: 0.03 + (k % 11) * 0.005,
    }));
    const beta = Array.from({ length: n }, (_, k) => 0.5 + (k % 9) * 0.1);
    const covarianceMatrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => beta[i] * beta[j] * 0.0225 + (i === j ? 0.01 : 0)),
    );

    const started = performance.now();
    const r = optimizePortfolioGreedy({ candidates, covarianceMatrix, riskProfile: 'growth', budget: 100_000 });
    expect(performance.now() - started).toBeLessThan(1000);
    expect(r.remainingBudget).toBeLessThan(Math.min(...candidates.map((c) => c.price)));
  }, { timeout: 20000 });

  it('maps the profiles to roughly 30 / 60 / 90 percent equity on a stock-bond pair', () => {
    const candidates = [
      { ticker: 'EQ', price: 100, expectedReturn: 0.075 },
      { ticker: 'BD', price: 50, expectedReturn: 0.039 },
    ];
    const cov = [[0.0225, 0.0005], [0.0005, 0.0016]];
    const equity = (riskProfile: 'conservative' | 'balanced' | 'growth') =>
      optimizePortfolioGreedy({ candidates, covarianceMatrix: cov, riskProfile, budget: 20000 }).weights.EQ;
    expect(equity('conservative')).toBeCloseTo(0.3, 1);
    expect(equity('balanced')).toBeCloseTo(0.6, 1);
    expect(equity('growth')).toBeCloseTo(0.9, 1);
  });
});

describe('optimizer inputs', () => {
  const fund = (ticker: string, equities: number, bonds: number, extra: Record<string, unknown> = {}) => ({
    ticker,
    assetType: 'ETF',
    price: 40,
    metrics: { yield: 1.5, yieldSource: 'Yahoo Finance dividend history (TTM)' },
    allocation: { equities, bonds, cash: 100 - equities - bonds },
    ...extra,
  }) as unknown as import('@/types').PortfolioItem;

  it('prices a fund by its reported stock/bond mix over a quoted beta', () => {
    // Yahoo quotes XGRO (80/20) at beta 1.06, above all-equity XEQT at 0.88.
    expect(getOptimizerBeta(fund('XGRO', 80, 20, { beta: 1.06 }))).toBeCloseTo(0.83);
    expect(getOptimizerBeta(fund('XEQT', 100, 0, { beta: 0.88 }))).toBeCloseTo(1);
  });

  it('falls back to quoted beta for stocks and funds with no mix', () => {
    expect(getOptimizerBeta(fund('AAPL', 0, 0, { assetType: 'STOCK', beta: 1.2 }))).toBeCloseTo(1.2);
    expect(getOptimizerBeta(fund('NOMIX', 0, 0, { beta: 0.7, allocation: { equities: 0, bonds: 0, cash: 0 } }))).toBeCloseTo(0.7);
  });

  it('scores expected return as the risk-free rate plus beta times the equity premium', () => {
    expect(RISK_FREE).toBeCloseTo(0.02);
    expect(EQUITY_PREMIUM).toBeCloseTo(0.06);
    expect(getOptimizerReturnProxy(fund('XEQT', 100, 0))).toBeCloseTo(RISK_FREE + EQUITY_PREMIUM);
    expect(getOptimizerReturnProxy(fund('XGRO', 80, 20))).toBeLessThan(getOptimizerReturnProxy(fund('XEQT', 100, 0)));
  });

  it('does not add a fund yield on top of its return proxy', () => {
    // A covered-call fund pays 12% but has beta 0.6. Its yield is part of total
    // return, so it must not outscore broad equity on yield alone.
    const coveredCall = fund('CALL', 60, 0, { beta: 0.6, metrics: { yield: 12, yieldSource: 'Issuer factsheet' } });
    const broad = fund('EQ', 100, 0, { metrics: { yield: 1.3, yieldSource: 'Issuer factsheet' } });
    expect(getOptimizerReturnProxy(coveredCall)).toBeCloseTo(RISK_FREE + 0.6 * EQUITY_PREMIUM);
    expect(getOptimizerReturnProxy(broad)).toBeCloseTo(RISK_FREE + EQUITY_PREMIUM);
    expect(getOptimizerReturnProxy(coveredCall)).toBeLessThan(getOptimizerReturnProxy(broad));
  });

  it('gives Growth more stocks than Conservative across an all-equity and an 80/20 fund', () => {
    const items = [fund('EQ', 100, 0), fund('GRO', 80, 20)];
    const betas = items.map(getOptimizerBeta);
    const idio = 0.06 * 0.06;
    const cov = betas.map((bi, i) => betas.map((bj, j) => bi * bj * 0.0225 + (i === j ? idio : 0)));
    const candidates = items.map((p) => ({ ticker: p.ticker, price: 40, expectedReturn: getOptimizerReturnProxy(p) }));
    const equity = (profile: 'conservative' | 'growth') => {
      const r = optimizePortfolioGreedy({ candidates, covarianceMatrix: cov, riskProfile: profile, budget: 10000 });
      return (r.weights.EQ ?? 0) * 1 + (r.weights.GRO ?? 0) * 0.8;
    };
    expect(equity('growth')).toBeGreaterThan(equity('conservative') + 0.02);
  });

  it('turns a share plan into one-decimal weights that sum to exactly 100', () => {
    const holdings = [{ ticker: 'A', price: 33.33 }, { ticker: 'B', price: 33.33 }, { ticker: 'C', price: 33.34 }, { ticker: 'D', price: 10 }];
    const w = weightsFromShares(holdings, { A: 1, B: 1, C: 1, D: 0 });
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    expect(w.D).toBe(0);
    expect(weightsFromShares(holdings, {})).toEqual({ A: 0, B: 0, C: 0, D: 0 });
  });
});
