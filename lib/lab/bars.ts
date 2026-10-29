import YahooFinance from "yahoo-finance2";
import { toCompact, type CompactSeries } from "@/lib/lab/bar-types";
import { mapChartResult } from "@/lib/lab/yahoo-bars";

// Daily history for Compass Lab, one ticker per request, full history through
// a completed session. Yahoo's `close` is split-adjusted and `adjclose` is
// split- and dividend-adjusted, both backward from today; returns within one
// response are consistent, and the client always replaces a ticker's history
// whole rather than merging days from different responses.

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const DAY_MS = 86_400_000;
const TTL_MS = 60 * 60_000;
const MAX_CACHE_ENTRIES = 300;

const cache = new Map<string, { value: CompactSeries | null; expires: number }>();
const inFlight = new Map<string, Promise<CompactSeries | null>>();

function remember(key: string, value: CompactSeries | null) {
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  // Map iterates in insertion order, so the first keys are the oldest.
  for (const k of cache.keys()) {
    if (cache.size <= MAX_CACHE_ENTRIES) break;
    cache.delete(k);
  }
}

/** Yahoo's way of saying a symbol has no chart, as opposed to a failed request. */
export function isNoDataError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no data found|symbol may be delisted|not found/i.test(message);
}

async function fetchHistory(ticker: string, through: string): Promise<CompactSeries | null> {
  try {
    const res = await yf.chart(ticker, {
      period1: "1970-01-01T00:00:00Z",
      // period2 is exclusive; include the whole `through` date.
      period2: new Date(Date.parse(`${through}T00:00:00Z`) + DAY_MS),
      interval: "1d",
      events: "div|split",
    });
    const series = mapChartResult(ticker, res, new Date().toISOString());
    // Completed sessions only: a live bar would be shared by every user for the whole cache lifetime.
    series.bars = series.bars.filter((b) => b.date <= through);
    series.dividends = series.dividends.filter((d) => d.date <= through);
    series.splits = series.splits.filter((s) => s.date <= through);
    return series.bars.length ? toCompact(series, through) : null;
  } catch (error) {
    if (isNoDataError(error)) return null;
    throw error;
  }
}

/** Full daily history through `through`, or null when Yahoo has none. Throws on upstream failure. */
export async function getTickerHistory(ticker: string, through: string): Promise<CompactSeries | null> {
  const key = `${ticker}:${through}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  // Concurrent requests for the same key share one upstream call.
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = fetchHistory(ticker, through)
    .then((value) => {
      remember(key, value);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}
