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

const { GET } = await import('../../app/api/etfs/search/route');
const { NextRequest } = await import('next/server');

describe('SECURITY: /api/etfs/search', () => {
  beforeEach(() => {
    mockGetFastQuotes.mockClear();
    mockGetFastQuotes.mockResolvedValue(new Map());
    mockGetFastHistory.mockResolvedValue(new Map());
  });

  it('should limit the number of tickers in tickers parameter to prevent DoS', async () => {
    const hugeTickerList = Array.from({ length: 1000 }, (_, i) => `T${i}`).join(
      ',',
    );

    mockGetFastQuotes.mockImplementation(async (tickers: string[]) => {
      console.log(`getFastQuotes called with ${tickers.length} tickers`);
      return new Map();
    });

    const request = new NextRequest(
      `http://localhost/api/etfs/search?tickers=${hugeTickerList}`,
    );
    await GET(request);

    // We expect getFastQuotes to NOT be called with 1000 items
    const calledTickers =
      mockGetFastQuotes.mock.calls[0]?.[0] as string[] | undefined;
    if (calledTickers) {
      console.log(`getFastQuotes called with ${calledTickers.length} tickers`);
      expect(calledTickers.length).toBeLessThanOrEqual(50);
    } else {
      // Empty after filter is also fine
      expect(true).toBe(true);
    }
  });

  it('should validate ticker format to prevent garbage input', async () => {
    const maliciousTickers = 'VALID,<script>,GOOD,../../etc/passwd';
    mockGetFastQuotes.mockImplementation(async (tickers: string[]) => {
      console.log('Called tickers:', tickers);
      return new Map();
    });

    const request = new NextRequest(
      `http://localhost/api/etfs/search?tickers=${maliciousTickers}`,
    );
    await GET(request);

    const calledTickers =
      (mockGetFastQuotes.mock.calls[0]?.[0] as string[]) || [];
    expect(calledTickers).toContain('VALID');
    expect(calledTickers).toContain('GOOD');
    expect(calledTickers.some((t) => t.includes('<') || t.includes('..'))).toBe(
      false,
    );
  });
});
