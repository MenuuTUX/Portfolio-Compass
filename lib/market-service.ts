import YahooFinance from 'yahoo-finance2';
import { Decimal } from './decimal';
import { getStockProfile } from './scrapers/stock-analysis';

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
  // Expanded Metrics
  marketCap?: Decimal;
  revenue?: Decimal;
  netIncome?: Decimal;
  eps?: Decimal;
  sharesOutstanding?: Decimal;
  volume?: Decimal;
  open?: Decimal;
  previousClose?: Decimal;
  daysRange?: string;
  fiftyTwoWeekRange?: string;
  beta?: Decimal;
  earningsDate?: string;
  dividend?: Decimal;
  exDividendDate?: string;
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

export async function fetchEtfDetails(
  originalTicker: string,
  fromDate?: Date,
  intervals: ('1h' | '1d' | '1wk' | '1mo')[] = ['1h', '1d', '1wk', '1mo']
): Promise<EtfDetails> {
  // Fetch basic data from Yahoo Finance primarily for Price, History, and Asset Type.
  // We will now also fetch from StockAnalysis for financial metrics.

  const { data: quoteSummary, resolvedTicker } = await fetchWithFallback(originalTicker, async (t) => {
    const data = await yf.quoteSummary(t, {
      modules: ['price', 'summaryProfile', 'topHoldings', 'fundProfile', 'defaultKeyStatistics', 'summaryDetail']
    });
    if (!data.price || !data.price.regularMarketPrice) {
      throw new Error(`No price data for ${t}`);
    }
    return data;
  });

  // Fetch from Stock Analysis (non-blocking if possible, but we need data to return)
  let stockProfile: Awaited<ReturnType<typeof getStockProfile>> = null;
  try {
      stockProfile = await getStockProfile(resolvedTicker);
  } catch (e) {
      console.warn(`Failed to fetch Stock Analysis profile for ${resolvedTicker}:`, e);
  }

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
    intervals.includes('1h') ? fetchHistoryInterval('1h', d7d) : Promise.resolve([]),
    intervals.includes('1d') ? fetchHistoryInterval('1d', fromDate || d1y) : Promise.resolve([]),
    intervals.includes('1wk') ? fetchHistoryInterval('1wk', d5y) : Promise.resolve([]),
    intervals.includes('1mo') ? fetchHistoryInterval('1mo', dMax) : Promise.resolve([])
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
  } else if (assetType === 'STOCK') {
      // Use Stock Analysis sector if available, else Yahoo
      const sectorName = stockProfile?.sector || profile?.sector;
      if (sectorName) {
          sectors[sectorName] = new Decimal(1.0);
      }
  } else if (assetType === 'CRYPTO') {
    sectors['Cryptocurrency'] = new Decimal(1.0);
  }

  // --- Merge Financial Metrics (Prioritizing Stock Analysis) ---

  // Helper
  const toDecimal = (val: number | undefined) => val !== undefined ? new Decimal(val) : undefined;

  // Dividend Yield
  let dividendYield: Decimal | undefined;
  if (stockProfile?.dividendYield !== undefined) {
      dividendYield = new Decimal(stockProfile.dividendYield);
  } else {
      let rawDividendYield = summaryDetail?.dividendYield;
      if (!rawDividendYield && defaultKeyStatistics?.yield) {
        rawDividendYield = defaultKeyStatistics.yield;
      }
      if (rawDividendYield !== undefined) {
          if (rawDividendYield < 1) rawDividendYield = rawDividendYield * 100;
          dividendYield = new Decimal(rawDividendYield);
      }
  }

  // Expense Ratio
  let expenseRatio: Decimal | undefined;
  if (stockProfile?.expenseRatio !== undefined) {
      expenseRatio = new Decimal(stockProfile.expenseRatio);
  } else {
      let rawExpenseRatio = fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio;
      if (rawExpenseRatio !== undefined) {
          if (rawExpenseRatio < 1) rawExpenseRatio = rawExpenseRatio * 100;
          expenseRatio = new Decimal(rawExpenseRatio);
      }
  }

  // Beta
  let beta5Y: Decimal | undefined;
  if (stockProfile?.beta !== undefined) {
      beta5Y = new Decimal(stockProfile.beta);
  } else {
      let rawBeta = defaultKeyStatistics?.beta;
      if (rawBeta) beta5Y = new Decimal(rawBeta);
  }

  // PE Ratio
  let peRatio: Decimal | undefined;
  if (stockProfile?.peRatio !== undefined) {
      peRatio = new Decimal(stockProfile.peRatio);
  } else {
      if (summaryDetail?.trailingPE) peRatio = new Decimal(summaryDetail.trailingPE);
  }

  // Forward PE
  let forwardPe: Decimal | undefined;
  if (stockProfile?.forwardPe !== undefined) {
      forwardPe = new Decimal(stockProfile.forwardPe);
  } else {
      if (summaryDetail?.forwardPE) forwardPe = new Decimal(summaryDetail.forwardPE);
      else if (defaultKeyStatistics?.forwardPE) forwardPe = new Decimal(defaultKeyStatistics.forwardPE);
  }

  // 52 Week High/Low
  let fiftyTwoWeekHigh: Decimal | undefined;
  if (stockProfile?.fiftyTwoWeekHigh !== undefined) {
      fiftyTwoWeekHigh = new Decimal(stockProfile.fiftyTwoWeekHigh);
  } else {
      if (summaryDetail?.fiftyTwoWeekHigh) fiftyTwoWeekHigh = new Decimal(summaryDetail.fiftyTwoWeekHigh);
  }

  let fiftyTwoWeekLow: Decimal | undefined;
  if (stockProfile?.fiftyTwoWeekLow !== undefined) {
      fiftyTwoWeekLow = new Decimal(stockProfile.fiftyTwoWeekLow);
  } else {
      if (summaryDetail?.fiftyTwoWeekLow) fiftyTwoWeekLow = new Decimal(summaryDetail.fiftyTwoWeekLow);
  }

  // Description preference
  let description = stockProfile?.description || profile?.longBusinessSummary || "No description available.";

  // New Metrics from StockProfile
  const marketCap = toDecimal(stockProfile?.marketCap) || (summaryDetail?.marketCap ? new Decimal(summaryDetail.marketCap) : undefined);
  const revenue = toDecimal(stockProfile?.revenue);
  const netIncome = toDecimal(stockProfile?.netIncome);
  const eps = toDecimal(stockProfile?.eps);
  const sharesOutstanding = toDecimal(stockProfile?.sharesOutstanding);
  const volume = toDecimal(stockProfile?.volume);
  const open = toDecimal(stockProfile?.open);
  const previousClose = toDecimal(stockProfile?.previousClose);
  const dividend = toDecimal(stockProfile?.dividend);

  const daysRange = stockProfile?.daysRange;
  const fiftyTwoWeekRange = stockProfile?.fiftyTwoWeekRange;
  const earningsDate = stockProfile?.earningsDate;
  const exDividendDate = stockProfile?.exDividendDate;

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

  return {
    ticker: resolvedTicker,
    price: new Decimal(price?.regularMarketPrice || 0),
    dailyChange: new Decimal(price?.regularMarketChangePercent || 0),
    name: price?.shortName || price?.longName || resolvedTicker,
    description,
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
    history,
    marketCap,
    revenue,
    netIncome,
    eps,
    sharesOutstanding,
    volume,
    open,
    previousClose,
    daysRange,
    fiftyTwoWeekRange,
    beta: beta5Y, // Alias beta to beta5Y
    earningsDate,
    dividend,
    exDividendDate
  };
}
