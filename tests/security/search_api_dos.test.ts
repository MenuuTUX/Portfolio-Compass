import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mocks
const mockPrismaFindMany = mock(() => Promise.resolve([]));
const mockPrismaCreate = mock(() => Promise.resolve({}));
const mockPrismaUpsert = mock(() => Promise.resolve({}));
const mockFetchMarketSnapshot = mock(() => Promise.resolve([]));
const mockSyncEtfDetails = mock(() => Promise.resolve(null));

mock.module('@/lib/db', () => {
  return {
    prisma: {
      etf: {
        findMany: mockPrismaFindMany,
        create: mockPrismaCreate,
        upsert: mockPrismaUpsert,
        findUnique: mock(() => Promise.resolve(null))
      }
    },
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
      url: string;
      constructor(url: string) {
        this.url = url;
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
const { GET } = await import('../../app/api/etfs/search/route');
const { NextRequest } = await import('next/server');

describe('SECURITY: /api/etfs/search', () => {
  beforeEach(() => {
    mockPrismaFindMany.mockClear();
    mockPrismaCreate.mockClear();
    mockPrismaUpsert.mockClear();
    mockFetchMarketSnapshot.mockClear();
    mockSyncEtfDetails.mockClear();

    // Default mocks
    mockPrismaFindMany.mockResolvedValue([]);
  });

  it('should limit the number of tickers in tickers parameter to prevent DoS', async () => {
    const hugeTickerList = Array.from({ length: 1000 }, (_, i) => `A${i}`).join(',');

    const request = new NextRequest(`http://localhost/api/etfs/search?tickers=${hugeTickerList}`);
    await GET(request);

    const calls = mockFetchMarketSnapshot.mock.calls;
    // We expect it to be called because we passed valid-looking tickers (A0, A1...)
    // If it's not called, maybe validation failed? A0 is alphanumeric.
    expect(calls.length).toBeGreaterThan(0);

    if (calls.length > 0) {
        const calledTickers = calls[0][0];
        expect(calledTickers.length).toBeLessThanOrEqual(50);
    }
  });

  it('should validate ticker format to prevent garbage input', async () => {
    const maliciousTickers = 'VALID,INVALID!!,TOO_LONG_TICKER_NAME_XYZ,GOOD';

    const request = new NextRequest(`http://localhost/api/etfs/search?tickers=${maliciousTickers}`);
    await GET(request);

    const calls = mockFetchMarketSnapshot.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    if (calls.length > 0) {
        const calledTickers = calls[0][0];
        expect(calledTickers).toContain('VALID');
        expect(calledTickers).toContain('GOOD');
        expect(calledTickers).not.toContain('INVALID!!');
        expect(calledTickers).not.toContain('TOO_LONG_TICKER_NAME_XYZ');
    }
  });
});
