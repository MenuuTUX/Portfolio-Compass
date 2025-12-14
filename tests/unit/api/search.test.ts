import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mocks
const mockPrismaFindMany = mock(() => Promise.resolve([]));
const mockPrismaCreate = mock(() => Promise.resolve({}));
const mockFetchMarketSnapshot = mock(() => Promise.resolve([]));

mock.module('@/lib/db', () => {
  return {
    default: {
      etf: {
        findMany: mockPrismaFindMany,
        create: mockPrismaCreate
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

// Mock etf-sync so we don't actually trigger syncing logic during API tests
mock.module('@/lib/etf-sync', () => {
    return {
        syncEtfDetails: mock(() => Promise.resolve({}))
    };
});

// We need to mock NextRequest and NextResponse
// Simple mocks for the purpose of testing the logic
const mockJson = mock((data: any) => ({
    json: async () => data,
    status: 200,
    _data: data
}));

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
    mockPrismaFindMany.mockResolvedValue([]);
  });

  it('should return empty list if no query and no local data', async () => {
    mockPrismaFindMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/etfs/search');
    const response: any = await GET(request);

    expect(response.status).toBe(200);
    expect(response._data).toEqual([]);
    expect(mockPrismaFindMany).toHaveBeenCalled();
  });

  it('should return local data if found', async () => {
    const mockEtf = {
      ticker: 'VTI',
      name: 'Vanguard Total Stock Market',
      price: 200,
      daily_change: 1.5,
      assetType: 'ETF',
      isDeepAnalysisLoaded: true,
      history: [],
      sectors: [{ sector_name: 'Tech', weight: 20 }],
      allocation: { stocks_weight: 99, bonds_weight: 1, cash_weight: 0 }
    };

    mockPrismaFindMany.mockResolvedValue([mockEtf]);

    const request = new NextRequest('http://localhost/api/etfs/search?query=VTI');
    const response: any = await GET(request);

    expect(response.status).toBe(200);
    expect(response._data).toHaveLength(1);
    expect(response._data[0].ticker).toBe('VTI');
    expect(response._data[0].sectors['Tech']).toBe(20);
  });

  it('should attempt live fetch if local data missing', async () => {
    mockPrismaFindMany.mockResolvedValue([]); // Local miss

    const liveData = [{
      ticker: 'NEW',
      name: 'New Asset',
      price: 100,
      dailyChangePercent: 2.0,
      assetType: 'STOCK'
    }];
    mockFetchMarketSnapshot.mockResolvedValue(liveData);

    const createdEtf = {
      ticker: 'NEW',
      name: 'New Asset',
      price: 100,
      daily_change: 2.0,
      assetType: 'STOCK',
      isDeepAnalysisLoaded: false
    };
    mockPrismaCreate.mockResolvedValue(createdEtf);

    const request = new NextRequest('http://localhost/api/etfs/search?query=NEW');
    const response: any = await GET(request);

    expect(mockFetchMarketSnapshot).toHaveBeenCalledWith(['NEW']);
    expect(mockPrismaCreate).toHaveBeenCalled();
    expect(response._data).toHaveLength(1);
    expect(response._data[0].ticker).toBe('NEW');
    expect(response._data[0].assetType).toBe('STOCK');
  });

  it('should handle errors gracefully', async () => {
    mockPrismaFindMany.mockRejectedValue(new Error('DB Error'));

    // Suppress console.error
    const originalConsoleError = console.error;
    console.error = () => {};

    const request = new NextRequest('http://localhost/api/etfs/search');
    const response: any = await GET(request);

    console.error = originalConsoleError;

    expect(response.status).toBe(500);
    expect(response._data.error).toBe('Internal Server Error');
  });
});
