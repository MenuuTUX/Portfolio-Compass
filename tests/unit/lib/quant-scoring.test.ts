import { describe, it, expect } from 'bun:test';
import { calculateCompositeScores } from '../../../lib/quant-scoring';
import { ETF } from '@/types';

describe('calculateCompositeScores', () => {
  it('should calculate scores for a list of assets', () => {
    // Mock assets
    const assets: Partial<ETF>[] = [
      { ticker: 'A', peRatio: 10, dividendYield: 0.02, beta: 1.0, metrics: { yield: 0.02, mer: 0 }, allocation: { equities: 0, bonds: 0, cash: 0 } },
      { ticker: 'B', peRatio: 20, dividendYield: 0.01, beta: 1.5, metrics: { yield: 0.01, mer: 0 }, allocation: { equities: 0, bonds: 0, cash: 0 } }
    ];

    // Force cast for testing partials
    const scores = calculateCompositeScores(assets as ETF[]);

    expect(scores.size).toBe(2);
    expect(scores.has('A')).toBe(true);
    expect(scores.has('B')).toBe(true);

    // A: V=1/10=0.1, Q=0.02, L=1/1=1
    // B: V=1/20=0.05, Q=0.01, L=1/1.5=0.66
    // A is better in all metrics, so Z-scores should be higher (or positive vs negative)

    expect(scores.get('A')).toBeGreaterThan(scores.get('B')!);
  });

  it('should handle missing data gracefully', () => {
    const assets: Partial<ETF>[] = [
      { ticker: 'A', metrics: { mer: 0, yield: 0 }, allocation: { equities: 0, bonds: 0, cash: 0 } } // Missing PE, Beta, etc.
    ];

    const scores = calculateCompositeScores(assets as ETF[]);
    expect(scores.has('A')).toBe(true);
    // Should not crash
  });

  it('should calculate Dividend Growth correctly (implicit check)', () => {
     // Asset with growing dividends
     const assets: Partial<ETF>[] = [
       {
         ticker: 'GROW',
         peRatio: 10,
         dividendYield: 0.02,
         beta: 1.0,
         dividendHistory: [
             { date: '2020-01-01', amount: 1.0 },
             { date: '2024-01-01', amount: 1.5 } // Growth
         ],
         metrics: { yield: 0.02, mer: 0 },
         allocation: { equities: 0, bonds: 0, cash: 0 }
       },
       {
         ticker: 'FLAT',
         peRatio: 10,
         dividendYield: 0.02,
         beta: 1.0,
         dividendHistory: [
             { date: '2020-01-01', amount: 1.0 },
             { date: '2024-01-01', amount: 1.0 } // No growth
         ],
         metrics: { yield: 0.02, mer: 0 },
         allocation: { equities: 0, bonds: 0, cash: 0 }
       }
     ];

     const scores = calculateCompositeScores(assets as ETF[]);
     // GROW should have higher quality score than FLAT, thus higher composite (other factors equal)
     expect(scores.get('GROW')).toBeGreaterThan(scores.get('FLAT')!);
  });
});
