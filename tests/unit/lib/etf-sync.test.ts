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
    },
    etf: {
        upsert: mockPrismaUpsert
    },
    sectorAllocation: {
        deleteMany: mockPrismaDeleteMany,
        createMany: mockPrismaCreateMany
    }
};

const mockPrismaTransaction = mock(async (callback) => {
    return await callback(mockTx);
});

const mockFetchEtfDetails = mock(() => Promise.resolve(null));

mock.module('@/lib/db', () => {
  return {
    prisma: {
      etfHistory: {
        findFirst: mockPrismaFindFirst,
        deleteMany: mockPrismaDeleteMany,
        createMany: mockPrismaCreateMany,
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
    },
    default: {
        etfHistory: {
          findFirst: mockPrismaFindFirst,
          deleteMany: mockPrismaDeleteMany,
          createMany: mockPrismaCreateMany,
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
    mockPrismaTransaction.mockClear();
    mockPrismaAllocationUpsert.mockClear();
  });

  it('should delete overlapping daily history before inserting', async () => {
    const ticker = 'TEST';
    const today = new Date().toISOString().split('T')[0];

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
        { date: `${today}T00:00:00.000Z`, price: new Decimal(105), interval: '1d' }
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

    await syncEtfDetails(ticker, true);

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
          sectors: [],
          history: [],
          holdings: [
             { symbol: 'A', name: 'Asset A', percent: 200, shares: null },
             { symbol: 'B', name: 'Asset B', percent: 50, shares: null }
          ]
      });

      // IMPORTANT: Mock upsert to return assetType: 'ETF' so the holdings logic runs
      mockPrismaUpsert.mockResolvedValue({ ticker, assetType: 'ETF' });


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

          // Check for Decimal instances
          expect(holdingA.weight.toString()).toEqual("200");
          expect(holdingB.weight.toString()).toEqual("50");
      }
  });
});
