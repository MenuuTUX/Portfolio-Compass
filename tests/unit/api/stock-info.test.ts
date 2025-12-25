import { describe, it, expect, mock, beforeAll } from 'bun:test';

// Define mock function
const mockGetStockProfile = mock(() => Promise.resolve({
  sector: 'Technology',
  industry: 'Consumer Electronics',
  description: 'Apple Inc. designs...'
}));

// Mock the module before importing the file under test
mock.module('@/lib/scrapers/stock-analysis', () => ({
  getStockProfile: mockGetStockProfile
}));

// Mock yahoo-finance2
const mockYahooFinance = {
    quoteSummary: mock(() => Promise.resolve({}))
};

mock.module('yahoo-finance2', () => ({
    default: mockYahooFinance
}));

// Import the module under test dynamically to ensure the mock is applied
const { GET } = await import('../../../app/api/stock/info/route');

describe('GET /api/stock/info', () => {
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

  it('should fall back to Yahoo Finance if scraper returns null description', async () => {
    mockGetStockProfile.mockResolvedValueOnce({
        sector: 'Tech',
        industry: 'Chips',
        description: '' // Missing description
    });
    mockYahooFinance.quoteSummary.mockResolvedValueOnce({
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
    expect(mockYahooFinance.quoteSummary).toHaveBeenCalledWith('NVDA', expect.anything());
    expect(json.description).toBe('Yahoo description');
    // It should keep existing sector/industry if available from scraper
    expect(json.sector).toBe('Tech');
  });

  it('should fall back to Yahoo Finance if scraper returns null object', async () => {
      mockGetStockProfile.mockResolvedValueOnce(null);
      mockYahooFinance.quoteSummary.mockResolvedValueOnce({
          summaryProfile: {
              longBusinessSummary: 'Yahoo description only',
              sector: 'Financial',
              industry: 'Bank'
          }
      });

      const req = new Request('http://localhost/api/stock/info?ticker=JPM');
      const res = await GET(req);
      const json = await res.json();

      expect(json.description).toBe('Yahoo description only');
      expect(json.sector).toBe('Financial');
  });
});
