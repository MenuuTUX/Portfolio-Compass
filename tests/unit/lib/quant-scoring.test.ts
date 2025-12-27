import { describe, it, expect } from 'bun:test';
import { calculateAssetScores } from '../../lib/quant-scoring';
import { ETF } from '../../types/index';

// Helper to create mock ETF
const createMockEtf = (ticker: string, overrides: Partial<ETF> = {}): ETF => ({
  ticker,
  name: `Test ${ticker}`,
  price: 100,
  changePercent: 0,
  history: [], // Populate in tests if needed
  allocation: { equities: 100, bonds: 0, cash: 0 },
  metrics: { mer: 0.1, yield: 2.0 },
  ...overrides
});

describe('calculateAssetScores', () => {
  it('should calculate valuation scores correctly (1/PE)', () => {
    const assets: ETF[] = [
      createMockEtf('LOW_PE', { peRatio: 10 }), // Yield 0.1
      createMockEtf('HIGH_PE', { peRatio: 50 }), // Yield 0.02
      createMockEtf('AVG_PE', { peRatio: 20 }), // Yield 0.05
    ];

    const results = calculateAssetScores(assets);

    // Sort by Valuation Z-Score Descending
    results.sort((a, b) => b.scores.valuation - a.scores.valuation);

    // Expect LOW_PE (High Yield) to have highest score
    expect(results[0].ticker).toBe('LOW_PE');
    expect(results[2].ticker).toBe('HIGH_PE');

    expect(results[0].scores.valuation).toBeGreaterThan(0);
    expect(results[2].scores.valuation).toBeLessThan(0);
  });

  it('should handle missing PE by assigning lowest quartile score', () => {
    const assets: ETF[] = [
      createMockEtf('GOOD', { peRatio: 10 }), // Yield 0.1
      createMockEtf('MID', { peRatio: 20 }),  // Yield 0.05
      createMockEtf('BAD', { peRatio: 100 }), // Yield 0.01
      createMockEtf('MISSING', { peRatio: undefined }),
    ];

    const results = calculateAssetScores(assets);

    const missing = results.find(r => r.ticker === 'MISSING')!;
    const bad = results.find(r => r.ticker === 'BAD')!;

    // Missing should be <= Bad (or close to Q1 of valid: 0.01, 0.05, 0.1. Q1 approx 0.01)
    // Actually our Q1 logic picks the element at index 0.25*n.
    // Sorted Valid: 0.01, 0.05, 0.10. n=3. Index 0.75 -> 0.
    // Q1 is 0.01.
    // So Missing should have raw value 0.01.
    expect(missing.rawValues.valuation).toBeCloseTo(0.01);
    expect(missing.scores.valuation).toBeCloseTo(bad.scores.valuation);
  });

  it('should calculate quality scores (Yield + DGR/NetMargin)', () => {
    const assets: ETF[] = [
      // High Yield, No Growth
      createMockEtf('HY_NG', { metrics: { mer: 0, yield: 5.0 }, netIncome: 0, revenue: 100 }), // Q = 0.05 + 0 = 0.05
      // Low Yield, High Margin
      createMockEtf('LY_HG', { metrics: { mer: 0, yield: 1.0 }, netIncome: 20, revenue: 100 }), // Q = 0.01 + 0.20 = 0.21
    ];

    const results = calculateAssetScores(assets);
    const highQual = results.find(r => r.ticker === 'LY_HG')!;
    const lowQual = results.find(r => r.ticker === 'HY_NG')!;

    expect(highQual.scores.quality).toBeGreaterThan(lowQual.scores.quality);
  });

  it('should calculate low volatility using history (1/sigma)', () => {
    // Mock history to produce different volatilities
    // Asset A: Low Volatility (Price stable)
    const historyStable = Array.from({ length: 30 }, (_, i) => ({
       date: `2023-01-${i+1}`,
       price: 100 + (i % 2) // fluctuates 100, 101, 100...
    }));

    // Asset B: High Volatility (Price jumps)
    const historyVolatile = Array.from({ length: 30 }, (_, i) => ({
       date: `2023-01-${i+1}`,
       price: 100 + (i % 2) * 10 // fluctuates 100, 110, 100...
    }));

    const assets: ETF[] = [
      createMockEtf('STABLE', { history: historyStable }),
      createMockEtf('VOLATILE', { history: historyVolatile }),
    ];

    const results = calculateAssetScores(assets);
    const stable = results.find(r => r.ticker === 'STABLE')!;
    const volatile = results.find(r => r.ticker === 'VOLATILE')!;

    // Lower Volatility -> Higher 1/Vol -> Higher Score
    expect(stable.scores.lowVolatility).toBeGreaterThan(volatile.scores.lowVolatility);
  });

  it('should handle negative PE correctly (negative earnings yield)', () => {
      // PE -10 -> Yield -0.10
      // PE 10 -> Yield 0.10
      const assets = [
          createMockEtf('NEG', { peRatio: -10 }),
          createMockEtf('POS', { peRatio: 10 }),
      ];

      const results = calculateAssetScores(assets);
      const neg = results.find(r => r.ticker === 'NEG')!;
      const pos = results.find(r => r.ticker === 'POS')!;

      expect(neg.rawValues.valuation).toBe(-0.1);
      expect(pos.rawValues.valuation).toBe(0.1);
      expect(pos.scores.valuation).toBeGreaterThan(neg.scores.valuation);
  });
});
