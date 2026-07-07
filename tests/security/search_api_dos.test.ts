import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { mockModule } from '@/tests/helpers/mock-module';

// Mocks (loosely typed so tests can freely stub Prisma-shaped results)
type AsyncMockFn = (...args: any[]) => Promise<any>;

const mockPrismaFindMany = mock<AsyncMockFn>(async () => []);
const mockPrismaCreate = mock<AsyncMockFn>(async () => ({}));
const mockPrismaUpsert = mock<AsyncMockFn>(async () => ({}));
const mockFetchMarketSnapshot = mock<AsyncMockFn>(async () => []);
const mockSyncEtfDetails = mock<AsyncMockFn>(async () => null);

await mockModule('@/lib/db', () => {
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

await mockModule('@/lib/market-service', () => {
  return {
    fetchMarketSnapshot: mockFetchMarketSnapshot,
    fetchEtfDetails: mock(() => Promise.resolve({}))
  };
});

await mockModule('@/lib/etf-sync', () => {
    return {
        syncEtfDetails: mockSyncEtfDetails
    };
});

await mockModule('next/server', () => {
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
    // Generate 1000 tickers: A0, A1, ..., A999
    const hugeTickerList = Array.from({ length: 1000 }, (_, i) => `A${i}`).join(',');

    // We expect fetchMarketSnapshot to NOT be called with 1000 items
    // Ideally it should be capped (e.g. 50)

    const request = new NextRequest(`http://localhost/api/etfs/search?tickers=${hugeTickerList}`);
    await GET(request);

    // Check what fetchMarketSnapshot was called with
    // If vulnerable, it will be called with 1000 items
    // If fixed, it should be called with <= 50 items
    const calls = mockFetchMarketSnapshot.mock.calls;
    if (calls.length > 0) {
        const calledTickers = calls[0][0];
        console.log(`fetchMarketSnapshot called with ${calledTickers.length} tickers`);
        // If > 50, it fails our security check
        expect(calledTickers.length).toBeLessThanOrEqual(50);
    } else {
        // If not called, that might be okay if we block it entirely,
        // but typically we'd expect it to process the first N items.
        // Or if nothing is missing (but here everything is missing as DB is empty mock)
    }
  });

  it('should validate ticker format to prevent garbage input', async () => {
    const maliciousTickers = 'VALID,INVALID!!,TOO_LONG_TICKER_NAME_XYZ,GOOD';

    const request = new NextRequest(`http://localhost/api/etfs/search?tickers=${maliciousTickers}`);
    await GET(request);

    const calls = mockFetchMarketSnapshot.mock.calls;
    if (calls.length > 0) {
        const calledTickers = calls[0][0];
        console.log('Called tickers:', calledTickers);

        expect(calledTickers).toContain('VALID');
        expect(calledTickers).toContain('GOOD');
        expect(calledTickers).not.toContain('INVALID!!');
        expect(calledTickers).not.toContain('TOO_LONG_TICKER_NAME_XYZ');
    }
  });
});
