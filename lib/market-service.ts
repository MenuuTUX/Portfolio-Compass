import YahooFinance from 'yahoo-finance2';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
});

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export interface MarketSnapshot {
  ticker: string;
  price: number;
  dailyChange: number;
  dailyChangePercent: number;
  name: string;
  assetType: 'STOCK' | 'ETF';
}

export interface EtfDetails {
  ticker: string;
  price: number;
  name: string;
  description: string;
  assetType: 'STOCK' | 'ETF';
  expenseRatio?: number;
  dividendYield?: number;
  sectors: Record<string, number>;
  topHoldings?: Record<string, number>; // Legacy support but likely unused now
  holdings: {
    symbol: string;
    name: string;
    weight: number;
  }[];
  history: {
    date: string;
    close: number;
    interval?: string;
  }[];
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function normalizePercent(val: number | undefined): number {
  if (val === undefined || val === null) return 0;
  return val;
}

function determineAssetType(quoteType: string | undefined): 'STOCK' | 'ETF' {
  if (!quoteType) return 'STOCK';
  if (quoteType === 'ETF') return 'ETF';
  return 'STOCK';
}

async function fetchWithFallback<T>(
  ticker: string,
  fetchFn: (t: string) => Promise<T>
): Promise<{ data: T; resolvedTicker: string }> {
  try {
    const data = await fetchFn(ticker);
    return { data, resolvedTicker: ticker };
  } catch (error: any) {
    if (ticker.endsWith('.TO')) throw error;
    try {
      const altTicker = `${ticker}.TO`;
      const data = await fetchFn(altTicker);
      return { data, resolvedTicker: altTicker };
    } catch (innerError) {
      throw error;
    }
  }
}

// -----------------------------------------------------------------------------
// Core Functions
// -----------------------------------------------------------------------------

export async function fetchMarketSnapshot(tickers: string[]): Promise<MarketSnapshot[]> {
  if (tickers.length === 0) return [];

  try {
    const results = await yf.quote(tickers);

    return results.map(quote => ({
      ticker: quote.symbol,
      price: quote.regularMarketPrice || 0,
      dailyChange: quote.regularMarketChange || 0,
      dailyChangePercent: normalizePercent(quote.regularMarketChangePercent),
      name: quote.shortName || quote.longName || quote.symbol,
      assetType: determineAssetType(quote.quoteType)
    }));
  } catch (error) {
    console.error("Error fetching market snapshot:", error);
    return [];
  }
}

export async function fetchEtfDetails(originalTicker: string): Promise<EtfDetails> {
  const { data: quoteSummary, resolvedTicker } = await fetchWithFallback(originalTicker, async (t) => {
    const data = await yf.quoteSummary(t, {
      modules: ['price', 'summaryProfile', 'topHoldings', 'fundProfile', 'defaultKeyStatistics', 'summaryDetail']
    });
    if (!data.price || !data.price.regularMarketPrice) {
      throw new Error(`No price data for ${t}`);
    }
    return data;
  });

  // Fetch History for multiple intervals
  const fetchHistoryInterval = async (interval: '1h' | '1d' | '1wk' | '1mo', period1: Date) => {
    try {
      const res = await yf.chart(resolvedTicker, {
        period1,
        interval,
      });
      if (res && res.quotes) {
        return res.quotes
          .filter(q => q.close !== null && q.close !== undefined)
          .map(q => ({
            date: q.date.toISOString(),
            close: q.close!,
            interval
          }));
      }
      return [];
    } catch (e) {
      console.warn(`Failed to fetch ${interval} history for ${resolvedTicker}`);
      return [];
    }
  };

  const now = new Date();

  const d1y = new Date(); d1y.setFullYear(now.getFullYear() - 1);
  const d5y = new Date(); d5y.setFullYear(now.getFullYear() - 5);
  const dMax = new Date(0); // 1970
  const d7d = new Date(); d7d.setDate(now.getDate() - 7); // 7 days for 1h data

  const [h1h, h1d, h1wk, h1mo] = await Promise.all([
    fetchHistoryInterval('1h', d7d),
    fetchHistoryInterval('1d', d1y),
    fetchHistoryInterval('1wk', d5y),
    fetchHistoryInterval('1mo', dMax)
  ]);

  const history = [...h1h, ...h1d, ...h1wk, ...h1mo];

  const price = quoteSummary.price;
  const profile = quoteSummary.summaryProfile;
  const fundProfile = quoteSummary.fundProfile;
  const summaryDetail = quoteSummary.summaryDetail;
  const topHoldings = quoteSummary.topHoldings;
  const defaultKeyStatistics = quoteSummary.defaultKeyStatistics;

  const assetType = determineAssetType(price?.quoteType);

  let sectors: Record<string, number> = {};
  let holdings: { symbol: string; name: string; weight: number }[] = [];

  if (assetType === 'ETF') {
    if (topHoldings?.sectorWeightings) {
      topHoldings.sectorWeightings.forEach((w: any) => {
        const keys = Object.keys(w);
        if (keys.length > 0) {
          const sectorKey = keys[0];
          const weight = w[sectorKey];
          if (typeof weight === 'number') {
            sectors[sectorKey] = weight;
          }
        }
      });
    }

    // Extract Holdings
    if (topHoldings?.holdings) {
      holdings = topHoldings.holdings.map((h: any) => ({
        symbol: h.symbol,
        name: h.holdingName || h.symbol,
        weight: h.holdingPercent || 0
      }));
    }
  } else if (assetType === 'STOCK' && profile?.sector) {
    sectors[profile.sector] = 1.0;
  }

  let dividendYield = summaryDetail?.dividendYield;
  if (!dividendYield && defaultKeyStatistics?.yield) {
    dividendYield = defaultKeyStatistics.yield;
  }
  if (dividendYield !== undefined && dividendYield < 1) {
    dividendYield = dividendYield * 100;
  }

  let expenseRatio = fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio;
  if (expenseRatio !== undefined && expenseRatio < 1) {
    expenseRatio = expenseRatio * 100;
  }

  return {
    ticker: resolvedTicker,
    price: price?.regularMarketPrice || 0,
    name: price?.shortName || price?.longName || resolvedTicker,
    description: profile?.longBusinessSummary || "No description available.",
    assetType,
    expenseRatio,
    dividendYield,
    sectors,
    holdings,
    history
  };
}
