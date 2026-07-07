import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { mockModule } from '@/tests/helpers/mock-module';
import { Decimal } from 'decimal.js';

// Mocks (loosely typed so tests can freely stub Prisma-shaped results)
type AsyncMockFn = (...args: any[]) => Promise<any>;

const mockPrismaFindMany = mock<AsyncMockFn>(async () => []);
const mockPrismaUpdate = mock<AsyncMockFn>(async () => ({}));
const mockSyncEtfDetails = mock<AsyncMockFn>(async () => null);

// Mock p-limit
const mockPLimitImplementation = mock((concurrency: number) => {
    // Return a function that executes the callback immediately for testing flow
    return (fn: () => Promise<any>) => fn();
});

await mockModule('p-limit', () => {
    return {
        default: mockPLimitImplementation
    };
});

await mockModule('@/lib/db', () => {
  return {
    default: {
      etf: {
        findMany: mockPrismaFindMany,
        update: mockPrismaUpdate,
        upsert: mock(() => Promise.resolve({})),
        findUnique: mock(() => Promise.resolve(null))
      }
    }
  };
});

await mockModule('@/lib/market-service', () => {
  return {
    fetchMarketSnapshot: mock(() => Promise.resolve([])),
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

// Import route dynamically so mocks apply
const { GET } = await import('../../../app/api/etfs/search/route');
const { NextRequest } = await import('next/server');

describe('API: /api/etfs/search concurrency', () => {
  beforeEach(() => {
    mockPrismaFindMany.mockClear();
    mockSyncEtfDetails.mockClear();
    mockPLimitImplementation.mockClear();
  });

  it('should verify behavior with > 10 stale items', async () => {
    // Setup 20 stale ETFs
    const staleEtfs: any[] = [];
    for(let i=0; i<20; i++) {
        staleEtfs.push({
            ticker: `STALE${i}`,
            name: `Stale ETF ${i}`,
            price: new Decimal(100),
            daily_change: new Decimal(0),
            assetType: 'ETF',
            isDeepAnalysisLoaded: true,
            updatedAt: new Date(Date.now() - 3600 * 1000 * 2), // 2 hours ago
            history: [], // Missing history makes it stale
            sectors: [],
            allocation: null
        });
    }

    mockPrismaFindMany.mockResolvedValue(staleEtfs);
    mockSyncEtfDetails.mockImplementation((ticker) => Promise.resolve({ ticker }));

    // Request with full=true to trigger full sync logic
    const request = new NextRequest('http://localhost/api/etfs/search?full=true&tickers=ignored');

    await GET(request);

    // Expect syncEtfDetails to be called for all 20 items (max limit is 50 now)
    expect(mockSyncEtfDetails).toHaveBeenCalledTimes(20);

    // Check concurrency limit passed to p-limit inside the function
    // We expect concurrency 5 for full history requests
    const limitCalls = mockPLimitImplementation.mock.calls;
    const usedConcurrency5 = limitCalls.some((args: any) => args[0] === 5);
    expect(usedConcurrency5).toBe(true);

    // Also verify that we don't see concurrency 1 anymore for the sync logic
    // (Note: dbLimit uses 3, and default might use 2 if full=false, but here we specifically check sync loop)
    // In our implementation, we use concurrency 5 for full=true.
    const usedConcurrency1 = limitCalls.some((args: any) => args[0] === 1);
    expect(usedConcurrency1).toBe(false);
  });
});
