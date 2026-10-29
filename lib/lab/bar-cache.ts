import { fromCompact, lastCompletedSession, type BarSeries, type CompactSeries } from "@/lib/lab/bar-types";
import { idbGet, idbPut } from "@/lib/lab/db";

// Browser cache of daily history for Compass Lab, one compact record per
// ticker in IndexedDB. A record that reaches the latest completed session is
// reused with no network request at all; one that stops short (Yahoo settling
// late, or a holiday) is reused for 30 minutes, matching the server's recheck.
// Otherwise the ticker's whole history is fetched again from one
// CDN-cacheable URL and replaces the record. Replacing (never merging) keeps
// every record on one adjustment basis.

/** A stored record: the server's payload plus when this browser received it. */
export type CachedRecord = CompactSeries & { receivedAt?: string };

export interface BarStore {
  get(ticker: string): Promise<CachedRecord | undefined>;
  put(series: CachedRecord): Promise<void>;
}

export type FetchResult =
  | { ok: true; series: CompactSeries }
  /** `expected` is the session the server wanted, when it rejected ours (clocks disagree). */
  | { ok: false; status: number; retryAfter?: number; expected?: string };

/** Same as the server's CDN lifetime for a history that stops short of `through`. */
export const RECHECK_MS = 30 * 60_000;

export function isFresh(hit: CachedRecord | undefined, through: string, now: Date): boolean {
  if (hit?.v !== 1 || hit.through < through) return false;
  if (hit.d[hit.d.length - 1] >= through) return true;
  const received = Date.parse(hit.receivedAt ?? "");
  return Number.isFinite(received) && now.getTime() - received < RECHECK_MS;
}

export type FetchHistory = (ticker: string, through: string) => Promise<FetchResult>;

export function indexedDbBarStore(): BarStore {
  return {
    get: (ticker) => idbGet<CompactSeries>("bars", ticker),
    put: (series) => idbPut("bars", series),
  };
}

export function memoryBarStore(): BarStore {
  const records = new Map<string, CompactSeries>();
  return {
    async get(ticker) {
      return records.get(ticker);
    },
    async put(series) {
      records.set(series.ticker, series);
    },
  };
}

export const fetchHistoryFromApi: FetchHistory = async (ticker, through) => {
  const params = new URLSearchParams({ ticker, through });
  const res = await fetch(`/api/market/bars?${params}`);
  if (res.ok) return { ok: true, series: (await res.json()) as CompactSeries };
  const retryAfter = Number(res.headers.get("Retry-After"));
  const expected = res.status === 400 ? ((await res.json().catch(() => ({}))) as { expected?: string }).expected : undefined;
  return {
    ok: false,
    status: res.status,
    ...(Number.isFinite(retryAfter) && res.headers.has("Retry-After") ? { retryAfter } : {}),
    ...(expected ? { expected } : {}),
  };
};

/** Requests in flight at once: enough to load a universe quickly, few enough to stay inside the API rate limit. */
export const FETCH_CONCURRENCY = 6;
const MAX_RETRY_WAIT_S = 5;

async function fetchWithRetry(fetchOne: FetchHistory, ticker: string, through: string, wait: (ms: number) => Promise<void>) {
  const first = await fetchOne(ticker, through);
  // This device's clock is a little off: ask for the session the server expects, once.
  if (!first.ok && first.status === 400 && first.expected && first.expected !== through) return fetchOne(ticker, first.expected);
  if (first.ok || first.status !== 429) return first;
  // One polite retry after a rate limit; a second 429 is reported.
  await wait(Math.min(MAX_RETRY_WAIT_S, first.retryAfter ?? 1) * 1000);
  return fetchOne(ticker, through);
}

export interface LoadResult {
  series: BarSeries[];
  /** Tickers with no history in the requested range. */
  missing: string[];
  /** Tickers the server could not load; an older cached copy was used if one existed. */
  failed: string[];
  /** Latest completed session the data covers. */
  through: string;
  /** Network requests made; 0 when everything came from the local cache. */
  requests: number;
}

/**
 * Daily history for `tickers` over [start, end], from IndexedDB when it covers
 * the latest completed session and from /api/market/bars otherwise.
 */
export async function loadBars(
  tickers: string[],
  start: string,
  end: string,
  {
    store,
    fetchOne = fetchHistoryFromApi,
    now = new Date(),
    wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  }: {
    store: BarStore;
    fetchOne?: FetchHistory;
    now?: Date;
    wait?: (ms: number) => Promise<void>;
  },
): Promise<LoadResult> {
  const through = lastCompletedSession(now);
  const records = new Map<string, CachedRecord>();
  const stale = new Map<string, CachedRecord>();
  const toFetch: string[] = [];

  await Promise.all(tickers.map(async (ticker) => {
    const hit = await store.get(ticker).catch(() => undefined);
    if (hit && isFresh(hit, through, now)) records.set(ticker, hit);
    else {
      if (hit?.v === 1) stale.set(ticker, hit);
      toFetch.push(ticker);
    }
  }));

  const failed: string[] = [];
  let requests = 0;
  let next = 0;
  const worker = async () => {
    while (next < toFetch.length) {
      const ticker = toFetch[next++];
      requests++;
      const res = await fetchWithRetry(fetchOne, ticker, through, wait).catch(() => ({ ok: false as const, status: 0 }));
      if (res.ok) {
        const record: CachedRecord = { ...res.series, receivedAt: now.toISOString() };
        records.set(ticker, record);
        await store.put(record).catch(() => undefined);
      } else if (res.status !== 404) {
        failed.push(ticker);
        const old = stale.get(ticker);
        if (old) records.set(ticker, old);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, toFetch.length) }, worker));

  const series: BarSeries[] = [];
  const missing: string[] = [];
  for (const ticker of tickers) {
    const record = records.get(ticker);
    const s = record && fromCompact(record, start, end);
    if (s && s.bars.length > 0) series.push(s);
    // A failed fetch with no older copy is reported as failed, not as missing data.
    else if (record || !failed.includes(ticker)) missing.push(ticker);
  }
  return { series, missing, failed, through, requests };
}
