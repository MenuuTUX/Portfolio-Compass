import { describe, it, expect } from 'bun:test';
import { analyzeEtf } from '@/lib/etf-analysis';
import { ETF } from '@/types';

describe('analyzeEtf', () => {
  it('should analyze cost correctly', () => {
    const highCostEtf = { metrics: { mer: 0.8, yield: 0 } } as ETF;
    expect(analyzeEtf(highCostEtf).cost?.status).toBe('warning');

    const moderateCostEtf = { metrics: { mer: 0.5, yield: 0 } } as ETF;
    expect(analyzeEtf(moderateCostEtf).cost?.status).toBe('neutral');

    const lowCostEtf = { metrics: { mer: 0.1, yield: 0 } } as ETF;
    expect(analyzeEtf(lowCostEtf).cost?.status).toBe('good');
  });

  it('should omit the cost verdict for stocks (no expense ratio)', () => {
    const stock = { assetType: 'STOCK', metrics: {} } as ETF;
    expect(analyzeEtf(stock).cost).toBeUndefined();
  });

  it('should analyze liquidity correctly', () => {
    const highVolEtf = { volume: 2000000, metrics: {} } as ETF;
    expect(analyzeEtf(highVolEtf).liquidity.status).toBe('good');

    const medVolEtf = { volume: 500000, metrics: {} } as ETF;
    expect(analyzeEtf(medVolEtf).liquidity.status).toBe('neutral');

    const lowVolEtf = { volume: 50000, metrics: {} } as ETF;
    expect(analyzeEtf(lowVolEtf).liquidity.status).toBe('warning');
  });

  it('should analyze volatility correctly', () => {
    const highBetaEtf = { beta: 1.5, metrics: {} } as ETF;
    expect(analyzeEtf(highBetaEtf).volatility.status).toBe('warning');
    expect(analyzeEtf(highBetaEtf).volatility.description).toContain('greater historical sensitivity');

    const lowBetaEtf = { beta: 0.5, metrics: {} } as ETF;
    expect(analyzeEtf(lowBetaEtf).volatility.status).toBe('good');
    expect(analyzeEtf(lowBetaEtf).volatility.description).toContain('lower historical sensitivity');

    const marketBetaEtf = { beta: 1.0, metrics: {} } as ETF;
    expect(analyzeEtf(marketBetaEtf).volatility.status).toBe('neutral');
  });

  it('estimates volatility from price history when beta is missing', () => {
    const history = Array.from({ length: 40 }, (_, i) => ({
      date: `2024-01-${i + 1}`,
      price: 100 + Math.sin(i * 0.8) * 8,
    }));
    const etf = { metrics: {}, history: [] } as unknown as ETF;
    const verdict = analyzeEtf(etf, { history });
    expect(verdict.volatility.label).not.toBe('Volatility Unknown');
    expect(verdict.volatility.description).toContain('realized volatility');
  });

  it('treats missing data as unknown, not as a judgement', () => {
    // Regression: a seeded row without volume/beta used to claim
    // "Low Liquidity" and "Low Cost 0% fee" for blue chips like MSFT
    const emptyEtf = { metrics: {} } as ETF;
    const verdict = analyzeEtf(emptyEtf);

    expect(verdict.cost?.status).toBe('neutral');
    expect(verdict.cost?.label).toBe('Fee Data Unavailable');
    expect(verdict.liquidity.status).toBe('neutral');
    expect(verdict.liquidity.label).toBe('Volume Data Unavailable');
    expect(verdict.volatility.status).toBe('neutral');
    expect(verdict.volatility.label).toBe('Volatility Data Unavailable');
  });
});
