import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { mockModule } from '@/tests/helpers/mock-module';

// Define mock functions (loosely typed so tests can stub varying shapes)
type AsyncMockFn = (...args: any[]) => Promise<any>;

const mockGetStockProfile = mock<AsyncMockFn>(async () => ({
  sector: 'Technology',
  industry: 'Consumer Electronics',
  description: 'Apple Inc. designs...'
}));

// Mock the modules
await mockModule('@/lib/scrapers/stock-analysis', () => ({
  getStockProfile: mockGetStockProfile
}));

// Mock yahoo-finance2
const mockQuoteSummary = mock<AsyncMockFn>(async () => ({}));

// Create a mock class
class MockYahooFinance {
  quoteSummary = mockQuoteSummary;
  // Add other methods if needed
}

await mockModule('yahoo-finance2', () => ({
    default: MockYahooFinance
}));

// Import the module under test dynamically to ensure the mock is applied
const { GET } = await import('../../../app/api/stock/info/route');

describe('GET /api/stock/info', () => {
  beforeEach(() => {
    mockGetStockProfile.mockClear();
    mockQuoteSummary.mockClear();
  });

  it('returns 400 if ticker is missing', async () => {
    const req = new Request('http://localhost/api/stock/info');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Ticker is required');
  });

  it('returns profile data for valid ticker', async () => {
    const req = new Request('http://localhost/api/stock/info?ticker=AAPL');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      sector: 'Technology',
      industry: 'Consumer Electronics',
      description: 'Apple Inc. designs...'
    });
    expect(mockGetStockProfile).toHaveBeenCalledWith('AAPL');
  });

  it('does not expose scraped analyst targets without a dated currency contract', async () => {
    mockGetStockProfile.mockResolvedValueOnce({
      sector: 'Technology',
      industry: 'Consumer Electronics',
      description: 'Company description',
      analyst: { consensus: 'Buy', targetPrice: 999 },
    });
    const res = await GET(new Request('http://localhost/api/stock/info?ticker=AAPL'));
    const json = await res.json();
    expect(json).toEqual({
      sector: 'Technology',
      industry: 'Consumer Electronics',
      description: 'Company description',
    });
  });

  it('falls back to Yahoo when the scraped description is missing', async () => {
    // 1. StockAnalysis returns no description
    mockGetStockProfile.mockResolvedValueOnce({
        sector: 'Tech',
        industry: 'Chips',
        description: ''
    });
    // 2. Yahoo returns data
    mockQuoteSummary.mockResolvedValueOnce({
        summaryProfile: {
            longBusinessSummary: 'Yahoo description',
            sector: 'Technology',
            industry: 'Semiconductors'
        }
    });

    const req = new Request('http://localhost/api/stock/info?ticker=NVDA');
    const res = await GET(req);
    const json = await res.json();

    expect(mockGetStockProfile).toHaveBeenCalledWith('NVDA');
    expect(mockQuoteSummary).toHaveBeenCalledWith('NVDA', expect.anything());
    expect(json.description).toBe('Yahoo description');
    expect(json.sector).toBe('Tech');
  });

  it('lets the CDN keep a successful profile, and nothing else', async () => {
    const ok = await GET(new Request('http://localhost/api/stock/info?ticker=AAPL'));
    expect(ok.headers.get('Vercel-CDN-Cache-Control')).toContain('max-age=');

    const bad = await GET(new Request('http://localhost/api/stock/info'));
    expect(bad.headers.get('Vercel-CDN-Cache-Control')).toBeNull();
  });
});
