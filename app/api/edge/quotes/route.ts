import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Cache for 60 seconds, revalidate in background
const CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=30';

interface QuoteData {
  ticker: string;
  price: number;
  changePercent: number;
  currency: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tickerParam = searchParams.get('tickers') || searchParams.get('ticker');

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
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;

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
         const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
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
         return processResponse(ticker, await response2.json());
      }

      const data = await response.json();
      return processResponse(ticker, data);

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

function processResponse(ticker: string, data: any): QuoteData | null {
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

    return {
      ticker: ticker,
      price: price,
      changePercent: changePercent,
      currency: meta.currency
    };
  } catch (e) {
    return null;
  }
}
