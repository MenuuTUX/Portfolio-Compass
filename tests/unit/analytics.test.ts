import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { calculateOverlap } from '@/lib/analytics';
import { Decimal } from '@/lib/decimal';

// Mock Prisma
const mockFindMany = mock();

mock.module('@/lib/db', () => ({
  default: {
    holding: {
      findMany: mockFindMany
    }
  }
}));

describe('calculateOverlap', () => {
  it('should calculate overlap correctly', async () => {
    // Setup mock data
    const holdingsA = [
      { ticker: 'AAPL', name: 'Apple', weight: new Decimal(10) },
      { ticker: 'MSFT', name: 'Microsoft', weight: new Decimal(5) },
      { ticker: 'GOOGL', name: 'Alphabet', weight: new Decimal(2) },
    ];

    const holdingsB = [
      { ticker: 'AAPL', name: 'Apple', weight: new Decimal(8) },  // Overlap: 8
      { ticker: 'MSFT', name: 'Microsoft', weight: new Decimal(6) }, // Overlap: 5
      { ticker: 'AMZN', name: 'Amazon', weight: new Decimal(4) },
    ];

    // Mock implementation for sequential calls
    mockFindMany.mockImplementation(async (args: any) => {
        if (args.where.etfId === 'ETF_A') return holdingsA;
        if (args.where.etfId === 'ETF_B') return holdingsB;
        return [];
    });

    const result = await calculateOverlap('ETF_A', 'ETF_B');

    // Expected Overlap Score: min(10, 8) + min(5, 6) = 8 + 5 = 13
    expect(result.overlapScore).toBe(13);

    // Expected Common Holdings
    expect(result.commonHoldings).toHaveLength(2);

    const aapl = result.commonHoldings.find(h => h.ticker === 'AAPL');
    expect(aapl).toBeDefined();
    expect(aapl?.weightInA).toBe(10);
    expect(aapl?.weightInB).toBe(8);

    const msft = result.commonHoldings.find(h => h.ticker === 'MSFT');
    expect(msft).toBeDefined();
    expect(msft?.weightInA).toBe(5);
    expect(msft?.weightInB).toBe(6);
  });

  it('should return 0 overlap if no common holdings', async () => {
      mockFindMany.mockImplementation(async (args: any) => {
          if (args.where.etfId === 'ETF_A') return [{ ticker: 'A', name: 'A', weight: new Decimal(10) }];
          if (args.where.etfId === 'ETF_B') return [{ ticker: 'B', name: 'B', weight: new Decimal(10) }];
          return [];
      });

      const result = await calculateOverlap('ETF_A', 'ETF_B');
      expect(result.overlapScore).toBe(0);
      expect(result.commonHoldings).toHaveLength(0);
  });
});
