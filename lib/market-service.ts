import YahooFinance from 'yahoo-finance2';
import { Decimal } from './decimal';
import { getStockProfile } from './scrapers/stock-analysis';
import { findRedditCommunity } from './reddit-finder';
import pLimit from 'p-limit';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

// Yahoo Finance requires a User-Agent to avoid 429 Too Many Requests (Rate Limiting)
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
  redditUrl?: string | null;
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
  // Extended Metrics
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
  redditUrl?: string | null;
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
  retries = 3,
  baseDelay = 1000,
  fallbackValue?: T
): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      // Check for 429 specifically or generic network errors
      const isRateLimit = error.message?.includes('429') || error.status === 429 || error.message?.includes('Too Many Requests');

      if (attempt >= retries) {
        if (fallbackValue !== undefined) {
             console.warn(`Function failed after ${retries} attempts, returning fallback. Error: ${error.message}`);
             return fallbackValue;
        }
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1) + (Math.random() * 500); // Exponential backoff + jitter
      if (isRateLimit) {
         console.warn(`Rate limit hit (429). Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${retries})`);
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
  const retryingFetch = (t: string) => retryWithBackoff(() => fetchFn(t), 3, 1000);

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

// -----------------------------------------------------------------------------
// Core Functions
// -----------------------------------------------------------------------------

export async function fetchMarketSnapshot(tickers: string[]): Promise<MarketSnapshot[]> {
  if (tickers.length === 0) return [];

  const mapQuoteToSnapshot = async (quote: any): Promise<MarketSnapshot> => {
    const name = quote.shortName || quote.longName || quote.symbol;
    const resolvedTicker = quote.symbol;
    const redditUrl = await findRedditCommunity(resolvedTicker, name);

    return {
        ticker: resolvedTicker,
        price: new Decimal(quote.regularMarketPrice || 0),
        dailyChange: new Decimal(quote.regularMarketChange || 0),
        dailyChangePercent: normalizePercent(quote.regularMarketChangePercent),
        name: name,
        assetType: determineAssetType(quote.quoteType),
        redditUrl
    };
  };

  try {
    // Attempt to fetch all tickers in one batch from Yahoo
    // Wrapped in retry
    const results = await retryWithBackoff(() => yf.quote(tickers), 2, 500);

    if (Array.isArray(results)) {
        return Promise.all(results.map(mapQuoteToSnapshot));
    } else {
        return [await mapQuoteToSnapshot(results)];
    }
  } catch (error) {
    console.warn("Bulk fetch failed in fetchMarketSnapshot, attempting individual Yahoo fallbacks:", error);

    // Use p-limit for fallback to be nice to scraper
    // Reduced concurrency from 5 to 2 to minimize 429s
    const limit = pLimit(2);

    const promises = tickers.map((t) => limit(async (): Promise<MarketSnapshot | null> => {
        try {
            // Individual retry is handled by retryWithBackoff here
            const q = await retryWithBackoff(() => yf.quote(t), 3, 1000);
            return await mapQuoteToSnapshot(q);
        } catch (e) {
            console.warn(`Failed to fetch individual ticker ${t} from Yahoo. Trying scraper fallback...`);

            // --- Scraper Fallback ---
            try {
                const profile = await getStockProfile(t);
                if (profile) {
                    const priceVal = profile.price || profile.open || profile.previousClose || 0;
                    let change = 0;
                    let changePercent = 0;
                    if (profile.price && profile.previousClose) {
                        change = profile.price - profile.previousClose;
                        changePercent = (change / profile.previousClose) * 100;
                    } else if (profile.open && profile.previousClose) {
                        // Fallback change calculation
                        change = profile.open - profile.previousClose;
                        changePercent = (change / profile.previousClose) * 100;
                    }

                    const redditUrl = await findRedditCommunity(t, profile.description ? t : t); // simplified name

                    return {
                        ticker: t,
                        price: new Decimal(priceVal),
                        dailyChange: new Decimal(change),
                        dailyChangePercent: new Decimal(changePercent),
                        name: t, // Fallback name
                        assetType: profile.isEtf ? 'ETF' : 'STOCK',
                        redditUrl
                    };
                }
            } catch (scraperErr) {
                console.error(`Scraper fallback failed for ${t}:`, scraperErr);
            }
            return null;
        }
    }));

    const individualResults = await Promise.all(promises);
    return individualResults.filter((s): s is MarketSnapshot => s !== null);
  }
}

export async function fetchEtfDetails(
  originalTicker: string,
  fromDate?: Date,
  intervals: ('1h' | '1d' | '1wk' | '1mo')[] = ['1h', '1d', '1wk', '1mo']
): Promise<EtfDetails> {
  // Fetch from Stock Analysis (Parallel start)
  const stockProfilePromise = getStockProfile(originalTicker);

  // Yahoo Fetch
  let quoteSummary: any;
  let resolvedTicker = originalTicker;
  let yahooFailed = false;

  try {
      const res = await fetchWithFallback(originalTicker, async (t) => {
        const data = await yf.quoteSummary(t, {
          modules: ['price', 'summaryProfile', 'topHoldings', 'fundProfile', 'defaultKeyStatistics', 'summaryDetail']
        });
        if (!data.price || !data.price.regularMarketPrice) {
          throw new Error(`No price data for ${t}`);
        }
        return data;
      });
      quoteSummary = res.data;
      resolvedTicker = res.resolvedTicker;
  } catch (yfError) {
      console.warn(`Yahoo Finance details fetch failed for ${originalTicker}. Relying on StockAnalysis.`, yfError);
      yahooFailed = true;
  }

  const stockProfile = await stockProfilePromise;

  if (yahooFailed) {
      if (!stockProfile) throw new Error(`Both Yahoo and StockAnalysis failed for ${originalTicker}`);

      // Construct EtfDetails from StockProfile only
      const priceVal = stockProfile.price || stockProfile.open || stockProfile.previousClose || 0;
      let change = 0;
      if (stockProfile.price && stockProfile.previousClose) {
          change = stockProfile.price - stockProfile.previousClose;
      }

      const redditUrl = await findRedditCommunity(resolvedTicker, resolvedTicker);

      return {
          ticker: resolvedTicker,
          price: new Decimal(priceVal),
          dailyChange: new Decimal(change),
          name: resolvedTicker,
          description: stockProfile.description,
          assetType: stockProfile.isEtf ? 'ETF' : 'STOCK',
          sectors: stockProfile.sector ? { [stockProfile.sector]: new Decimal(1) } : {},
          topHoldings: [],
          history: [], // No history from scraper
          redditUrl,

          marketCap: stockProfile.marketCap ? new Decimal(stockProfile.marketCap) : undefined,
          revenue: stockProfile.revenue ? new Decimal(stockProfile.revenue) : undefined,
          netIncome: stockProfile.netIncome ? new Decimal(stockProfile.netIncome) : undefined,
          eps: stockProfile.eps ? new Decimal(stockProfile.eps) : undefined,
          sharesOutstanding: stockProfile.sharesOutstanding ? new Decimal(stockProfile.sharesOutstanding) : undefined,
          peRatio: stockProfile.peRatio ? new Decimal(stockProfile.peRatio) : undefined,
          forwardPe: stockProfile.forwardPe ? new Decimal(stockProfile.forwardPe) : undefined,
          dividend: stockProfile.dividend ? new Decimal(stockProfile.dividend) : undefined,
          dividendYield: stockProfile.dividendYield ? new Decimal(stockProfile.dividendYield) : undefined,
          dividendGrowth5Y: stockProfile.dividendGrowth5Y ? new Decimal(stockProfile.dividendGrowth5Y) : undefined,
          beta5Y: stockProfile.beta ? new Decimal(stockProfile.beta) : undefined,
          open: stockProfile.open ? new Decimal(stockProfile.open) : undefined,
          previousClose: stockProfile.previousClose ? new Decimal(stockProfile.previousClose) : undefined,
          fiftyTwoWeekHigh: stockProfile.fiftyTwoWeekHigh ? new Decimal(stockProfile.fiftyTwoWeekHigh) : undefined,
          fiftyTwoWeekLow: stockProfile.fiftyTwoWeekLow ? new Decimal(stockProfile.fiftyTwoWeekLow) : undefined,
          expenseRatio: stockProfile.expenseRatio ? new Decimal(stockProfile.expenseRatio) : undefined,
      };
  }

  // ... (Existing Yahoo processing logic) ...
  const name = quoteSummary.price?.shortName || quoteSummary.price?.longName || resolvedTicker;
  const redditUrl = await findRedditCommunity(resolvedTicker, name);

  const fetchHistoryInterval = async (interval: '1h' | '1d' | '1wk' | '1mo', period1: Date) => {
    try {
      const now = new Date();
      if (period1 > now) return [];

      // Wrapped in retry
      const res = await retryWithBackoff(() => yf.chart(resolvedTicker, {
        period1,
        period2: now,
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
  const otherPromises = [];
  if (intervals.includes('1h')) otherPromises.push(fetchHistoryInterval('1h', d7d).then(r => historyResults['1h'] = r));
  if (intervals.includes('1wk')) otherPromises.push(fetchHistoryInterval('1wk', d5y).then(r => historyResults['1wk'] = r));
  if (intervals.includes('1mo')) otherPromises.push(fetchHistoryInterval('1mo', dMax).then(r => historyResults['1mo'] = r));

  await Promise.all(otherPromises);

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
  const topHoldings = quoteSummary.topHoldings;
  const defaultKeyStatistics = quoteSummary.defaultKeyStatistics;
  const summaryDetail = quoteSummary.summaryDetail;
  const fundProfile = quoteSummary.fundProfile;

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
      const sectorName = stockProfile?.sector || profile?.sector;
      if (sectorName) {
          sectors[sectorName] = new Decimal(1.0);
      }
  }

  // --- Merge Financial Metrics (Prioritizing Stock Analysis) ---
  const toDecimal = (val: number | undefined) => val !== undefined ? new Decimal(val) : undefined;

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

  let dividendGrowth5Y: Decimal | undefined;
  if (stockProfile?.dividendGrowth5Y !== undefined) {
      dividendGrowth5Y = new Decimal(stockProfile.dividendGrowth5Y);
  }

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

  let beta5Y: Decimal | undefined;
  if (stockProfile?.beta !== undefined) {
      beta5Y = new Decimal(stockProfile.beta);
  } else {
      let rawBeta = defaultKeyStatistics?.beta;
      if (rawBeta) beta5Y = new Decimal(rawBeta);
  }

  let peRatio: Decimal | undefined;
  if (stockProfile?.peRatio !== undefined) {
      peRatio = new Decimal(stockProfile.peRatio);
  } else {
      if (summaryDetail?.trailingPE) peRatio = new Decimal(summaryDetail.trailingPE);
  }

  let forwardPe: Decimal | undefined;
  if (stockProfile?.forwardPe !== undefined) {
      forwardPe = new Decimal(stockProfile.forwardPe);
  } else {
      if (summaryDetail?.forwardPE) forwardPe = new Decimal(summaryDetail.forwardPE);
      else if (defaultKeyStatistics?.forwardPE) forwardPe = new Decimal(defaultKeyStatistics.forwardPE);
  }

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

  let description = stockProfile?.description || profile?.longBusinessSummary || "No description available.";

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

  let holdingsList: { ticker: string; name: string; sector: string | null; weight: Decimal }[] | undefined;
  if (topHoldings?.holdings && Array.isArray(topHoldings.holdings)) {
    holdingsList = topHoldings.holdings.map((h: any) => ({
      ticker: h.symbol,
      name: h.holdingName || h.symbol,
      sector: null,
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
    beta: beta5Y,
    earningsDate,
    dividend,
    exDividendDate,
    inceptionDate,
    payoutFrequency,
    payoutRatio,
    holdingsCount,
    redditUrl
  };
}
