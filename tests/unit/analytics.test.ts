import { describe, it, expect } from 'bun:test';
import {
  calculateOverlap,
  calculateOverlapFromHoldings,
} from '@/lib/analytics';

describe('calculateOverlap', () => {
  it('should calculate overlap correctly', async () => {
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

    const result = await calculateOverlap(holdingsA, holdingsB);

    // Expected Overlap Score: min(10, 8) + min(5, 6) = 8 + 5 = 13
    expect(result.overlapScore).toBe(13);
    expect(result.commonHoldings).toHaveLength(2);

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
});
