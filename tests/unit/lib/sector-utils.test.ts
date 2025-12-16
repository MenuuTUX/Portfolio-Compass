import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Define the mock
const mockQuoteSummary = mock(() => Promise.resolve({}));

// Mock the module BEFORE importing the code under test
mock.module('yahoo-finance2', () => {
  return {
    default: class YahooFinance {
      constructor() {
        console.log('Mock YahooFinance constructor called');
      }
      quoteSummary(...args: any[]) {
        return mockQuoteSummary(...args);
      }
    }
  };
});

// Use dynamic import to prevent hoisting issues
const { fetchSectorWeightings } = await import('../../../lib/sector-utils');

describe('fetchSectorWeightings', () => {
  beforeEach(() => {
    mockQuoteSummary.mockClear();
    mockQuoteSummary.mockResolvedValue({});
  });

  it('should return sectors from fundProfile (ETF)', async () => {
    const mockResponse = {
      fundProfile: {
        sectorWeightings: [
          { Technology: 0.5 },
          { Healthcare: 0.3 }
        ]
      }
    };

    mockQuoteSummary.mockResolvedValue(mockResponse);

    const sectors = await fetchSectorWeightings('VGT');

    expect(sectors).toHaveLength(2);
    expect(sectors[0]).toEqual({ sector_name: 'Technology', weight: 50 });
    expect(sectors[1]).toEqual({ sector_name: 'Healthcare', weight: 30 });
  });

  it('should return sectors from topHoldings (Alternative ETF structure)', async () => {
    const mockResponse = {
      topHoldings: {
        sectorWeightings: [
          { 'Financial Services': 0.2 }
        ]
      }
    };

    mockQuoteSummary.mockResolvedValue(mockResponse);

    const sectors = await fetchSectorWeightings('XLF');

    expect(sectors).toHaveLength(1);
    expect(sectors[0]).toEqual({ sector_name: 'Financial Services', weight: 20 });
  });

  it('should return sector from summaryProfile (Stock)', async () => {
    const mockResponse = {
      summaryProfile: {
        sector: 'Technology'
      }
    };

    mockQuoteSummary.mockResolvedValue(mockResponse);

    const sectors = await fetchSectorWeightings('AAPL');

    expect(sectors).toHaveLength(1);
    expect(sectors[0]).toEqual({ sector_name: 'Technology', weight: 100 });
  });

  it('should return empty array if no sector data found', async () => {
    const mockResponse = {};

    mockQuoteSummary.mockResolvedValue(mockResponse);

    const sectors = await fetchSectorWeightings('UNKNOWN');

    expect(sectors).toHaveLength(0);
  });

  it('should handle errors gracefully', async () => {
    mockQuoteSummary.mockRejectedValue(new Error('Network error'));

    // Suppress console.error for this test
    const originalConsoleError = console.error;
    console.error = () => {};

    const sectors = await fetchSectorWeightings('ERROR');

    console.error = originalConsoleError;

    expect(sectors).toHaveLength(0);
  });
});
