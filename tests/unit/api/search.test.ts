import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Decimal } from '@/lib/decimal';

// Mocks
const mockPrismaFindMany = mock(() => Promise.resolve([]));
const mockPrismaCreate = mock(() => Promise.resolve({}));
const mockPrismaUpsert = mock(() => Promise.resolve({}));
const mockFetchMarketSnapshot = mock(() => Promise.resolve([]));
const mockProcessBackgroundSync = mock(() => Promise.resolve());
const mockUpsertEtfWithFallback = mock(() => Promise.resolve({}));

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

// We must mock sync-service because the route uses it directly
mock.module('@/lib/services/sync-service', () => {
    return {
        processBackgroundSync: mockProcessBackgroundSync,
        upsertEtfWithFallback: mockUpsertEtfWithFallback,
        dbLimit: (fn: any) => fn(),
        createFallbackEtf: (item: any) => ({
            ticker: item.ticker,
            name: item.name,
            price: item.price,
            daily_change: item.dailyChangePercent,
            assetType: item.assetType || "ETF",
            isDeepAnalysisLoaded: false,
            yield: new Decimal(0),
            mer: new Decimal(0),
            history: [],
            sectors: [],
            allocation: null,
            updatedAt: new Date(),
        })
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
    mockProcessBackgroundSync.mockClear();
    mockUpsertEtfWithFallback.mockClear();

    // Default behaviors
    mockPrismaFindMany.mockResolvedValue([]);
    mockProcessBackgroundSync.mockResolvedValue(undefined);
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

    // Mock upsert fallback response
    mockUpsertEtfWithFallback.mockImplementation((item: any) => {
        return Promise.resolve({
            ticker: item.ticker,
            name: item.name,
            price: Number(item.price),
            daily_change: Number(item.dailyChangePercent),
            assetType: item.assetType,
            isDeepAnalysisLoaded: false,
            yield: new Decimal(0),
            mer: new Decimal(0),
            history: [],
            sectors: [],
            allocation: null,
            updatedAt: new Date(),
        });
    });

    const request = new NextRequest('http://localhost/api/etfs/search?limit=100');
    const response: any = await GET(request);

    expect(mockFetchMarketSnapshot).toHaveBeenCalled();
    expect(mockUpsertEtfWithFallback).toHaveBeenCalled();
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
  });

  it('should trigger background sync on local miss/stale', async () => {
    // This test logic changed: route.ts now calls processBackgroundSync.
    // We mock processBackgroundSync.
    // So we just verify it was called.
    const mockEtf = {
        ticker: 'OLD',
        name: 'Old Asset',
        updatedAt: new Date('2000-01-01'), // Stale
        isDeepAnalysisLoaded: true,
        price: 100,
        daily_change: 0,
        assetType: 'ETF',
        history: [], sectors: [], allocation: null
    };
    mockPrismaFindMany.mockResolvedValue([mockEtf]);

    const request = new NextRequest('http://localhost/api/etfs/search?query=OLD');
    await GET(request);

    expect(mockProcessBackgroundSync).toHaveBeenCalled();
  });

  it('should fallback to snapshot if deep sync fails', async () => {
    // This logic relies on "Handle query-based fetching for missing tickers" block in route.ts
    // which calls fetchMarketSnapshot and upsertEtfWithFallback.
    mockPrismaFindMany.mockResolvedValue([]); // Local miss

    const liveData = [{
      ticker: 'NEW',
      name: 'New Asset',
      price: 100,
      dailyChangePercent: 2.0,
      assetType: 'STOCK'
    }];
    mockFetchMarketSnapshot.mockResolvedValue(liveData);

    mockUpsertEtfWithFallback.mockResolvedValue({
      ticker: 'NEW',
      name: 'New Asset',
      price: 100,
      daily_change: 2.0,
      assetType: 'STOCK',
      isDeepAnalysisLoaded: false,
      history: [], sectors: [], allocation: null
    });

    const request = new NextRequest('http://localhost/api/etfs/search?query=NEW');
    const response: any = await GET(request);

    expect(mockFetchMarketSnapshot).toHaveBeenCalledWith(['NEW']);
    expect(mockUpsertEtfWithFallback).toHaveBeenCalled();

    expect(response._data).toHaveLength(1);
    expect(response._data[0].ticker).toBe('NEW');
  });
});
