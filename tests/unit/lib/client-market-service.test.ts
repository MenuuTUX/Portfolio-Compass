
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { fetchLivePrices } from '@/lib/client-market-service';

// Mock global fetch
const originalFetch = global.fetch;

describe('client-market-service', () => {
  beforeEach(() => {
    global.fetch = originalFetch;
  });

  it('fetchLivePrices fetches and returns data', async () => {
    global.fetch = mock(async (url: string) => {
      if (url.includes('/api/edge/quotes')) {
        return new Response(JSON.stringify({
          data: [{
            ticker: 'AAPL',
            price: 150,
            changePercent: 1.5,
            currency: 'USD'
          }]
        }));
      }
      return new Response('Not Found', { status: 404 });
    });

    const results = await fetchLivePrices(['AAPL']);
    expect(results).toHaveLength(1);
    expect(results[0].ticker).toBe('AAPL');
    expect(results[0].price).toBe(150);
  });

  it('fetchLivePrices handles history param', async () => {
    const mockFetch = mock(async (url: string) => {
        return new Response(JSON.stringify({
            data: []
        }));
    });
    global.fetch = mockFetch;

    await fetchLivePrices(['AAPL'], true);

    // Check if the URL contained history=true
    const calls = (global.fetch as any).mock.calls;
    expect(calls[0][0]).toContain('history=true');
  });
});
