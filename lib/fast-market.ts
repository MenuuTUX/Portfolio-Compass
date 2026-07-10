import YahooFinance from "yahoo-finance2";
import pLimit from "p-limit";

// Yahoo market data with in-memory TTL caching (no DB on the hot path).

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type ChartRange = "1D" | "1W" | "1M" | "1Y" | "5Y" | "MAX";

export interface HistoryPoint {
  date: string;
  price: number;
}

export interface FastQuote {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  change: number;
  assetType: "STOCK" | "ETF";
  marketCap?: number;
  volume?: number;
  peRatio?: number;
  forwardPe?: number;
  eps?: number;
  dividend?: number;
  dividendYield?: number;
  /** Expense ratio in percent (e.g. 0.09 for 0.09%). ETFs only. */
  expenseRatio?: number;
  open?: number;
  previousClose?: number;
  daysRange?: string;
  fiftyTwoWeekRange?: string;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  earningsDate?: string;
  sharesOutstanding?: number;
}

const RANGE_CONFIG: Record<
  ChartRange,
  { range: string; interval: string; ttlMs: number }
> = {
  "1D": { range: "1d", interval: "5m", ttlMs: 60_000 },
  "1W": { range: "5d", interval: "30m", ttlMs: 5 * 60_000 },
  "1M": { range: "1mo", interval: "1d", ttlMs: 10 * 60_000 },
  "1Y": { range: "1y", interval: "1d", ttlMs: 30 * 60_000 },
  "5Y": { range: "5y", interval: "1wk", ttlMs: 60 * 60_000 },
  MAX: { range: "max", interval: "1mo", ttlMs: 60 * 60_000 },
};

const QUOTE_TTL_MS = 30_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fn()
    .then((value) => {
      cache.set(key, { value, expires: Date.now() + ttlMs });
      if (cache.size > 2000) {
        const now = Date.now();
        for (const [k, v] of cache) if (v.expires < now) cache.delete(k);
      }
      return value;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}

function normalizeTickers(tickers: string[]): string[] {
  return Array.from(
    new Set(
      tickers
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z0-9.^=-]{1,12}$/.test(t)),
    ),
  );
}

function mapQuote(q: any): FastQuote {
  const low = q.regularMarketDayLow;
  const high = q.regularMarketDayHigh;
  const yearLow = q.fiftyTwoWeekLow;
  const yearHigh = q.fiftyTwoWeekHigh;
  const fmtRange = (a?: number, b?: number) =>
    a !== undefined && b !== undefined
      ? `${a.toFixed(2)} - ${b.toFixed(2)}`
      : undefined;

  let dividendYield: number | undefined;
  if (typeof q.trailingAnnualDividendYield === "number") {
    dividendYield = q.trailingAnnualDividendYield * 100;
  } else if (typeof q.dividendYield === "number") {
    // Some payloads already express this as a percentage
    dividendYield =
      q.dividendYield < 1 ? q.dividendYield * 100 : q.dividendYield;
  }

  // netExpenseRatio is already percent (e.g. 0.0945 for SPY). 0 = missing.
  let expenseRatio: number | undefined;
  if (typeof q.netExpenseRatio === "number" && q.netExpenseRatio > 0) {
    expenseRatio = q.netExpenseRatio;
  }

  return {
    ticker: q.symbol,
    name: q.shortName || q.longName || q.symbol,
    price: q.regularMarketPrice ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
    change: q.regularMarketChange ?? 0,
    assetType: q.quoteType === "ETF" ? "ETF" : "STOCK",
    marketCap: q.marketCap,
    volume: q.regularMarketVolume,
    peRatio: q.trailingPE,
    forwardPe: q.forwardPE,
    eps: q.epsTrailingTwelveMonths,
    dividend: q.trailingAnnualDividendRate,
    dividendYield,
    expenseRatio,
    open: q.regularMarketOpen,
    previousClose: q.regularMarketPreviousClose,
    daysRange: fmtRange(low, high),
    fiftyTwoWeekRange: fmtRange(yearLow, yearHigh),
    fiftyTwoWeekHigh: yearHigh,
    fiftyTwoWeekLow: yearLow,
    earningsDate: q.earningsTimestamp
      ? new Date(q.earningsTimestamp).toISOString().split("T")[0]
      : undefined,
    sharesOutstanding: q.sharesOutstanding,
  };
}

export async function getFastQuotes(
  tickers: string[],
): Promise<Map<string, FastQuote>> {
  const clean = normalizeTickers(tickers);
  const result = new Map<string, FastQuote>();
  if (clean.length === 0) return result;

  const misses: string[] = [];
  for (const t of clean) {
    const hit = cache.get(`q:${t}`);
    if (hit && hit.expires > Date.now()) {
      result.set(t, hit.value as FastQuote);
    } else {
      misses.push(t);
    }
  }

  if (misses.length > 0) {
    try {
      const raw = await yf.quote(misses);
      const quotes = Array.isArray(raw) ? raw : [raw];
      for (const q of quotes) {
        if (!q?.symbol || typeof q.regularMarketPrice !== "number") continue;
        const mapped = mapQuote(q);
        cache.set(`q:${mapped.ticker}`, {
          value: mapped,
          expires: Date.now() + QUOTE_TTL_MS,
        });
        result.set(mapped.ticker, mapped);
      }
    } catch (e) {
      console.warn("[FastMarket] Batch quote failed:", e);
    }
  }

  return result;
}

// History: the spark endpoint returns close series for many symbols in a
// single request. Falls back to per-ticker chart() calls if spark misbehaves.

function parseSparkPayload(
  json: any,
  out: Map<string, HistoryPoint[]>,
): void {
  const toPoints = (timestamps: number[], closes: (number | null)[]) => {
    const points: HistoryPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close === null || close === undefined) continue;
      points.push({
        date: new Date(timestamps[i] * 1000).toISOString(),
        price: close,
      });
    }
    return points;
  };

  // Shape A: { spark: { result: [{ symbol, response: [{ timestamp, indicators }] }] } }
  const results = json?.spark?.result;
  if (Array.isArray(results)) {
    for (const r of results) {
      const resp = r?.response?.[0];
      const ts = resp?.timestamp;
      const closes = resp?.indicators?.quote?.[0]?.close;
      if (r?.symbol && Array.isArray(ts) && Array.isArray(closes)) {
        out.set(r.symbol.toUpperCase(), toPoints(ts, closes));
      }
    }
    return;
  }

  // Shape B: { AAPL: { timestamp: [...], close: [...] } }
  if (json && typeof json === "object") {
    for (const [symbol, data] of Object.entries<any>(json)) {
      if (Array.isArray(data?.timestamp) && Array.isArray(data?.close)) {
        out.set(symbol.toUpperCase(), toPoints(data.timestamp, data.close));
      }
    }
  }
}

async function fetchSparkChunk(
  tickers: string[],
  range: ChartRange,
): Promise<Map<string, HistoryPoint[]>> {
  const { range: yfRange, interval } = RANGE_CONFIG[range];
  const out = new Map<string, HistoryPoint[]>();

  const url =
    `https://query1.finance.yahoo.com/v8/finance/spark` +
    `?symbols=${encodeURIComponent(tickers.join(","))}` +
    `&range=${yfRange}&interval=${interval}&includePrePost=false`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`spark ${res.status}`);
  parseSparkPayload(await res.json(), out);
  return out;
}

async function fetchChartFallback(
  ticker: string,
  range: ChartRange,
): Promise<HistoryPoint[]> {
  const { range: yfRange, interval } = RANGE_CONFIG[range];
  const now = new Date();
  const period1 = new Date(now);
  switch (yfRange) {
    case "1d":
      period1.setDate(now.getDate() - 1);
      break;
    case "5d":
      period1.setDate(now.getDate() - 7);
      break;
    case "1mo":
      period1.setMonth(now.getMonth() - 1);
      break;
    case "1y":
      period1.setFullYear(now.getFullYear() - 1);
      break;
    case "5y":
      period1.setFullYear(now.getFullYear() - 5);
      break;
    default:
      period1.setTime(0);
  }

  const res = await yf.chart(ticker, {
    period1,
    period2: now,
    interval: interval as any,
  });

  return (res?.quotes || [])
    .filter((q: any) => q.close !== null && q.close !== undefined)
    .map((q: any) => ({
      date: new Date(q.date).toISOString(),
      price: q.close as number,
    }));
}

export async function getFastHistory(
  tickers: string[],
  range: ChartRange,
): Promise<Map<string, HistoryPoint[]>> {
  const clean = normalizeTickers(tickers);
  const result = new Map<string, HistoryPoint[]>();
  if (clean.length === 0) return result;

  const { ttlMs } = RANGE_CONFIG[range];
  const misses: string[] = [];
  for (const t of clean) {
    const hit = cache.get(`h:${range}:${t}`);
    if (hit && hit.expires > Date.now()) {
      result.set(t, hit.value as HistoryPoint[]);
    } else {
      misses.push(t);
    }
  }

  if (misses.length === 0) return result;

  // Batch via spark in chunks of 20, all chunks in parallel
  const chunks: string[][] = [];
  for (let i = 0; i < misses.length; i += 20) {
    chunks.push(misses.slice(i, i + 20));
  }

  const stillMissing = new Set(misses);
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const series = await cached(
          `spark:${range}:${chunk.join(",")}`,
          ttlMs,
          () => fetchSparkChunk(chunk, range),
        );
        for (const [ticker, points] of series) {
          if (points.length === 0) continue;
          cache.set(`h:${range}:${ticker}`, {
            value: points,
            expires: Date.now() + ttlMs,
          });
          result.set(ticker, points);
          stillMissing.delete(ticker);
        }
      } catch (e) {
        console.warn(`[FastMarket] Spark chunk failed (${chunk.length} tickers):`, e);
      }
    }),
  );

  // Fallback: per-ticker chart() for anything spark didn't return
  if (stillMissing.size > 0) {
    const limit = pLimit(4);
    await Promise.all(
      Array.from(stillMissing).map((ticker) =>
        limit(async () => {
          try {
            const points = await cached(`chart:${range}:${ticker}`, ttlMs, () =>
              fetchChartFallback(ticker, range),
            );
            if (points.length > 0) {
              cache.set(`h:${range}:${ticker}`, {
                value: points,
                expires: Date.now() + ttlMs,
              });
              result.set(ticker, points);
            }
          } catch (e) {
            console.warn(`[FastMarket] Chart fallback failed for ${ticker}:`, e);
          }
        }),
      ),
    );
  }

  return result;
}

export function isChartRange(value: string): value is ChartRange {
  return value in RANGE_CONFIG;
}

// Symbol search: Yahoo's public autocomplete endpoint resolves free-text
// queries ("meta", "apple") to tickers without touching our database.

const SEARCH_TTL_MS = 60_000;

export async function searchFastSymbols(
  query: string,
  assetType?: "STOCK" | "ETF",
  limit = 15,
): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const key = `search:${trimmed.toLowerCase()}`;
  const quoteTypeFilter =
    assetType === "STOCK" ? "EQUITY" : assetType === "ETF" ? "ETF" : null;

  const results = await cached(key, SEARCH_TTL_MS, async () => {
    const res = await yf.search(trimmed, {
      quotesCount: 20,
      newsCount: 0,
    });
    return (res.quotes || [])
      .filter((q: any) => q.symbol && q.quoteType)
      .map((q: any) => ({
        symbol: q.symbol as string,
        quoteType: q.quoteType as string,
      }));
  });

  const filtered = quoteTypeFilter
    ? results.filter((r) => r.quoteType === quoteTypeFilter)
    : results.filter((r) => r.quoteType === "EQUITY" || r.quoteType === "ETF");

  return Array.from(new Set(filtered.map((r) => r.symbol))).slice(0, limit);
}

// Fund technicals from Yahoo quoteSummary. Bond funds expose credit ratings
// and duration rather than equity holdings — we surface both so the UI can
// pick the right breakdown by fund class.

const ETF_DETAILS_TTL_MS = 10 * 60_000;

export interface FastEtfDetails {
  ticker: string;
  description?: string;
  expenseRatio?: number; // percent, e.g. 0.09 for 0.09%
  beta?: number;
  holdingsCount?: number;
  /** Equity sector weights as 0-1 fractions, keyed by Yahoo slug or label */
  sectors: Record<string, number>;
  /** Credit-quality weights as 0-1 fractions (bond funds) */
  creditQuality: Record<string, number>;
  holdings: { ticker: string; name: string; weight: number }[]; // weight as %
  allocation?: {
    equities: number;
    bonds: number;
    cash: number;
    other?: number;
  };
  fundClass?:
    | "equity"
    | "bond"
    | "mixed"
    | "commodity"
    | "leveraged"
    | "cash"
    | "unknown";
  category?: string;
  family?: string;
  bondMaturity?: number;
  bondDuration?: number;
  volume?: number;
}

export async function getFastEtfDetails(
  ticker: string,
): Promise<FastEtfDetails | null> {
  const key = `etfdetail:${ticker.trim().toUpperCase()}`;

  try {
    return await cached(key, ETF_DETAILS_TTL_MS, async () => {
      // Lazy import to keep the hot quote path free of this module's deps graph
      const {
        detectFundClass,
        positionsToAllocation,
        parseBondRatings,
        normalizeExpenseRatio,
        pickBeta,
      } = await import("@/lib/asset-class");

      const [data, quote] = await Promise.all([
        yf.quoteSummary(ticker, {
          modules: [
            "summaryProfile",
            "fundProfile",
            "topHoldings",
            "defaultKeyStatistics",
            "price",
          ],
        }),
        yf.quote(ticker).catch(() => null),
      ]);

      const th = data.topHoldings as any;
      const sectors: Record<string, number> = {};
      th?.sectorWeightings?.forEach((w: any) => {
        const [sectorKey] = Object.keys(w);
        if (sectorKey && typeof w[sectorKey] === "number" && w[sectorKey] > 0) {
          sectors[sectorKey] = w[sectorKey];
        }
      });

      const creditQuality = parseBondRatings(th?.bondRatings);

      const holdings = (th?.holdings || [])
        .filter((h: any) => h.symbol || h.holdingName)
        .map((h: any) => ({
          ticker: (h.symbol as string) || (h.holdingName as string),
          name: (h.holdingName as string) || h.symbol,
          weight: (h.holdingPercent || 0) * 100,
        }));

      const feeFromProfile =
        data.fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio;
      const feeFromQuote =
        typeof (quote as any)?.netExpenseRatio === "number"
          ? (quote as any).netExpenseRatio
          : undefined;
      const expenseRatio =
        normalizeExpenseRatio(feeFromQuote, "quote") ??
        normalizeExpenseRatio(feeFromProfile, "profile");

      const stockPosition = th?.stockPosition;
      const bondPosition = th?.bondPosition;
      const cashPosition = th?.cashPosition;
      const otherPosition = th?.otherPosition;

      const name =
        (quote as any)?.shortName ||
        (quote as any)?.longName ||
        data.price?.shortName ||
        data.price?.longName ||
        ticker;
      const description =
        data.summaryProfile?.longBusinessSummary || undefined;
      const category = data.fundProfile?.categoryName || undefined;
      const family = data.fundProfile?.family || undefined;

      const fundClass = detectFundClass({
        name,
        category,
        description,
        stockPosition,
        bondPosition,
        cashPosition,
        otherPosition,
      });

      const allocation = positionsToAllocation({
        stockPosition,
        bondPosition,
        cashPosition,
        otherPosition,
      });

      const bondMaturity =
        typeof th?.bondHoldings?.maturity === "number"
          ? th.bondHoldings.maturity
          : undefined;
      const bondDuration =
        typeof th?.bondHoldings?.duration === "number"
          ? th.bondHoldings.duration
          : undefined;

      const beta = pickBeta(
        data.defaultKeyStatistics?.beta as number | undefined,
        data.defaultKeyStatistics?.beta3Year as number | undefined,
      );

      const volume =
        typeof (quote as any)?.regularMarketVolume === "number"
          ? (quote as any).regularMarketVolume
          : undefined;

      return {
        ticker: ticker.toUpperCase(),
        description,
        expenseRatio,
        beta,
        holdingsCount: holdings.length || undefined,
        sectors,
        creditQuality,
        holdings,
        allocation: allocation ?? undefined,
        fundClass,
        category,
        family,
        bondMaturity,
        bondDuration,
        volume,
      } satisfies FastEtfDetails;
    });
  } catch (e) {
    console.warn(`[FastMarket] ETF details fetch failed for ${ticker}:`, e);
    return null;
  }
}

/**
 * Fill gaps Yahoo leaves on Canadian / sparse funds via stockanalysis.com.
 * Only called when the fast path is incomplete — allowlisted venues only.
 */
export async function enrichEtfDetailsGaps(
  base: FastEtfDetails,
): Promise<FastEtfDetails> {
  const needsMer = !base.expenseRatio;
  const needsHoldings = base.holdings.length === 0;
  const needsDesc = !base.description;
  const needsBeta = base.beta === undefined;

  if (!needsMer && !needsHoldings && !needsDesc && !needsBeta) {
    return base;
  }

  try {
    const { getStockProfile, getEtfHoldings } = await import(
      "@/lib/scrapers/stock-analysis"
    );
    const { normalizeExpenseRatio, pickBeta } = await import(
      "@/lib/asset-class"
    );

    const [profile, scrapedHoldings] = await Promise.all([
      needsMer || needsDesc || needsBeta
        ? getStockProfile(base.ticker)
        : Promise.resolve(null),
      needsHoldings ? getEtfHoldings(base.ticker) : Promise.resolve([]),
    ]);

    const next: FastEtfDetails = { ...base };

    if (profile) {
      if (needsMer) {
        const mer = normalizeExpenseRatio(profile.expenseRatio, "scraper");
        if (mer !== undefined) next.expenseRatio = mer;
      }
      if (needsDesc && profile.description) {
        next.description = profile.description;
      }
      if (needsBeta) {
        const b = pickBeta(profile.beta, undefined);
        if (b !== undefined) next.beta = b;
      }
      if (
        profile.bondMaturity !== undefined &&
        next.bondMaturity === undefined
      ) {
        next.bondMaturity = profile.bondMaturity;
      }
      if (
        profile.bondDuration !== undefined &&
        next.bondDuration === undefined
      ) {
        next.bondDuration = profile.bondDuration;
      }
      if (profile.holdingsCount && !next.holdingsCount) {
        next.holdingsCount = profile.holdingsCount;
      }
    }

    if (needsHoldings && scrapedHoldings.length > 0) {
      next.holdings = scrapedHoldings.map((h) => ({
        ticker: h.symbol,
        name: h.name || h.symbol,
        // scraper stores fraction 0-1; UI expects percent
        weight: h.weight <= 1.5 ? h.weight * 100 : h.weight,
      }));
      next.holdingsCount = next.holdings.length;
    }

    return next;
  } catch (e) {
    console.warn(`[FastMarket] Gap enrichment failed for ${base.ticker}:`, e);
    return base;
  }
}
