import { describe, it, expect } from 'bun:test';
import { analyzeEtf } from '@/lib/etf-analysis';
import { ETF } from '@/types';

describe('analyzeEtf', () => {
  it('should analyze cost correctly', () => {
    const highCostEtf = { metrics: { mer: 0.8, yield: 0 } } as ETF;
    expect(analyzeEtf(highCostEtf).cost.status).toBe('warning');

    const moderateCostEtf = { metrics: { mer: 0.5, yield: 0 } } as ETF;
    expect(analyzeEtf(moderateCostEtf).cost.status).toBe('neutral');

    const lowCostEtf = { metrics: { mer: 0.1, yield: 0 } } as ETF;
    expect(analyzeEtf(lowCostEtf).cost.status).toBe('good');
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
    // (1.5 - 1) * 100 = 50%
    expect(analyzeEtf(highBetaEtf).volatility.description).toContain('50% more volatile');

    const lowBetaEtf = { beta: 0.5, metrics: {} } as ETF;
    expect(analyzeEtf(lowBetaEtf).volatility.status).toBe('good');
    expect(analyzeEtf(lowBetaEtf).volatility.description).toContain('more stable');

    const marketBetaEtf = { beta: 1.0, metrics: {} } as ETF;
    expect(analyzeEtf(marketBetaEtf).volatility.status).toBe('neutral');
  });

  it('should handle missing metrics gracefully', () => {
    const emptyEtf = { metrics: {} } as ETF;
    const verdict = analyzeEtf(emptyEtf);
    expect(verdict.cost.status).toBe('good'); // Default 0 MER is good
    expect(verdict.liquidity.status).toBe('warning'); // Default 0 volume is warning
    expect(verdict.volatility.status).toBe('neutral'); // Default 1 beta is neutral
  });
});
