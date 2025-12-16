import YahooFinance from 'yahoo-finance2';
import { Decimal } from './decimal';

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
  price: Decimal;
  dailyChange: Decimal;
  dailyChangePercent: Decimal;
  name: string;
  assetType: 'STOCK' | 'ETF';
}

export interface EtfDetails {
  ticker: string;
  price: Decimal;
  dailyChange: Decimal;
  name: string;
  description: string;
  assetType: 'STOCK' | 'ETF';
  expenseRatio?: Decimal;
  dividendYield?: Decimal;
  sectors: Record<string, Decimal>;
  topHoldings?: Record<string, Decimal>;
  history: {
    date: string;
    close: Decimal;
    interval?: string;
  }[];
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function normalizePercent(val: number | undefined): Decimal {
  if (val === undefined || val === null) return new Decimal(0);
  return new Decimal(val);
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

  const mapQuoteToSnapshot = (quote: any) => ({
    ticker: quote.symbol,
    price: new Decimal(quote.regularMarketPrice || 0),
    dailyChange: new Decimal(quote.regularMarketChange || 0),
    dailyChangePercent: normalizePercent(quote.regularMarketChangePercent),
    name: quote.shortName || quote.longName || quote.symbol,
    assetType: determineAssetType(quote.quoteType)
  });

  try {
    // Attempt to fetch all tickers in one batch
    const results = await yf.quote(tickers);
    // Ensure we always return an array, even if yf returns something else (though for list input it returns list)
    if (Array.isArray(results)) {
        return results.map(mapQuoteToSnapshot);
    } else {
        return [mapQuoteToSnapshot(results)];
    }
  } catch (error) {
    console.warn("Bulk fetch failed in fetchMarketSnapshot, attempting individual fallbacks:", error);

    // If bulk fetch fails, try fetching individually or in smaller batches.
    // We use individual fetches here for maximum resilience.
    const promises = tickers.map(async (t) => {
        try {
            const q = await yf.quote(t);
            return q;
        } catch (e) {
            console.error(`Failed to fetch individual ticker ${t}:`, e);
            return null;
        }
    });

    const individualResults = await Promise.all(promises);
    const validQuotes = individualResults.filter(q => q !== null);

    return validQuotes.map(mapQuoteToSnapshot);
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
            close: new Decimal(q.close!),
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

  let sectors: Record<string, Decimal> = {};

  if (assetType === 'ETF' && topHoldings?.sectorWeightings) {
    topHoldings.sectorWeightings.forEach((w: any) => {
      const keys = Object.keys(w);
      if (keys.length > 0) {
        const sectorKey = keys[0];
        const weight = w[sectorKey];
        if (typeof weight === 'number') {
          sectors[sectorKey] = new Decimal(weight);
        }
      }
    });
  } else if (assetType === 'STOCK' && profile?.sector) {
    sectors[profile.sector] = new Decimal(1.0);
  }

  let dividendYield: Decimal | undefined;
  let rawDividendYield = summaryDetail?.dividendYield;
  if (!rawDividendYield && defaultKeyStatistics?.yield) {
    rawDividendYield = defaultKeyStatistics.yield;
  }
  if (rawDividendYield !== undefined) {
      if (rawDividendYield < 1) {
          rawDividendYield = rawDividendYield * 100;
      }
      dividendYield = new Decimal(rawDividendYield);
  }

  let expenseRatio: Decimal | undefined;
  let rawExpenseRatio = fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio;
  if (rawExpenseRatio !== undefined) {
      if (rawExpenseRatio < 1) {
          rawExpenseRatio = rawExpenseRatio * 100;
      }
      expenseRatio = new Decimal(rawExpenseRatio);
  }

  return {
    ticker: resolvedTicker,
    price: new Decimal(price?.regularMarketPrice || 0),
    dailyChange: new Decimal(price?.regularMarketChangePercent || 0),
    name: price?.shortName || price?.longName || resolvedTicker,
    description: profile?.longBusinessSummary || "No description available.",
    assetType,
    expenseRatio,
    dividendYield,
    sectors,
    history
  };
}
