import YahooFinance from 'yahoo-finance2';
import { Decimal } from '@/lib/decimal';
import { getStockProfile } from './scrapers/stock-analysis';
import pLimit from 'p-limit';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

// Yahoo Finance requires a User-Agent to avoid 429 Too Many Requests (Rate Limiting)
const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

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
  dividendGrowth5Y?: Decimal;
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
  inceptionDate?: string;
  payoutFrequency?: string;
  payoutRatio?: Decimal;
  holdingsCount?: number;
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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 5,
  baseDelay = 2000,
  fallbackValue?: T
): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      // Check for 429 specifically or generic network errors, and also "Failed to get crumb" which is a YF specific 429-like error
      const isRateLimit = error.message?.includes('429') ||
                          error.status === 429 ||
                          error.message?.includes('Too Many Requests') ||
                          error.message?.includes('Failed to get crumb');

      if (attempt >= retries) {
        if (fallbackValue !== undefined) {
             console.warn(`Function failed after ${retries} attempts, returning fallback. Error: ${error.message}`);
             return fallbackValue;
        }
        throw error;
      }

      // If it's a crumb error, we might need a slightly longer backoff or it just might be flaky
      // We'll treat it as a rate limit to be safe.
      let delay = baseDelay * Math.pow(2, attempt - 1) + (Math.random() * 1000); // Exponential backoff + jitter

      if (isRateLimit) {
         // Aggressive backoff for rate limits
         delay = Math.min(delay * 2, 15000); // Cap at 15s
         console.warn(`Rate limit or Crumb error hit (${error.message}). Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${retries})`);
      } else {
         delay = Math.min(delay, 10000);
      }

      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}

async function fetchWithFallback<T>(
  ticker: string,
  fetchFn: (t: string) => Promise<T>
): Promise<{ data: T; resolvedTicker: string }> {
  // Wrap the fetchFn with retry logic
  const retryingFetch = (t: string) => retryWithBackoff(() => fetchFn(t), 5, 2000);

  try {
    const data = await retryingFetch(ticker);
    return { data, resolvedTicker: ticker };
  } catch (error: any) {
    if (ticker.endsWith('.TO')) throw error;
    try {
      const altTicker = `${ticker}.TO`;
      const data = await retryingFetch(altTicker);
      return { data, resolvedTicker: altTicker };
    } catch (innerError) {
      throw error;
    }
  }
}

async function fetchFinnhubQuote(ticker: string): Promise<MarketSnapshot | null> {
  if (!FINNHUB_API_KEY) return null;
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
       console.error(`Finnhub fetch failed for ${ticker}: ${res.status} ${res.statusText}`);
       return null;
    }
    const data = await res.json();
    // data: { c: current price, d: change, dp: percent change, h: high, l: low, o: open, pc: prev close }
    // Finnhub returns 0s if invalid symbol usually, or empty object?
    if (data && typeof data.c === 'number') {
       return {
         ticker: ticker,
         price: new Decimal(data.c || 0),
         dailyChange: new Decimal(data.d || 0),
         dailyChangePercent: new Decimal(data.dp || 0),
         name: ticker, // Fallback name
         assetType: 'STOCK'
       };
    }
    return null;
  } catch (error) {
    console.error(`Finnhub error for ${ticker}:`, error);
    return null;
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
    // Attempt to fetch all tickers in one batch from Yahoo
    // Wrapped in retry
    const results = await retryWithBackoff(() => yf.quote(tickers), 2, 500);

    if (Array.isArray(results)) {
        return results.map(mapQuoteToSnapshot);
    } else {
        return [mapQuoteToSnapshot(results)];
    }
  } catch (error) {
    console.warn("Yahoo bulk fetch failed in fetchMarketSnapshot. Attempting Finnhub fallback...", error);

    // Limit concurrency to 5 to respect Finnhub free tier limits
    const limit = pLimit(5);

    const promises = tickers.map((t) => limit(async () => {
       return await fetchFinnhubQuote(t);
    }));

    const fallbackResults = await Promise.all(promises);
    return fallbackResults.filter((r): r is MarketSnapshot => r !== null);
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
      // Safety check: ensure period1 is not in the future relative to period2 (now)
      // This prevents "start date cannot be after end date" errors
      const now = new Date();
      if (period1 > now) {
         // This can happen if 'fromDate' was tomorrow (e.g., last sync was just now)
         // In this case, we have nothing new to fetch
         return [];
      }

      // Wrapped in retry
      const res = await retryWithBackoff(() => yf.chart(resolvedTicker, {
        period1,
        period2: now, // Force up to now
        interval,
      }), 3, 1000, null); // Return null on failure instead of throwing to avoid breaking the whole fetch

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
    } catch (e: any) {
      // Log warning but don't crash
      console.warn(`Failed to fetch ${interval} history for ${resolvedTicker}: ${e.message}`);
      return [];
    }
  };

  const now = new Date();

  const d1y = new Date(); d1y.setFullYear(now.getFullYear() - 1);
  const d5y = new Date(); d5y.setFullYear(now.getFullYear() - 5);
  const dMax = new Date(0); // 1970
  const d7d = new Date(); d7d.setDate(now.getDate() - 7); // 7 days for 1h data

  // Optimize: Run history fetches with limited concurrency
  // Previous code used Promise.all for all 4. Now we do them sequentially or in smaller batches.
  // Actually, '1d' is the most critical.

  const historyResults = {
      '1h': [] as any[],
      '1d': [] as any[],
      '1wk': [] as any[],
      '1mo': [] as any[]
  };

  if (intervals.includes('1d')) {
      historyResults['1d'] = await fetchHistoryInterval('1d', fromDate || d1y);
  }

  // Fetch others in parallel but only if 1d succeeded or we are okay with partials
  // Enforce sequential execution for remaining intervals to avoid rate limits (crumb errors)
  const historyLimit = pLimit(1);
  const otherPromises = [];

  if (intervals.includes('1h')) otherPromises.push(historyLimit(() => fetchHistoryInterval('1h', d7d).then(r => historyResults['1h'] = r)));
  if (intervals.includes('1wk')) otherPromises.push(historyLimit(() => fetchHistoryInterval('1wk', d5y).then(r => historyResults['1wk'] = r)));
  if (intervals.includes('1mo')) otherPromises.push(historyLimit(() => fetchHistoryInterval('1mo', dMax).then(r => historyResults['1mo'] = r)));

  await Promise.all(otherPromises);

  // Ensure the latest price is represented in the history
  const currentPrice = quoteSummary.price?.regularMarketPrice;
  if (currentPrice) {
    const cpDecimal = new Decimal(currentPrice);
    const nowForCheck = new Date();
    const nowIso = nowForCheck.toISOString();

    if (historyResults['1d'].length > 0) {
       const lastDate = new Date(historyResults['1d'][historyResults['1d'].length - 1].date);
       const isSameDay = lastDate.getDate() === nowForCheck.getDate() &&
                         lastDate.getMonth() === nowForCheck.getMonth() &&
                         lastDate.getFullYear() === nowForCheck.getFullYear();

       if (!isSameDay) {
           historyResults['1d'].push({
             date: nowIso,
             close: cpDecimal,
             interval: '1d'
           });
       }
    }
  }

  const history = [
      ...historyResults['1h'],
      ...historyResults['1d'],
      ...historyResults['1wk'],
      ...historyResults['1mo']
  ];

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

  // Dividend Growth 5Y
  let dividendGrowth5Y: Decimal | undefined;
  if (stockProfile?.dividendGrowth5Y !== undefined) {
      dividendGrowth5Y = new Decimal(stockProfile.dividendGrowth5Y);
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
  const inceptionDate = stockProfile?.inceptionDate;
  const payoutFrequency = stockProfile?.payoutFrequency;
  const payoutRatio = toDecimal(stockProfile?.payoutRatio);
  const holdingsCount = stockProfile?.holdingsCount;

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
    dividendGrowth5Y,
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
    exDividendDate,
    inceptionDate,
    payoutFrequency,
    payoutRatio,
    holdingsCount
  };
}
