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
  assetType: 'STOCK' | 'ETF' | 'CRYPTO';
}

export interface EtfDetails {
  ticker: string;
  price: Decimal;
  dailyChange: Decimal;
  name: string;
  description: string;
  assetType: 'STOCK' | 'ETF' | 'CRYPTO';
  expenseRatio?: Decimal;
  dividendYield?: Decimal;
  beta5Y?: Decimal;
  peRatio?: Decimal;
  forwardPe?: Decimal;
  fiftyTwoWeekHigh?: Decimal;
  fiftyTwoWeekLow?: Decimal;
  sectors: Record<string, Decimal>;
  topHoldings?: { ticker: string; name: string; sector: string | null; weight: Decimal }[];
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

function determineAssetType(quoteType: string | undefined): 'STOCK' | 'ETF' | 'CRYPTO' {
  if (!quoteType) return 'STOCK';
  if (quoteType === 'ETF') return 'ETF';
  if (quoteType === 'CRYPTOCURRENCY' || quoteType === 'CCY') return 'CRYPTO';
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
        period2: new Date(), // Force up to now
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

  // Ensure the latest price is represented in the history
  const currentPrice = quoteSummary.price?.regularMarketPrice;
  if (currentPrice) {
    const cpDecimal = new Decimal(currentPrice);
    const nowForCheck = new Date();
    const nowIso = nowForCheck.toISOString();

    // Check h1d and append if necessary
    if (h1d.length > 0) {
       const lastDate = new Date(h1d[h1d.length - 1].date);
       // If last date is not from today (using simple day comparison), append current price
       const isSameDay = lastDate.getDate() === nowForCheck.getDate() &&
                         lastDate.getMonth() === nowForCheck.getMonth() &&
                         lastDate.getFullYear() === nowForCheck.getFullYear();

       if (!isSameDay) {
           h1d.push({
             date: nowIso,
             close: cpDecimal,
             interval: '1d'
           });
       }
    }
  }

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
  } else if (assetType === 'CRYPTO') {
    sectors['Cryptocurrency'] = new Decimal(1.0);
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

  // Extract Top Holdings
  let holdingsList: { ticker: string; name: string; sector: string | null; weight: Decimal }[] | undefined;
  if (topHoldings?.holdings && Array.isArray(topHoldings.holdings)) {
    holdingsList = topHoldings.holdings.map((h: any) => ({
      ticker: h.symbol,
      name: h.holdingName || h.symbol,
      sector: null, // Yahoo doesn't provide sector in this list
      weight: new Decimal(h.holdingPercent ? h.holdingPercent * 100 : 0)
    }));
  }

  // Extract Key Statistics
  // Prefer 5Y beta (defaultKeyStatistics.beta), fallback to beta3Year for ETFs if strictly necessary or keep null if 5Y is required.
  // The task specifically asked for "Beta (5Y Monthly)".
  // Yahoo often provides 'beta' in defaultKeyStatistics for stocks (which is 5Y) and 'beta3Year' for funds.
  // We will check for 'beta' first.
  let rawBeta = defaultKeyStatistics?.beta;
  // If beta is missing and it's an ETF, we might want to use beta3Year as a proxy,
  // but the requirement was specific about 5Y.
  // However, for ETFs, 5Y beta might be stored in 'beta3Year' field mistakenly by Yahoo or just not available as 5Y.
  // Given the "Beta 5Y" field name, we should stick to 'beta' if possible.

  const beta5Y = rawBeta ? new Decimal(rawBeta) : undefined;
  const peRatio = summaryDetail?.trailingPE ? new Decimal(summaryDetail.trailingPE) : undefined;
  const forwardPe = summaryDetail?.forwardPE ? new Decimal(summaryDetail.forwardPE) : (defaultKeyStatistics?.forwardPE ? new Decimal(defaultKeyStatistics.forwardPE) : undefined);
  const fiftyTwoWeekHigh = summaryDetail?.fiftyTwoWeekHigh ? new Decimal(summaryDetail.fiftyTwoWeekHigh) : undefined;
  const fiftyTwoWeekLow = summaryDetail?.fiftyTwoWeekLow ? new Decimal(summaryDetail.fiftyTwoWeekLow) : undefined;

  return {
    ticker: resolvedTicker,
    price: new Decimal(price?.regularMarketPrice || 0),
    dailyChange: new Decimal(price?.regularMarketChangePercent || 0),
    name: price?.shortName || price?.longName || resolvedTicker,
    description: profile?.longBusinessSummary || "No description available.",
    assetType,
    expenseRatio,
    dividendYield,
    beta5Y,
    peRatio,
    forwardPe,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    sectors,
    topHoldings: holdingsList,
    history
  };
}
