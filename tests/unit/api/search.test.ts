import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { mockModule } from '@/tests/helpers/mock-module';

type AsyncMockFn = (...args: any[]) => Promise<any>;

const mockGetFastQuotes = mock<AsyncMockFn>(async () => new Map());
const mockGetFastHistory = mock<AsyncMockFn>(async () => new Map());
const mockSearchFastSymbols = mock<AsyncMockFn>(async () => []);

await mockModule('@/lib/fast-market', () => ({
  getFastQuotes: mockGetFastQuotes,
  getFastHistory: mockGetFastHistory,
  searchFastSymbols: mockSearchFastSymbols,
}));

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
        headers: new Headers(init?.headers),
      }),
    },
  };
});

const { GET } = await import('../../../app/api/etfs/search/route');
const { NextRequest } = await import('next/server');
const { ETFSchema } = await import('../../../schemas/assetSchema');

function quote(
  ticker: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    ticker,
    name: `${ticker} Name`,
    price: 100,
    changePercent: 1,
    change: 1,
    assetType: 'STOCK' as const,
    dividendYield: 0.5,
    expenseRatio: 0,
    ...overrides,
  };
}

describe('API: /api/etfs/search (live, no DB)', () => {
  beforeEach(() => {
    mockGetFastQuotes.mockClear();
    mockGetFastHistory.mockClear();
    mockSearchFastSymbols.mockClear();
    mockGetFastQuotes.mockResolvedValue(new Map());
    mockGetFastHistory.mockResolvedValue(new Map());
    mockSearchFastSymbols.mockResolvedValue([]);
  });

  it('returns live quotes for tickers param', async () => {
    mockGetFastQuotes.mockResolvedValue(
      new Map([['AAPL', quote('AAPL', { price: 190, name: 'Apple Inc.' })]]),
    );
    mockGetFastHistory.mockResolvedValue(
      new Map([['AAPL', [{ date: '2024-01-01', price: 180 }]]]),
    );

    const request = new NextRequest(
      'http://localhost/api/etfs/search?tickers=AAPL&includeHistory=true',
    );
    const response: any = await GET(request);

    expect(response.status).toBe(200);
    expect(response._data).toHaveLength(1);
    expect(response._data[0].ticker).toBe('AAPL');
    expect(response._data[0].price).toBe(190);
    expect(response._data[0].history).toHaveLength(1);

    const parseResult = ETFSchema.safeParse(response._data[0]);
    if (!parseResult.success) console.error(parseResult.error);
    expect(parseResult.success).toBe(true);
  });

  it('returns 404 when exact tickers resolve to nothing', async () => {
    mockGetFastQuotes.mockResolvedValue(new Map());

    const request = new NextRequest(
      'http://localhost/api/etfs/search?tickers=NOPE123',
    );
    const response: any = await GET(request);

    expect(response.status).toBe(404);
    expect(response._data.error).toBe('Ticker(s) not found');
  });

  it('resolves free-text query via Yahoo search + live quotes', async () => {
    mockSearchFastSymbols.mockResolvedValue(['MSFT']);
    mockGetFastQuotes.mockResolvedValue(
      new Map([['MSFT', quote('MSFT', { name: 'Microsoft', price: 400 })]]),
    );

    const request = new NextRequest(
      'http://localhost/api/etfs/search?query=microsoft',
    );
    const response: any = await GET(request);

    expect(mockSearchFastSymbols).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response._data[0].ticker).toBe('MSFT');
  });

  it('seeds browse defaults without any database', async () => {
    mockGetFastQuotes.mockImplementation(async (tickers: string[]) => {
      const m = new Map();
      for (const t of tickers.slice(0, 3)) {
        m.set(t.toUpperCase(), quote(t.toUpperCase(), { assetType: 'ETF' }));
      }
      return m;
    });

    const request = new NextRequest('http://localhost/api/etfs/search?limit=3');
    const response: any = await GET(request);

    expect(response.status).toBe(200);
    expect(response._data.length).toBeGreaterThan(0);
    expect(mockGetFastQuotes).toHaveBeenCalled();
  });
});
