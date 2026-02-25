import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Decimal } from '@/lib/decimal';

// Define mocks
const mockPrismaUpsert = mock(() => Promise.resolve({}));
const mockPrismaFindFirst = mock(() => Promise.resolve(null));
const mockPrismaFindUnique = mock(() => Promise.resolve(null));
const mockPrismaDeleteMany = mock(() => Promise.resolve({ count: 0 }));
const mockPrismaCreateMany = mock(() => Promise.resolve({ count: 0 }));
const mockPrismaUpdate = mock(() => Promise.resolve({}));
const mockPrismaCreate = mock(() => Promise.resolve({}));
const mockPrismaCount = mock(() => Promise.resolve(0));
// Added missing mock for etfAllocation.upsert
const mockPrismaAllocationUpsert = mock(() => Promise.resolve({}));

// Mock Transaction Client
const mockTx = {
    etfSector: {
        deleteMany: mockPrismaDeleteMany,
        createMany: mockPrismaCreateMany,
    },
    etfAllocation: {
        upsert: mockPrismaAllocationUpsert,
    },
    etfHistory: {
        deleteMany: mockPrismaDeleteMany,
        createMany: mockPrismaCreateMany,
    },
    holding: {
        deleteMany: mockPrismaDeleteMany,
        createMany: mockPrismaCreateMany,
    }
};

const mockPrismaTransaction = mock(async (callback) => {
    return await callback(mockTx);
});

const mockFetchEtfDetails = mock(() => Promise.resolve(null));
const mockGetEtfHoldings = mock(() => Promise.resolve([]));

mock.module('@/lib/db', () => {
  return {
    default: {
      etfHistory: {
        findFirst: mockPrismaFindFirst,
        deleteMany: mockPrismaDeleteMany,
        createMany: mockPrismaCreateMany,
        count: mockPrismaCount,
      },
      etf: {
        upsert: mockPrismaUpsert,
        findUnique: mockPrismaFindUnique,
      },
      etfSector: {
        deleteMany: mockPrismaDeleteMany,
        createMany: mockPrismaCreateMany,
      },
      etfAllocation: {
        findUnique: mockPrismaFindUnique,
        update: mockPrismaUpdate,
        create: mockPrismaCreate,
        upsert: mockPrismaAllocationUpsert,
      },
      holding: {
        deleteMany: mockPrismaDeleteMany,
        createMany: mockPrismaCreateMany,
      },
      $transaction: mockPrismaTransaction,
    }
  };
});

mock.module('@/lib/market-service', () => {
  return {
    fetchEtfDetails: mockFetchEtfDetails
  };
});

mock.module('@/lib/scrapers/stock-analysis', () => {
  return {
    getEtfHoldings: mockGetEtfHoldings
  };
});

// Import after mocks
const { syncEtfDetails } = await import('../../../lib/etf-sync');

describe('Lib: syncEtfDetails', () => {
  beforeEach(() => {
    mockPrismaUpsert.mockClear();
    mockPrismaFindFirst.mockClear();
    mockPrismaFindUnique.mockClear();
    mockPrismaDeleteMany.mockClear();
    mockPrismaCreateMany.mockClear();
    mockFetchEtfDetails.mockClear();
    mockGetEtfHoldings.mockClear();
    mockPrismaTransaction.mockClear();
    mockPrismaAllocationUpsert.mockClear();
    mockPrismaCount.mockClear();
  });

  it('should delete overlapping daily history before inserting', async () => {
    const ticker = 'TEST';
    const today = new Date().toISOString().split('T')[0];

    // Mock existing history so fromDate is defined (triggering incremental logic)
    mockPrismaFindFirst.mockResolvedValue({ date: new Date('2023-01-01') });
    // Mock sufficient history count to trigger incremental sync logic
    mockPrismaCount.mockResolvedValue(300);

    // Mock fetchEtfDetails returning history with today's date
    mockFetchEtfDetails.mockResolvedValue({
      ticker: ticker,
      name: 'Test ETF',
      price: new Decimal(100),
      dailyChange: new Decimal(1.5),
      assetType: 'ETF',
      description: 'Desc',
      sectors: {},
      history: [
        { date: `${today}T00:00:00.000Z`, close: new Decimal(105), interval: '1d' }
      ]
    });

    // Mock Upsert returning basic ETF info
    mockPrismaUpsert.mockResolvedValue({ ticker, assetType: 'ETF' });

    // Mock FindUnique returning full ETF (end of function)
    mockPrismaFindUnique.mockResolvedValue({
        ticker,
        history: [],
        sectors: [],
        allocation: null,
        holdings: []
    });

    await syncEtfDetails(ticker);

    // Verify deleteMany was called for history with correct args
    expect(mockPrismaDeleteMany).toHaveBeenCalled();
    const deleteCalls = mockPrismaDeleteMany.mock.calls;

    const historyDeleteCall = deleteCalls.find(call => {
        const arg = call[0];
        return arg && arg.where && arg.where.etfId === ticker && arg.where.interval === '1d';
    });

    expect(historyDeleteCall).toBeDefined();
    if (historyDeleteCall) {
        expect(historyDeleteCall[0].where.date).toBeDefined();
        expect(historyDeleteCall[0].where.date.in).toBeDefined();
        expect(historyDeleteCall[0].where.date.in).toHaveLength(1);
    }
  });

  it('should use IN clause for overlapping deletion regardless of dataset size', async () => {
    const ticker = 'LARGE_HISTORY';

    // Mock existing history so fromDate is defined (triggering incremental logic)
    mockPrismaFindFirst.mockResolvedValue({ date: new Date('2023-01-01') });
    // Mock sufficient history count to trigger incremental sync logic
    mockPrismaCount.mockResolvedValue(300);

    // Generate 150 days of history
    const history = Array.from({ length: 150 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return {
            date: d.toISOString(),
            close: new Decimal(100 + i),
            interval: '1d'
        };
    });

    mockFetchEtfDetails.mockResolvedValue({
      ticker: ticker,
      name: 'Test ETF',
      price: new Decimal(100),
      dailyChange: new Decimal(1.5),
      assetType: 'ETF',
      description: 'Desc',
      sectors: {},
      history: history
    });

    mockPrismaUpsert.mockResolvedValue({ ticker, assetType: 'ETF' });
    mockPrismaFindUnique.mockResolvedValue({
        ticker,
        history: [],
        sectors: [],
        allocation: null,
        holdings: []
    });

    await syncEtfDetails(ticker);

    // Verify deleteMany uses IN clause instead of risky range deletion
    const deleteCalls = mockPrismaDeleteMany.mock.calls;
    const historyDeleteCall = deleteCalls.find(call => {
        const arg = call[0];
        return arg && arg.where && arg.where.etfId === ticker && arg.where.interval === '1d';
    });

    expect(historyDeleteCall).toBeDefined();
    if (historyDeleteCall) {
        const where = historyDeleteCall[0].where;
        expect(where.date.in).toBeDefined();
        expect(where.date.in.length).toBe(150);
        expect(where.date.gte).toBeUndefined();
        expect(where.date.lte).toBeUndefined();
    }
  });

  it('should normalize StockAnalysis decimal weights to percentages', async () => {
      const ticker = 'LEVERAGED';

      mockFetchEtfDetails.mockResolvedValue({
          ticker,
          name: 'Leveraged ETF',
          price: new Decimal(100),
          dailyChange: new Decimal(1.5),
          assetType: 'ETF',
          description: 'Desc',
          sectors: {},
          history: []
      });

      // IMPORTANT: Mock upsert to return assetType: 'ETF' so the holdings logic runs
      mockPrismaUpsert.mockResolvedValue({ ticker, assetType: 'ETF' });

      // Mock StockAnalysis returning decimal weights
      // 2.0 = 200% (Leveraged)
      // 0.5 = 50%
      mockGetEtfHoldings.mockResolvedValue([
          { symbol: 'A', name: 'Asset A', weight: 2.0, shares: null },
          { symbol: 'B', name: 'Asset B', weight: 0.5, shares: null }
      ]);

      mockPrismaFindUnique.mockResolvedValue({
          ticker,
          history: [],
          sectors: [],
          allocation: null,
          holdings: []
      });

      await syncEtfDetails(ticker);

      // Verify transaction calls
      expect(mockPrismaTransaction).toHaveBeenCalled();

      // Since we use a transaction, deleteMany and createMany are called on the mockTx object
      // which references the same mockPrismaCreateMany function
      const createCalls = mockPrismaCreateMany.mock.calls;

      const holdingCreateCall = createCalls.find(call => {
          const arg = call[0];
          return arg && arg.data && Array.isArray(arg.data) && arg.data.some((h: any) => h.ticker === 'A');
      });

      expect(holdingCreateCall).toBeDefined();
      if (holdingCreateCall) {
          const holdings = holdingCreateCall[0].data;
          const holdingA = holdings.find((h: any) => h.ticker === 'A');
          const holdingB = holdings.find((h: any) => h.ticker === 'B');

          // Expect weights to be multiplied by 100
          // Verify string values ("200" and "50") as per toPrismaDecimalRequired
          expect(holdingA.weight).toEqual("200"); // 2.0 * 100
          expect(holdingB.weight).toEqual("50");  // 0.5 * 100
      }
  });

  it('should avoid range deletion (gte/lte) for sparse updates > 100 items to prevent data loss', async () => {
      const ticker = 'SPARSE_HISTORY';

      // Mock existing history so fromDate is defined (triggering incremental logic)
      mockPrismaFindFirst.mockResolvedValue({ date: new Date('2023-01-01') });
      mockPrismaCount.mockResolvedValue(300);

      // Generate 150 days of history with a massive gap
      const part1 = Array.from({ length: 50 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - 200 + i); // 200 days ago to 150 days ago
          return {
              date: d.toISOString(),
              close: new Decimal(100),
              interval: '1d'
          };
      });

      const part2 = Array.from({ length: 100 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - 100 + i); // 100 days ago to today
          return {
              date: d.toISOString(),
              close: new Decimal(100),
              interval: '1d'
          };
      });

      const history = [...part1, ...part2]; // Total 150 items

      mockFetchEtfDetails.mockResolvedValue({
        ticker: ticker,
        name: 'Sparse ETF',
        price: new Decimal(100),
        dailyChange: new Decimal(1.5),
        assetType: 'ETF',
        description: 'Desc',
        sectors: {},
        history: history
      });

      mockPrismaUpsert.mockResolvedValue({ ticker, assetType: 'ETF' });
      mockPrismaFindUnique.mockResolvedValue({
          ticker,
          history: [],
          sectors: [],
          allocation: null,
          holdings: []
      });

      await syncEtfDetails(ticker);

      // Verify deleteMany uses IN clause, NOT gte/lte
      const deleteCalls = mockPrismaDeleteMany.mock.calls;
      const historyDeleteCall = deleteCalls.find(call => {
          const arg = call[0];
          return arg && arg.where && arg.where.etfId === ticker && arg.where.interval === '1d';
      });

      expect(historyDeleteCall).toBeDefined();
      if (historyDeleteCall) {
          const where = historyDeleteCall[0].where;

          // Asserting strict safety:
          expect(where.date.gte).toBeUndefined();
          expect(where.date.lte).toBeUndefined();
          expect(where.date.in).toBeDefined();
          expect(where.date.in.length).toBe(150);
      }
  });
});
