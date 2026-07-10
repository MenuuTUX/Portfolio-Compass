import { describe, it, expect } from 'bun:test';
import { calculateOverlapFromHoldings } from '@/lib/analytics';

describe('Analytics: calculateOverlap', () => {
  it('should calculate overlap score and common holdings correctly', () => {
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

    expect(result.overlapScore).toBe(13);
    expect(result.commonHoldings).toHaveLength(2);
  });

  it('should verify sorting order is by intersection weight (min)', () => {
    const holdingsA = [
      { ticker: 'A', name: 'A', weight: 20 },
      { ticker: 'B', name: 'B', weight: 5 },
    ];
    const holdingsB = [
      { ticker: 'A', name: 'A', weight: 3 },
      { ticker: 'B', name: 'B', weight: 10 },
    ];

    const result = calculateOverlapFromHoldings(holdingsA, holdingsB);
    // min(A)=3, min(B)=5 → B first
    expect(result.commonHoldings[0].ticker).toBe('B');
    expect(result.commonHoldings[1].ticker).toBe('A');
  });

  it('should return 0 overlap if no common holdings', () => {
    const result = calculateOverlapFromHoldings(
      [{ ticker: 'A', name: 'A', weight: 10 }],
      [{ ticker: 'B', name: 'B', weight: 10 }],
    );
    expect(result.overlapScore).toBe(0);
    expect(result.commonHoldings).toHaveLength(0);
  });
});
