import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Decimal } from 'decimal.js';

// Mocks
const mockPrismaFindMany = mock(() => Promise.resolve([]));
const mockPrismaCreate = mock(() => Promise.resolve({}));
const mockPrismaUpsert = mock(() => Promise.resolve({}));
const mockFetchMarketSnapshot = mock(() => Promise.resolve([]));
const mockSyncEtfDetails = mock(() => Promise.resolve(null));

mock.module('@/lib/db', () => {
  return {
    default: {
      etf: {
        findMany: mockPrismaFindMany,
        create: mockPrismaCreate,
        upsert: mockPrismaUpsert,
        findUnique: mock(() => Promise.resolve(null))
      }
    }
  };
});

mock.module('@/lib/market-service', () => {
  return {
    fetchMarketSnapshot: mockFetchMarketSnapshot,
    fetchEtfDetails: mock(() => Promise.resolve({}))
  };
});

mock.module('@/lib/etf-sync', () => {
    return {
        syncEtfDetails: mockSyncEtfDetails
    };
});

mock.module('next/server', () => {
  return {
    NextRequest: class {
      nextUrl: URL;
      constructor(url: string) {
        this.nextUrl = new URL(url);
      }
    },
    NextResponse: {
      json: (data: any, init?: any) => ({
        _data: data,
        status: init?.status || 200,
        headers: new Headers(init?.headers)
      })
    }
  };
});

// Dynamic import
const { GET } = await import('../../../app/api/etfs/search/route');
const { NextRequest } = await import('next/server');
const { ETFSchema } = await import('../../../schemas/assetSchema');

describe('API: /api/etfs/search', () => {
  beforeEach(() => {
    mockPrismaFindMany.mockClear();
    mockPrismaCreate.mockClear();
    mockPrismaUpsert.mockClear();
    mockFetchMarketSnapshot.mockClear();
    mockSyncEtfDetails.mockClear();

    // Default behaviors
    mockPrismaFindMany.mockResolvedValue([]);
    mockSyncEtfDetails.mockResolvedValue(null);
  });

  it('should seed default tickers if no query and no local data', async () => {
    mockPrismaFindMany.mockResolvedValue([]);
    const defaultTickersMock = [{
        ticker: 'SPY',
        name: 'SPDR S&P 500',
        price: 500,
        dailyChangePercent: 0.5,
        assetType: 'ETF'
    }];
    mockFetchMarketSnapshot.mockResolvedValue(defaultTickersMock);

    // Mock upsert
    mockPrismaUpsert.mockImplementation((args: any) => {
        const result: any = {
            ...args.create,
            price: Number(args.create.price),
            daily_change: Number(args.create.daily_change),
            updatedAt: new Date(),
        };

        if (args.include) {
            if (args.include.history) result.history = [];
            if (args.include.sectors) result.sectors = [];
            if (args.include.allocation) result.allocation = null;
        }

        return Promise.resolve(result);
    });

    const request = new NextRequest('http://localhost/api/etfs/search?limit=100');
    const response: any = await GET(request);

    expect(mockFetchMarketSnapshot).toHaveBeenCalled();
    expect(mockPrismaUpsert).toHaveBeenCalled();
    expect(response._data).toHaveLength(1);
    expect(response._data[0].ticker).toBe('SPY');

    // Schema Validation
    const parseResult = ETFSchema.safeParse(response._data[0]);
    if (!parseResult.success) console.error(parseResult.error);
    expect(parseResult.success).toBe(true);
  });

  it('should return local data if found', async () => {
    const mockEtf = {
      ticker: 'VTI',
      name: 'Vanguard Total Stock Market',
      price: 200,
      daily_change: 1.5,
      assetType: 'ETF',
      isDeepAnalysisLoaded: true,
      updatedAt: new Date(),
      history: [{ date: new Date(), close: 200, interval: 'daily' }],
      sectors: [{ sector_name: 'Tech', weight: 20 }],
      allocation: { stocks_weight: 99, bonds_weight: 1, cash_weight: 0 },
      yield: new Decimal(1.5),
    };

    mockPrismaFindMany.mockResolvedValue([mockEtf]);

    const request = new NextRequest('http://localhost/api/etfs/search?query=VTI');
    const response: any = await GET(request);

    expect(response._data).toHaveLength(1);
    expect(response._data[0].ticker).toBe('VTI');
    expect(response._data[0].metrics.yield).toBe(1.5);
    expect(response._data[0].dividendYield).toBe(1.5);

    // Schema Validation
    const parseResult = ETFSchema.safeParse(response._data[0]);
    expect(parseResult.success).toBe(true);
  });

  it('should attempt deep sync on local miss', async () => {
    mockPrismaFindMany.mockResolvedValue([]); // Local miss

    // Mock successful sync
    const syncedEtf = {
      ticker: 'HQU.TO',
      name: 'BetaPro',
      price: 25,
      daily_change: 0,
      assetType: 'ETF',
      isDeepAnalysisLoaded: true,
      updatedAt: new Date(),
      history: [],
      sectors: [],
      allocation: null
    };
    mockSyncEtfDetails.mockResolvedValue(syncedEtf);

    const request = new NextRequest('http://localhost/api/etfs/search?query=HQU.TO');
    const response: any = await GET(request);

    expect(mockSyncEtfDetails).toHaveBeenCalledWith('HQU.TO');
    expect(mockFetchMarketSnapshot).not.toHaveBeenCalledWith(['HQU.TO']);

    expect(response._data).toHaveLength(1);
    expect(response._data[0].ticker).toBe('HQU.TO');

    // Schema Validation
    const parseResult = ETFSchema.safeParse(response._data[0]);
    expect(parseResult.success).toBe(true);
  });

  it('should fallback to snapshot if deep sync fails', async () => {
    mockPrismaFindMany.mockResolvedValue([]); // Local miss
    mockSyncEtfDetails.mockResolvedValue(null); // Sync fails

    const liveData = [{
      ticker: 'NEW',
      name: 'New Asset',
      price: 100,
      dailyChangePercent: 2.0,
      assetType: 'STOCK'
    }];
    mockFetchMarketSnapshot.mockResolvedValue(liveData);

    // Mock upsert
    const createdEtf = {
      ticker: 'NEW',
      name: 'New Asset',
      price: 100,
      daily_change: 2.0,
      assetType: 'STOCK',
      isDeepAnalysisLoaded: false,
      updatedAt: new Date(),
      history: [],
      sectors: [],
      allocation: null
    };
    mockPrismaUpsert.mockResolvedValue(createdEtf);

    const request = new NextRequest('http://localhost/api/etfs/search?query=NEW');
    const response: any = await GET(request);

    expect(mockSyncEtfDetails).toHaveBeenCalledWith('NEW');
    expect(mockFetchMarketSnapshot).toHaveBeenCalledWith(['NEW']);
    expect(mockPrismaUpsert).toHaveBeenCalled();

    // Check if 'include' was passed to upsert
    const upsertCall = mockPrismaUpsert.mock.calls[0][0];
    expect(upsertCall.include).toBeDefined();

    expect(response._data).toHaveLength(1);
    expect(response._data[0].ticker).toBe('NEW');

    // Schema Validation
    const parseResult = ETFSchema.safeParse(response._data[0]);
    expect(parseResult.success).toBe(true);
  });

  it('should handle potentially null fields by converting to undefined', async () => {
      // Setup specific mock that returns nulls for optional fields
      const nullFieldEtf = {
        ticker: 'NULLY',
        name: 'Null Fields ETF',
        price: 100,
        daily_change: 0,
        assetType: 'ETF',
        isDeepAnalysisLoaded: true,
        updatedAt: new Date(),
        // Prisma typically returns null for optional fields if they are missing
        history: [{ date: new Date(), close: 100, interval: 'daily' }], // interval 'daily' should be undefined in API
        sectors: [],
        allocation: null, // Should handle null allocation
        holdings: [
            { ticker: 'SUB', name: 'Sub', weight: 10, sector: 'Tech', shares: null } // shares: null should be undefined
        ],
        // Extended metrics as nulls
        marketCap: null,
        dividend: null
      };

      mockPrismaFindMany.mockResolvedValue([nullFieldEtf]);

      const request = new NextRequest('http://localhost/api/etfs/search?query=NULLY');
      const response: any = await GET(request);

      expect(response._data).toHaveLength(1);
      const item = response._data[0];

      // Assertions for undefined transformation
      expect(item.history[0].interval).toBeUndefined();
      expect(item.holdings[0].shares).toBeUndefined();
      expect(item.marketCap).toBeUndefined();
      expect(item.dividend).toBeUndefined();

      // Schema Validation
      const parseResult = ETFSchema.safeParse(item);
      if (!parseResult.success) {
          console.error("Schema validation failed for null-field test:", parseResult.error);
      }
      expect(parseResult.success).toBe(true);
  });
});
