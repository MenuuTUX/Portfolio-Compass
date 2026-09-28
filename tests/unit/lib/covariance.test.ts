import { describe, it, expect } from 'bun:test';
import { estimateAnnualCovariance } from '@/lib/math/covariance';
import { getAssetBeta, classifyAsset } from '@/lib/math/portfolio-returns';
import type { PortfolioItem } from '@/types';

type ItemOverrides = Partial<PortfolioItem> & { ticker: string };

const makeItem = (overrides: ItemOverrides): PortfolioItem =>
  ({
    name: overrides.ticker,
    price: 100,
    changePercent: 0,
    assetType: 'ETF',
    history: [],
    metrics: { mer: 0, yield: 0 },
    allocation: { equities: 100, bonds: 0, cash: 0 },
    shares: 0,
    weight: 0,
    ...overrides,
  }) as PortfolioItem;

const correlation = (m: number[][], i: number, j: number) =>
  m[i][j] / Math.sqrt(m[i][i] * m[j][j]);

/** A price series driven by `shocks`, scaled by `loading`. */
const seriesFrom = (shocks: number[], loading: number, start = 100) => {
  let price = start;
  const epoch = Date.parse('2024-01-02');
  return shocks.map((shock, k) => {
    price *= Math.exp(shock * loading);
    return {
      date: new Date(epoch + k * 86400000).toISOString().slice(0, 10),
      price,
    };
  });
};

describe('estimateAnnualCovariance', () => {
  it('falls back to a single-index matrix without price history', () => {
    const portfolio = [
      makeItem({ ticker: 'SPY', beta: 1 }),
      makeItem({ ticker: 'VOO', beta: 1 }),
    ];

    const { matrix, source } = estimateAnnualCovariance(portfolio);

    expect(source).toBe('single-index');
    // Two funds tracking one index must not look independent: the old
    // diagonal-only matrix scored their correlation at exactly zero.
    expect(correlation(matrix, 0, 1)).toBeGreaterThan(0.8);
  });

  it('gives cash near-zero variance and no market correlation', () => {
    const portfolio = [
      makeItem({ ticker: 'SPY', beta: 1 }),
      makeItem({
        ticker: 'SGOV',
        name: '0-3 Month Treasury Bond ETF',
        allocation: { equities: 0, bonds: 0, cash: 100 },
      }),
    ];

    expect(classifyAsset(portfolio[1])).toBe('cash');

    const { matrix } = estimateAnnualCovariance(portfolio);
    const cashVol = Math.sqrt(matrix[1][1]);

    expect(cashVol).toBeLessThan(0.01);
    expect(Math.abs(correlation(matrix, 0, 1))).toBeLessThan(1e-9);
  });

  it('recovers correlation from aligned price history', () => {
    const common = Array.from({ length: 300 }, () => (Math.random() - 0.5) * 0.02);
    const own = Array.from({ length: 300 }, () => (Math.random() - 0.5) * 0.02);

    const portfolio = [
      makeItem({ ticker: 'TWINA', history: seriesFrom(common, 1) }),
      makeItem({ ticker: 'TWINB', history: seriesFrom(common, 0.98, 50) }),
      makeItem({ ticker: 'INDEP', history: seriesFrom(own, 1, 80) }),
    ];

    const { matrix, source, samples } = estimateAnnualCovariance(portfolio);

    expect(source).toBe('history');
    expect(samples).toBeGreaterThan(200);
    expect(correlation(matrix, 0, 1)).toBeGreaterThan(0.95);
    expect(Math.abs(correlation(matrix, 0, 2))).toBeLessThan(0.3);
  });

  it('aligns sparse histories by date instead of array position', () => {
    const shocks = Array.from({ length: 300 }, (_, i) =>
      Math.sin(i * 0.37) * 0.01,
    );
    const a = seriesFrom(shocks, 1);
    const b = seriesFrom(shocks, 0.98, 50).filter((_, i) => i !== 150);

    const { matrix, source } = estimateAnnualCovariance([
      makeItem({ ticker: 'A', history: a }),
      makeItem({ ticker: 'B', history: b }),
    ]);

    expect(source).toBe('history');
    expect(correlation(matrix, 0, 1)).toBeGreaterThan(0.99);
  });

  it('ignores history too short to estimate from', () => {
    const shocks = Array.from({ length: 5 }, () => 0.001);
    const portfolio = [
      makeItem({ ticker: 'A', beta: 1, history: seriesFrom(shocks, 1) }),
      makeItem({ ticker: 'B', beta: 1, history: seriesFrom(shocks, 1) }),
    ];

    expect(estimateAnnualCovariance(portfolio).source).toBe('single-index');
  });

  it('produces a symmetric matrix with non-negative variances', () => {
    const portfolio = [
      makeItem({ ticker: 'A', beta: 1.4 }),
      makeItem({ ticker: 'B', beta: 0.2, name: 'Aggregate Bond Index' }),
      makeItem({ ticker: 'C', beta: 0.9, assetType: 'STOCK' }),
    ];

    const { matrix } = estimateAnnualCovariance(portfolio);

    for (let i = 0; i < matrix.length; i++) {
      expect(matrix[i][i]).toBeGreaterThan(0);
      for (let j = 0; j < matrix.length; j++) {
        expect(matrix[i][j]).toBeCloseTo(matrix[j][i], 12);
      }
    }
  });

  it('models a single stock as riskier than a fund at the same beta', () => {
    const [fund] = estimateAnnualCovariance([
      makeItem({ ticker: 'VTI', beta: 1, assetType: 'ETF' }),
    ]).matrix;
    const [stock] = estimateAnnualCovariance([
      makeItem({ ticker: 'AAPL', beta: 1, assetType: 'STOCK' }),
    ]).matrix;

    expect(stock[0]).toBeGreaterThan(fund[0]);
  });
});

describe('getAssetBeta', () => {
  it('keeps a genuine zero beta instead of defaulting it to 1', () => {
    // `item.beta || 1.0` turned a T-bill fund into full equity exposure.
    expect(getAssetBeta(makeItem({ ticker: 'SGOV', beta: 0 }))).toBe(0);
  });

  it('defaults a missing beta from the asset class', () => {
    expect(getAssetBeta(makeItem({ ticker: 'VTI' }))).toBe(1);
    expect(
      getAssetBeta(
        makeItem({ ticker: 'BND', name: 'Total Bond Market Index Fund' }),
      ),
    ).toBeLessThan(0.5);
  });
});
