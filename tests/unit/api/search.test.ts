import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mocks
const mockPrismaFindMany = mock(() => Promise.resolve([]));
const mockPrismaCreate = mock(() => Promise.resolve({}));
const mockFetchMarketSnapshot = mock(() => Promise.resolve([]));
const mockSyncEtfDetails = mock(() => Promise.resolve(null));

mock.module('@/lib/db', () => {
  return {
    default: {
      etf: {
        findMany: mockPrismaFindMany,
        create: mockPrismaCreate,
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

describe('API: /api/etfs/search', () => {
  beforeEach(() => {
    mockPrismaFindMany.mockClear();
    mockPrismaCreate.mockClear();
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

    // Mock create to return something valid but SCALARS ONLY to simulate real Prisma behavior
    mockPrismaCreate.mockImplementation((args: any) => Promise.resolve({
        ...args.data,
        price: Number(args.data.price),
        daily_change: Number(args.data.daily_change),
        updatedAt: new Date(),
        // Note: No relations here, as Prisma doesn't return them unless included.
        // But since we added 'include: includeObj', the mock SHOULD return them if we want to be accurate to "successful include".
        // However, if we want to test robustness against missing relations, we can omit them.
        // BUT, the code now requests include, so Prisma WOULD return them (as empty arrays/null).
        history: [],
        sectors: [],
        allocation: null
    }));

    const request = new NextRequest('http://localhost/api/etfs/search?limit=100');
    const response: any = await GET(request);

    expect(mockFetchMarketSnapshot).toHaveBeenCalled();
    expect(mockPrismaCreate).toHaveBeenCalled();
    expect(response._data).toHaveLength(1);
    expect(response._data[0].ticker).toBe('SPY');
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
      allocation: { stocks_weight: 99, bonds_weight: 1, cash_weight: 0 }
    };

    mockPrismaFindMany.mockResolvedValue([mockEtf]);

    const request = new NextRequest('http://localhost/api/etfs/search?query=VTI');
    const response: any = await GET(request);

    expect(response._data).toHaveLength(1);
    expect(response._data[0].ticker).toBe('VTI');
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

    // Mock create to return SCALARS ONLY + included empty relations (simulating include: true)
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
    mockPrismaCreate.mockResolvedValue(createdEtf);

    const request = new NextRequest('http://localhost/api/etfs/search?query=NEW');
    const response: any = await GET(request);

    expect(mockSyncEtfDetails).toHaveBeenCalledWith('NEW');
    expect(mockFetchMarketSnapshot).toHaveBeenCalledWith(['NEW']);
    expect(mockPrismaCreate).toHaveBeenCalled();

    // Check if 'include' was passed to create
    const createCall = mockPrismaCreate.mock.calls[0][0];
    expect(createCall.include).toBeDefined();

    expect(response._data).toHaveLength(1);
    expect(response._data[0].ticker).toBe('NEW');
  });
});
