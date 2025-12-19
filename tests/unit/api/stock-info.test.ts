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

// Import the module under test dynamically to ensure the mock is applied
const { GET } = await import('@/app/api/stock/info/route');

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

  it('returns 404 if profile not found', async () => {
    mockGetStockProfile.mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/stock/info?ticker=INVALID');
    const res = await GET(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Profile not found');
  });

  it('returns 500 on internal error', async () => {
    mockGetStockProfile.mockRejectedValueOnce(new Error('Network error'));
    const req = new Request('http://localhost/api/stock/info?ticker=ERROR');
    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Internal server error');
  });
});
