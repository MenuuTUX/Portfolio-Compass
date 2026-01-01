import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Define mock functions
const mockGetStockProfile = mock(() => Promise.resolve({
  sector: 'Technology',
  industry: 'Consumer Electronics',
  description: 'Apple Inc. designs...'
}));

const mockGetEtfDescription = mock(() => Promise.resolve(null));

// Mock the modules
mock.module('@/lib/scrapers/stock-analysis', () => ({
  getStockProfile: mockGetStockProfile
}));

mock.module('@/lib/scrapers/etf-dot-com', () => ({
  getEtfDescription: mockGetEtfDescription
}));

// Mock yahoo-finance2
const mockQuoteSummary = mock(() => Promise.resolve({}));

// Create a mock class
class MockYahooFinance {
  quoteSummary = mockQuoteSummary;
  // Add other methods if needed
}

mock.module('yahoo-finance2', () => ({
    default: MockYahooFinance
}));

// Import the module under test dynamically to ensure the mock is applied
const { GET } = await import('../../../app/api/stock/info/route');

describe('GET /api/stock/info', () => {
  beforeEach(() => {
    mockGetStockProfile.mockClear();
    mockGetEtfDescription.mockClear();
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

  it('should try ETF.com if description is missing, then fallback to Yahoo', async () => {
    // 1. StockAnalysis returns no description
    mockGetStockProfile.mockResolvedValueOnce({
        sector: 'Tech',
        industry: 'Chips',
        description: ''
    });
    // 2. ETF.com returns null (simulating not found or error)
    mockGetEtfDescription.mockResolvedValueOnce(null);

    // 3. Yahoo returns data
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
    expect(mockGetEtfDescription).toHaveBeenCalledWith('NVDA');
    expect(mockQuoteSummary).toHaveBeenCalledWith('NVDA', expect.anything());
    expect(json.description).toBe('Yahoo description');
    expect(json.sector).toBe('Tech');
  });

  it('should use ETF.com description if StockAnalysis description is missing', async () => {
      mockGetStockProfile.mockResolvedValueOnce({
          sector: 'Financial',
          industry: 'ETF',
          description: ''
      });
      mockGetEtfDescription.mockResolvedValueOnce('ETF.com Analysis & Insights');

      const req = new Request('http://localhost/api/stock/info?ticker=SLV');
      const res = await GET(req);
      const json = await res.json();

      expect(mockGetEtfDescription).toHaveBeenCalledWith('SLV');
      expect(json.description).toBe('ETF.com Analysis & Insights');
      expect(mockQuoteSummary).not.toHaveBeenCalled();
  });

  it('should use ETF.com description if StockAnalysis sector is Unknown (implying poor data)', async () => {
       mockGetStockProfile.mockResolvedValueOnce({
           sector: 'Unknown',
           industry: 'Unknown',
           description: 'Some weak description'
       });
       mockGetEtfDescription.mockResolvedValueOnce('Better ETF description');

       const req = new Request('http://localhost/api/stock/info?ticker=BAD_DATA');
       const res = await GET(req);
       const json = await res.json();

       expect(json.description).toBe('Better ETF description');
  });
});
