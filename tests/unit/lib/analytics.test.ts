import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mocks
const mockPrismaFindMany = mock(() => Promise.resolve([]));

mock.module('@/lib/db', () => {
  return {
    default: {
      holding: {
        findMany: mockPrismaFindMany
      }
    }
  };
});

// Dynamic import to pick up mocks
const { calculateOverlap } = await import('@/lib/analytics');

describe('Analytics: calculateOverlap', () => {
  beforeEach(() => {
    mockPrismaFindMany.mockClear();
  });

  it('should calculate overlap score and common holdings correctly', async () => {
    // Setup mock data
    // ETF A Holdings: AAPL 10%, MSFT 5%, NVDA 3%
    const holdingsA = [
      { ticker: 'AAPL', name: 'Apple', weight: { toNumber: () => 10 } },
      { ticker: 'MSFT', name: 'Microsoft', weight: { toNumber: () => 5 } },
      { ticker: 'NVDA', name: 'Nvidia', weight: { toNumber: () => 3 } }
    ];

    // ETF B Holdings: AAPL 8%, MSFT 7%, GOOGL 4%
    // Common: AAPL (min 8%), MSFT (min 5%) -> Score = 13%
    const holdingsB = [
      { ticker: 'AAPL', name: 'Apple', weight: { toNumber: () => 8 } },
      { ticker: 'MSFT', name: 'Microsoft', weight: { toNumber: () => 7 } },
      { ticker: 'GOOGL', name: 'Google', weight: { toNumber: () => 4 } }
    ];

    mockPrismaFindMany.mockImplementation((args: any) => {
      if (args.where.etfId === 'ETF_A') return Promise.resolve(holdingsA);
      if (args.where.etfId === 'ETF_B') return Promise.resolve(holdingsB);
      return Promise.resolve([]);
    });

    const result = await calculateOverlap('ETF_A', 'ETF_B');

    expect(result.overlapScore).toBe(13); // 8 + 5
    expect(result.commonHoldings).toHaveLength(2);

    // CURRENT BEHAVIOR (Before Fix): Sort by weightInA + weightInB
    // AAPL: min(10, 8) = 8
    // MSFT: min(5, 7) = 5
    // Expected order: AAPL (8), MSFT (5)
    expect(result.commonHoldings[0].ticker).toBe('AAPL');
    expect(result.commonHoldings[1].ticker).toBe('MSFT');
  });

  it('should verify sorting order is by intersection weight (min)', async () => {
     // ETF A: X 10, Y 2
     // ETF B: X 1, Y 10

     // Common:
     // X: A=10, B=1. Sum=11. Min=1.
     // Y: A=2, B=10. Sum=12. Min=2.

     // Current Sort (Sum): Y (12) > X (11) -> Y first
     // Proposed Sort (Min/Overlap): Y (2) > X (1) -> Y first? Wait.

     // Let's make a case where Sum and Min order differ.
     // Case:
     // Stock 1: A=50, B=1. Sum=51. Min=1.
     // Stock 2: A=10, B=10. Sum=20. Min=10.

     // Old (Sum): Stock 1 (51) > Stock 2 (20). Order: Stock 1, Stock 2.
     // New (Min): Stock 2 (10) > Stock 1 (1). Order: Stock 2, Stock 1.

    const holdingsA = [
        { ticker: 'STOCK1', name: 'Stock One', weight: { toNumber: () => 50 } },
        { ticker: 'STOCK2', name: 'Stock Two', weight: { toNumber: () => 10 } }
      ];

      const holdingsB = [
        { ticker: 'STOCK1', name: 'Stock One', weight: { toNumber: () => 1 } },
        { ticker: 'STOCK2', name: 'Stock Two', weight: { toNumber: () => 10 } }
      ];

      mockPrismaFindMany.mockImplementation((args: any) => {
        if (args.where.etfId === 'ETF_A') return Promise.resolve(holdingsA);
        if (args.where.etfId === 'ETF_B') return Promise.resolve(holdingsB);
        return Promise.resolve([]);
      });

      const result = await calculateOverlap('ETF_A', 'ETF_B');

      // We expect the NEW FIXED behavior here
      // Min Overlap logic:
      // Stock 1 Min: 1
      // Stock 2 Min: 10
      // So Stock 2 should be first.
      expect(result.commonHoldings[0].ticker).toBe('STOCK2');
      expect(result.commonHoldings[1].ticker).toBe('STOCK1');
  });
});
