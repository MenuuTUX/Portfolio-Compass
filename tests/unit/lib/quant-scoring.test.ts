import { describe, it, expect } from 'bun:test';
import { calculateCompositeScores } from '../../../lib/quant-scoring';
import { EtfDetails } from '../../../lib/market-service';
import { Decimal } from 'decimal.js';

describe('calculateCompositeScores', () => {
  it('should calculate scores for a list of assets', () => {
    // Mock assets
    const assets: Partial<EtfDetails>[] = [
      {
          ticker: 'A',
          peRatio: new Decimal(10),
          dividendYield: new Decimal(2), // 2%
          dividendGrowth5Y: new Decimal(5), // 5%
          beta5Y: new Decimal(1.0),
          metrics: {}, allocation: {}, sectors: {}, history: []
      } as any,
      {
          ticker: 'B',
          peRatio: new Decimal(20),
          dividendYield: new Decimal(1),
          dividendGrowth5Y: new Decimal(1),
          beta5Y: new Decimal(1.5),
          metrics: {}, allocation: {}, sectors: {}, history: []
      } as any
    ];

    // Force cast for testing partials
    const scores = calculateCompositeScores(assets as EtfDetails[]);

    expect(scores.length).toBe(2);

    const scoreA = scores.find(s => s.ticker === 'A')?.scores.composite;
    const scoreB = scores.find(s => s.ticker === 'B')?.scores.composite;

    expect(scoreA).toBeDefined();
    expect(scoreB).toBeDefined();

    // A: V=1/10=0.1, Q=2+5=7, L=1/1=1
    // B: V=1/20=0.05, Q=1+1=2, L=1/1.5=0.66
    // A is better in all metrics, so Z-scores should be higher
    expect(scoreA!).toBeGreaterThan(scoreB!);
  });

  it('should handle missing data gracefully', () => {
    const assets: Partial<EtfDetails>[] = [
      { ticker: 'A', sectors: {}, history: [] } as any // Missing PE, Beta, etc.
    ];

    const scores = calculateCompositeScores(assets as EtfDetails[]);
    expect(scores.length).toBe(1);
    expect(scores[0].scores.composite).toBe(0); // Z-score of single item is usually 0 or NaN depending on impl, my impl uses std=1 if len=1, so (val-mean)/1 = 0.
  });

  it('should use Dividend Growth 5Y in Quality Score', () => {
     // Asset with high growth vs low growth
     const assets: Partial<EtfDetails>[] = [
       {
         ticker: 'GROW',
         dividendYield: new Decimal(2),
         dividendGrowth5Y: new Decimal(10), // High Growth
         peRatio: new Decimal(10),
         beta5Y: new Decimal(1),
         sectors: {}, history: []
       } as any,
       {
         ticker: 'FLAT',
         dividendYield: new Decimal(2),
         dividendGrowth5Y: new Decimal(0), // No Growth
         peRatio: new Decimal(10),
         beta5Y: new Decimal(1),
         sectors: {}, history: []
       } as any
     ];

     const scores = calculateCompositeScores(assets as EtfDetails[]);
     const scoreGrow = scores.find(s => s.ticker === 'GROW')!.scores.composite;
     const scoreFlat = scores.find(s => s.ticker === 'FLAT')!.scores.composite;

     // GROW should have higher quality score than FLAT, thus higher composite (other factors equal)
     expect(scoreGrow).toBeGreaterThan(scoreFlat);
  });
});
