import { describe, it, expect } from 'bun:test';
import { calculateOverlapFromHoldings } from '@/lib/analytics';

describe('calculateOverlapFromHoldings', () => {
  it('should calculate overlap correctly', () => {
    const holdingsA = [
      { ticker: 'AAPL', name: 'Apple', weight: 10 },
      { ticker: 'MSFT', name: 'Microsoft', weight: 5 },
      { ticker: 'GOOGL', name: 'Alphabet', weight: 2 },
    ];

    const holdingsB = [
      { ticker: 'AAPL', name: 'Apple', weight: 8 },
      { ticker: 'MSFT', name: 'Microsoft', weight: 6 },
      { ticker: 'AMZN', name: 'Amazon', weight: 4 },
    ];

    const result = calculateOverlapFromHoldings(holdingsA, holdingsB);

    // Expected Overlap Score: min(10, 8) + min(5, 6) = 8 + 5 = 13
    expect(result.overlapScore).toBe(13);
    expect(result.commonHoldings).toHaveLength(2);
    expect(result.coverageA).toBe(17);
    expect(result.coverageB).toBe(18);

    const aapl = result.commonHoldings.find((h) => h.ticker === 'AAPL');
    expect(aapl?.weightInA).toBe(10);
    expect(aapl?.weightInB).toBe(8);
  });

  it('should return 0 overlap if no common holdings', async () => {
    const result = calculateOverlapFromHoldings(
      [{ ticker: 'A', name: 'A', weight: 10 }],
      [{ ticker: 'B', name: 'B', weight: 10 }],
    );
    expect(result.overlapScore).toBe(0);
    expect(result.commonHoldings).toHaveLength(0);
  });

  it('counts a ticker once even when duplicate feed rows disagree', () => {
    const result = calculateOverlapFromHoldings(
      [
        { ticker: 'ABC', name: 'ABC', weight: 40 },
        { ticker: ' abc ', name: 'Duplicate ABC', weight: 90 },
        { ticker: 'XYZ', name: 'XYZ', weight: 20 },
      ],
      [
        { ticker: 'ABC', name: 'ABC', weight: 40 },
        { ticker: 'abc', name: 'Duplicate ABC', weight: 90 },
        { ticker: 'XYZ', name: 'XYZ', weight: 20 },
      ],
    );

    expect(result.overlapScore).toBe(60);
    expect(result.commonHoldings).toHaveLength(2);
    expect(result.coverageA).toBe(60);
    expect(result.coverageB).toBe(60);
  });

  it('marks overfull feeds invalid instead of presenting a clamped score', () => {
    const result = calculateOverlapFromHoldings(
      [
        { ticker: 'ABC', name: 'ABC', weight: 80 },
        { ticker: 'XYZ', name: 'XYZ', weight: 40 },
      ],
      [
        { ticker: 'ABC', name: 'ABC', weight: 80 },
        { ticker: 'XYZ', name: 'XYZ', weight: 40 },
      ],
    );

    expect(result.overlapScore).toBeNull();
    expect(result.status).toBe('overfull');
    expect(result.coverageA).toBe(120);
    expect(result.coverageB).toBe(120);
  });

  it('reports partial coverage and ignores invalid rows', () => {
    const result = calculateOverlapFromHoldings(
      [
        { ticker: 'ABC', name: 'ABC', weight: 0.2 },
        { ticker: 'BAD', name: 'Invalid', weight: Number.NaN },
        { ticker: 'NEG', name: 'Negative', weight: -0.1 },
        { ticker: ' ', name: 'Missing ticker', weight: 0.3 },
      ],
      [{ ticker: 'ABC', name: 'ABC', weight: 0.1 }],
      { weightUnit: 'fraction' },
    );

    expect(result.overlapScore).toBe(10);
    expect(result.coverageA).toBe(20);
    expect(result.coverageB).toBe(10);
    expect(result.commonHoldings).toHaveLength(1);
  });

  it('keeps a partial 0.5% feed in percentage units by default', () => {
    const result = calculateOverlapFromHoldings(
      [{ ticker: 'ABC', name: 'ABC', weight: 0.5 }],
      [{ ticker: 'ABC', name: 'ABC', weight: 0.5 }],
    );

    expect(result.overlapScore).toBe(0.5);
    expect(result.coverageA).toBe(0.5);
    expect(result.coverageB).toBe(0.5);
  });
});
