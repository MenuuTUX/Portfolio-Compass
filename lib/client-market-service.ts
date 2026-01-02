import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

export interface LivePrice {
  ticker: string;
  price: number;
  changePercent: number;
  currency: string;
}

// Client-side service to fetch from Edge Proxy
export async function fetchLivePrices(tickers: string[]): Promise<LivePrice[]> {
  if (!tickers.length) return [];

  // Chunk tickers if too many (Edge limit is strict on URL length, though safe for ~50 tickers)
  const batches = [];
  const chunkSize = 20;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    batches.push(tickers.slice(i, i + chunkSize));
  }

  const results: LivePrice[] = [];

  for (const batch of batches) {
    try {
      const res = await fetch(`/api/edge/quotes?tickers=${batch.join(',')}`);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        results.push(...json.data);
      }
    } catch (e) {
      console.warn('[ClientMarketService] Batch fetch failed:', e);
    }
  }

  return results;
}

// Client-side service to push updates to DB
export async function syncPricesToStorage(prices: LivePrice[]) {
  if (!prices.length) return;

  try {
    await fetch('/api/etfs/update-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: prices })
    });
  } catch (e) {
    console.error('[ClientMarketService] Sync failed:', e);
  }
}

// Hook for components
export function useLivePrices(tickers: string[], options?: {
  enabled?: boolean;
  refetchInterval?: number;
  autoSync?: boolean;
}) {
  const { enabled = true, refetchInterval = 60000, autoSync = true } = options || {};

  const query = useQuery({
    queryKey: ['livePrices', tickers.sort().join(',')],
    queryFn: async () => {
      const data = await fetchLivePrices(tickers);

      if (autoSync && data.length > 0) {
        // Fire and forget sync
        syncPricesToStorage(data);
      }

      return data;
    },
    enabled: enabled && tickers.length > 0,
    refetchInterval: refetchInterval,
    staleTime: 30000, // Considered fresh for 30s
  });

  return query;
}
