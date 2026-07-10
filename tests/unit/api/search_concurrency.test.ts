import { describe, it, expect, mock } from 'bun:test';
import { mockModule } from '@/tests/helpers/mock-module';

// Live-only search has no DB concurrency path; keep a smoke test that
// bulk tickers are capped and resolved in one quote batch.

const mockGetFastQuotes = mock(async (tickers: string[]) => {
  const m = new Map();
  for (const t of tickers) {
    m.set(t, {
      ticker: t,
      name: t,
      price: 1,
      changePercent: 0,
      change: 0,
      assetType: 'ETF',
    });
  }
  return m;
});

await mockModule('@/lib/fast-market', () => ({
  getFastQuotes: mockGetFastQuotes,
  getFastHistory: mock(async () => new Map()),
  searchFastSymbols: mock(async () => []),
}));

await mockModule('next/server', () => ({
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
    }),
  },
}));

const { GET } = await import('../../../app/api/etfs/search/route');
const { NextRequest } = await import('next/server');

describe('API: /api/etfs/search concurrency', () => {
  it('should batch-resolve many tickers without DB sync', async () => {
    const tickers = Array.from({ length: 20 }, (_, i) => `T${i}`).join(',');
    const request = new NextRequest(
      `http://localhost/api/etfs/search?tickers=${tickers}`,
    );
    const response: any = await GET(request);

    expect(response.status).toBe(200);
    expect(response._data.length).toBe(20);
    // Single batch call, not 20 sequential DB syncs
    expect(mockGetFastQuotes.mock.calls.length).toBe(1);
  });
});
