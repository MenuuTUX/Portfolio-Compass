import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { mockModule } from '@/tests/helpers/mock-module';

type AsyncMockFn = (...args: any[]) => Promise<any>;

const mockGetFastQuotes = mock<AsyncMockFn>(async () => new Map());
const mockGetFastHistory = mock<AsyncMockFn>(async () => new Map());
const mockGetFastDividendHistories = mock<AsyncMockFn>(async () => new Map());
const mockSearchFastSymbols = mock<AsyncMockFn>(async () => []);
const mockGetFastEtfDetails = mock<AsyncMockFn>(async () => null);
const mockGetFastMarketBetas = mock<AsyncMockFn>(async () => new Map());

await mockModule('@/lib/fast-market', () => ({
  getFastQuotes: mockGetFastQuotes,
  getFastHistory: mockGetFastHistory,
  getFastDividendHistories: mockGetFastDividendHistories,
  searchFastSymbols: mockSearchFastSymbols,
  getFastEtfDetails: mockGetFastEtfDetails,
  getFastMarketBetas: mockGetFastMarketBetas,
}));

const { GET } = await import('../../../app/api/etfs/search/route');
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
    mockGetFastDividendHistories.mockClear();
    mockSearchFastSymbols.mockClear();
    mockGetFastQuotes.mockResolvedValue(new Map());
    mockGetFastHistory.mockResolvedValue(new Map());
    mockGetFastDividendHistories.mockResolvedValue(new Map());
    mockSearchFastSymbols.mockResolvedValue([]);
    mockGetFastEtfDetails.mockClear();
    mockGetFastMarketBetas.mockClear();
    mockGetFastEtfDetails.mockResolvedValue(null);
    mockGetFastMarketBetas.mockResolvedValue(new Map());
  });

  it('adds market beta and fund asset mix on the portfolio path, null when no mix is reported', async () => {
    // Fixture values match what Yahoo returned on 2026-11-04 for these funds.
    const details: Record<string, unknown> = {
      VOO: { allocation: { equities: 100.04, bonds: 0, cash: -0.12, other: 0.07 } },
      BND: { allocation: { equities: 0, bonds: 99.03, cash: 0.97, other: 0 } },
      GLD: { allocation: { equities: 0, bonds: 0, cash: 0, other: 100 } },
      NOMIX: { allocation: undefined },
    };
    mockGetFastQuotes.mockResolvedValue(new Map(
      ['VOO', 'BND', 'GLD', 'NOMIX'].map((t) => [t, quote(t, { assetType: 'ETF' })]),
    ));
    mockGetFastEtfDetails.mockImplementation(async (t: string) => details[t] ?? null);
    mockGetFastMarketBetas.mockResolvedValue(new Map([
      ['VOO', { beta: 1, observations: 249, basis: 'total', source: 'Estimated vs SPY from 249 daily total returns' }],
      ['BND', { beta: 0.04, observations: 249, basis: 'total', source: 'Estimated vs SPY from 249 daily total returns' }],
    ]));

    const res = await GET(new NextRequest('http://localhost/api/etfs/search?tickers=VOO,BND,GLD,NOMIX&includeHistory=true&adjusted=true'));
    const byTicker = Object.fromEntries((await res.json()).map((a: any) => [a.ticker, ETFSchema.parse(a)]));

    expect(byTicker.VOO.beta).toBe(1);
    expect(byTicker.VOO.metrics.betaSource).toBe('Estimated vs SPY from 249 daily total returns');
    expect(byTicker.BND.beta).toBe(0.04);
    expect(byTicker.BND.allocation).toEqual({ equities: 0, bonds: 99.03, cash: 0.97, other: 0 });
    expect(byTicker.GLD.allocation).toEqual({ equities: 0, bonds: 0, cash: 0, other: 100 });
    expect(byTicker.GLD.beta).toBeUndefined();
    expect(byTicker.GLD.metrics.betaSource).toBeNull();
    expect(byTicker.NOMIX.allocation).toBeNull();
    expect(mockGetFastMarketBetas.mock.calls.at(-1)).toEqual([['VOO', 'BND', 'GLD', 'NOMIX']]);
  });

  it('skips fund details and beta on browse and display paths', async () => {
    mockGetFastQuotes.mockResolvedValue(new Map([['VOO', quote('VOO', { assetType: 'ETF' })]]));
    const res = await GET(new NextRequest('http://localhost/api/etfs/search?tickers=VOO&includeHistory=true'));

    expect(mockGetFastEtfDetails).not.toHaveBeenCalled();
    expect(mockGetFastMarketBetas).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body[0].allocation).toBeNull();
    expect(body[0].beta).toBeUndefined();
  });

  it('returns live quotes for tickers param', async () => {
    mockGetFastQuotes.mockResolvedValue(
      new Map([['AAPL', quote('AAPL', { price: 190, name: 'Apple Inc.' })]]),
    );
    mockGetFastHistory.mockResolvedValue(
      new Map([['AAPL', [{ date: '2024-01-01', price: 180 }]]]),
    );
    mockGetFastDividendHistories.mockResolvedValue(
      new Map([['AAPL', [{ date: new Date().toISOString(), amount: 1.9 }]]]),
    );

    const request = new NextRequest(
      'http://localhost/api/etfs/search?tickers=AAPL&includeHistory=true',
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].ticker).toBe('AAPL');
    expect(body[0].price).toBe(190);
    expect(body[0].history).toHaveLength(1);
    expect(body[0].metrics.yield).toBe(1);
    expect(body[0].metrics.yieldSource).toBe('Yahoo Finance dividend history (TTM)');

    expect(ETFSchema.safeParse(body[0]).success).toBe(true);
  });

  it('asks for adjusted history only when the caller needs it, and keeps adjPrice through the schema', async () => {
    mockGetFastQuotes.mockResolvedValue(new Map([['AAPL', quote('AAPL', { price: 190, name: 'Apple Inc.' })]]));
    mockGetFastHistory.mockResolvedValue(new Map([['AAPL', [{ date: '2024-01-01', price: 180, adjPrice: 175 }]]]));

    const adjusted = await GET(new NextRequest('http://localhost/api/etfs/search?tickers=AAPL&includeHistory=true&adjusted=true'));
    expect(mockGetFastHistory.mock.calls.at(-1)).toEqual([['AAPL'], '1M', { adjusted: true }]);
    expect(ETFSchema.parse((await adjusted.json())[0]).history[0].adjPrice).toBe(175);

    await GET(new NextRequest('http://localhost/api/etfs/search?tickers=AAPL&includeHistory=true'));
    expect(mockGetFastHistory.mock.calls.at(-1)).toEqual([['AAPL'], '1M', { adjusted: false }]);
  });

  it('returns 404 when exact tickers resolve to nothing', async () => {
    mockGetFastQuotes.mockResolvedValue(new Map());

    const request = new NextRequest(
      'http://localhost/api/etfs/search?tickers=NOPE123',
    );
    const response = await GET(request);

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe('Ticker(s) not found');
  });

  it('resolves free-text query via Yahoo search + live quotes', async () => {
    mockSearchFastSymbols.mockResolvedValue(['MSFT']);
    mockGetFastQuotes.mockResolvedValue(
      new Map([['MSFT', quote('MSFT', { name: 'Microsoft', price: 400 })]]),
    );

    const request = new NextRequest(
      'http://localhost/api/etfs/search?query=microsoft',
    );
    const response = await GET(request);

    expect(mockSearchFastSymbols).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect((await response.json())[0].ticker).toBe('MSFT');
  });

  it('resolves many tickers in a single quote batch', async () => {
    mockGetFastQuotes.mockImplementation(async (tickers: string[]) =>
      new Map(tickers.map((t) => [t, quote(t, { assetType: 'ETF' })])),
    );
    const tickers = Array.from({ length: 20 }, (_, i) => `T${i}`).join(',');
    const response = await GET(new NextRequest(`http://localhost/api/etfs/search?tickers=${tickers}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(20);
    expect(mockGetFastQuotes).toHaveBeenCalledTimes(1);
  });

  // Input hardening: a caller must not be able to fan out unbounded upstream work or inject odd symbols.
  it('caps the tickers sent upstream at 50', async () => {
    mockGetFastQuotes.mockImplementation(async (tickers: string[]) =>
      new Map(tickers.map((t) => [t, quote(t, { assetType: 'ETF' })])),
    );
    const huge = Array.from({ length: 1000 }, (_, i) => `T${i}`).join(',');
    const response = await GET(new NextRequest(`http://localhost/api/etfs/search?tickers=${huge}`));

    expect(mockGetFastQuotes).toHaveBeenCalledTimes(1);
    const requested = mockGetFastQuotes.mock.calls[0][0] as string[];
    expect(requested).toHaveLength(50);
    expect(requested).toEqual(Array.from({ length: 50 }, (_, i) => `T${i}`));
    expect(await response.json()).toHaveLength(50);
  });

  it('drops malformed ticker symbols before they reach the data layer', async () => {
    mockGetFastQuotes.mockImplementation(async (tickers: string[]) =>
      new Map(tickers.map((t) => [t, quote(t, { assetType: 'ETF' })])),
    );
    const bad = encodeURIComponent('VALID,<script>,GOOD,../../etc/passwd');
    await GET(new NextRequest(`http://localhost/api/etfs/search?tickers=${bad}`));

    expect(mockGetFastQuotes.mock.calls[0][0]).toEqual(['VALID', 'GOOD']);
  });
});
