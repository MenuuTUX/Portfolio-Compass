
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { useLivePrices } from '@/lib/client-market-service';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock global fetch
const originalFetch = global.fetch;

describe('useLivePrices Hook', () => {
  beforeEach(() => {
    global.fetch = originalFetch;
  });

  it('hook calls fetchLivePrices with correct URL', async () => {
    // Setup QueryClient
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Mock fetch to track calls
    const fetchCalls: string[] = [];
    global.fetch = mock(async (url: string) => {
      fetchCalls.push(url);
      if (url.includes('/api/edge/quotes')) {
          return new Response(JSON.stringify({
            data: [{ ticker: 'AAPL', price: 150, changePercent: 1.5, currency: 'USD' }]
          }));
      }
      return new Response(JSON.stringify({ success: true }));
    });

    const { result } = renderHook(() => useLivePrices(['AAPL'], { includeHistory: true, autoSync: true }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Check if ANY call was to edge proxy
    const edgeCall = fetchCalls.find(url => url.includes('/api/edge/quotes'));
    expect(edgeCall).toBeDefined();
    expect(edgeCall).toContain('tickers=AAPL');
    expect(edgeCall).toContain('history=true');

    // Check if sync was called (optional, but good to verify "autoSync")
    const syncCall = fetchCalls.find(url => url.includes('/api/etfs/update-batch'));
    expect(syncCall).toBeDefined();

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.[0].ticker).toBe('AAPL');
  });
});
