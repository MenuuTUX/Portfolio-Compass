import { describe, it, expect, mock } from 'bun:test';
import { mockModule } from '@/tests/helpers/mock-module';
import { calculateEMA, NEUTRAL_MARKET_RISK } from '@/lib/sentiment';

describe('calculateEMA', () => {
  it('returns empty for empty input', () => {
    expect(calculateEMA([], 10)).toEqual([]);
  });

  it('computes a rising EMA', () => {
    const data = [10, 20, 30, 40, 50];
    const ema = calculateEMA(data, 3);
    expect(ema).toHaveLength(5);
    expect(ema[0]).toBe(10);
    expect(ema[ema.length - 1]).toBeGreaterThan(ema[0]);
  });
});

describe('getMarketRiskState live sentiment', () => {
  it('maps CNN Fear & Greed score into risk state', async () => {
    await mockModule('@/lib/scrapers/fear-greed', () => ({
      fetchFearAndGreedIndex: mock(async () => ({
        score: 80,
        rating: 'Greed',
        updatedAt: new Date().toISOString(),
      })),
    }));

    // Re-import after mock
    const { getMarketRiskState } = await import('@/lib/sentiment');
    const state = await getMarketRiskState();

    expect(state.latestScore).toBe(80);
    expect(state.riskRegime).toBe('RISK_ON');
    expect(state.lambda).toBeLessThan(1.0);
    expect(state.degraded).toBeUndefined();
  });

  it('returns neutral defaults when scrape fails', async () => {
    await mockModule('@/lib/scrapers/fear-greed', () => ({
      fetchFearAndGreedIndex: mock(async () => {
        throw new Error('CNN down');
      }),
    }));

    const { getMarketRiskState } = await import('@/lib/sentiment');
    const state = await getMarketRiskState();

    expect(state.riskRegime).toBe(NEUTRAL_MARKET_RISK.riskRegime);
    expect(state.degraded).toBe(true);
  });
});
