import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Cache for 60 seconds, revalidate in background
const CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=30';

interface QuoteData {
  ticker: string;
  price: number;
  changePercent: number;
  currency: string;
  history?: { date: string; price: number; interval?: string }[];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tickerParam = searchParams.get('tickers') || searchParams.get('ticker');
  const includeHistory = searchParams.get('history') === 'true';

  if (!tickerParam) {
    return NextResponse.json({ error: 'Missing tickers parameter' }, { status: 400 });
  }

  // Limit to 10 tickers to prevent abuse/timeouts
  const tickers = tickerParam.split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0)
    .slice(0, 10);

  if (tickers.length === 0) {
    return NextResponse.json({ error: 'No valid tickers provided' }, { status: 400 });
  }

  const results: QuoteData[] = [];
  const errors: any[] = [];

  // Parallel fetch for each ticker
  const promises = tickers.map(async (ticker) => {
    try {
      // Use v8 chart endpoint which is often more lenient than v7 quote
      // If history is requested, fetch a longer range (e.g., 5y to cover all chart views)
      // Otherwise default to 1d range for current quote
      const range = includeHistory ? '5y' : '1d';
      const interval = includeHistory ? '1wk' : '1d'; // Weekly for long history to save bandwidth, or logic for multiple calls?
      // Actually, DetailsDrawer expects daily data for at least recent history.
      // But fetching 5 years of daily data is heavy.
      // Let's stick to '1d' interval with '1y' range for now as a "Lite History" fallback.
      // Or '1d' interval and '5y' range if we want full coverage.
      // Yahoo chart endpoint returns granular data well.
      // Let's use 1 month of Daily data to avoid timeouts. 5Y is too heavy for Edge.
      const fetchRange = includeHistory ? '1mo' : '1d';

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${fetchRange}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Origin': 'https://finance.yahoo.com',
          'Referer': `https://finance.yahoo.com/quote/${ticker}`
        },
        next: { revalidate: 60 } // Next.js cache
      });

      if (!response.ok) {
        // Try query2 as fallback
         const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${fetchRange}`;
         const response2 = await fetch(url2, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
             next: { revalidate: 60 }
         });

         if (!response2.ok) {
            console.warn(`[Edge Proxy] Failed to fetch ${ticker}: ${response.status} / ${response2.status}`);
            return null;
         }
         return processResponse(ticker, await response2.json(), includeHistory);
      }

      const data = await response.json();
      return processResponse(ticker, data, includeHistory);

    } catch (error) {
      console.error(`[Edge Proxy] Error fetching ${ticker}:`, error);
      return null;
    }
  });

  const fetchResults = await Promise.all(promises);
  fetchResults.forEach(r => {
    if (r) results.push(r);
  });

  return NextResponse.json({
    data: results,
    timestamp: Date.now()
  }, {
    headers: {
      'Cache-Control': CACHE_CONTROL,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    }
  });
}

function processResponse(ticker: string, data: any, includeHistory: boolean): QuoteData | null {
  try {
    const result = data.chart?.result?.[0];
    if (!result || !result.meta || !result.indicators?.quote?.[0]) return null;

    const meta = result.meta;
    const quote = result.indicators.quote[0];

    // Get latest valid price
    // chart.result[0].meta.regularMarketPrice is usually the most reliable "current" price
    let price = meta.regularMarketPrice;

    // Calculate change percent
    let prevClose = meta.chartPreviousClose || meta.previousClose;
    let changePercent = 0;

    if (price && prevClose) {
        changePercent = ((price - prevClose) / prevClose) * 100;
    }

    const output: QuoteData = {
      ticker: ticker,
      price: price,
      changePercent: changePercent,
      currency: meta.currency
    };

    if (includeHistory) {
      const timestamps = result.timestamp;
      const closes = quote.close;

      if (Array.isArray(timestamps) && Array.isArray(closes)) {
        output.history = timestamps.map((ts: number, i: number) => {
          if (closes[i] === null || closes[i] === undefined) return null;
          return {
            date: new Date(ts * 1000).toISOString(),
            price: closes[i],
            interval: '1d'
          };
        }).filter((x: any) => x !== null);
      }
    }

    return output;
  } catch (e) {
    return null;
  }
}
