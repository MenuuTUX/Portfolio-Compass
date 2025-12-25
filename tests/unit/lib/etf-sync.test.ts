import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Decimal } from 'decimal.js';

// Mocks
const mockPrismaUpsert = mock(() => Promise.resolve({}));
const mockPrismaFindFirst = mock(() => Promise.resolve(null));
const mockPrismaFindUnique = mock(() => Promise.resolve(null));
const mockPrismaDeleteMany = mock(() => Promise.resolve({ count: 0 }));
const mockPrismaCreateMany = mock(() => Promise.resolve({ count: 0 }));
const mockPrismaUpdate = mock(() => Promise.resolve({}));
const mockPrismaCreate = mock(() => Promise.resolve({}));
const mockPrismaTransaction = mock(() => Promise.resolve([]));

const mockFetchEtfDetails = mock(() => Promise.resolve(null));
const mockGetEtfHoldings = mock(() => Promise.resolve([]));

mock.module('@/lib/db', () => {
  return {
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
        { date: `${today}T00:00:00.000Z`, close: new Decimal(105), interval: '1d' }
      ]
    });

    // Mock Upsert returning basic ETF info
    mockPrismaUpsert.mockResolvedValue({ ticker });

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

    // Find the call for etfHistory
    // Note: deleteMany is called for sectors, holdings, etc.
    // We need to inspect the arguments.
    const historyDeleteCall = deleteCalls.find(call => {
        const arg = call[0];
        return arg && arg.where && arg.where.etfId === ticker && arg.where.interval === '1d';
    });

    expect(historyDeleteCall).toBeDefined();
    if (historyDeleteCall) {
        expect(historyDeleteCall[0].where.date).toBeDefined();
        // Since we passed dates in an 'in' array
        expect(historyDeleteCall[0].where.date.in).toBeDefined();
        expect(historyDeleteCall[0].where.date.in).toHaveLength(1);
    }

    // Verify createMany was called
    const createCalls = mockPrismaCreateMany.mock.calls;
    const historyCreateCall = createCalls.find(call => {
        const arg = call[0];
        return arg && arg.data && Array.isArray(arg.data) && arg.data.length > 0 && arg.data[0].interval === '1d';
    });

    expect(historyCreateCall).toBeDefined();
    if (historyCreateCall) {
        expect(historyCreateCall[0].data[0].close).toEqual(new Decimal(105));
    }
  });
});
