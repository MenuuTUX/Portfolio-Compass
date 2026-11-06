import type { SecCompanyFacts, SecSubmissions } from "./types";

/**
 * Minimal SEC EDGAR client. The SEC asks automated clients to declare a
 * User-Agent with a contact address and to stay under 10 requests a second.
 * The contact is the app maintainer's (SEC_USER_AGENT), never the user's.
 */
export interface SecClientOptions {
  userAgent: string;
  fetch?: typeof fetch;
  /** Requests per second; the SEC limit is 10, this stays under it. */
  ratePerSecond?: number;
  /** Per-request timeout. Default 15 seconds. */
  timeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface TickerEntry { cik: number; name: string; ticker: string; exchange: string }

const TICKERS_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
/** The ticker map changes rarely; it is built once per load and reused for this long. */
const TICKERS_TTL_MS = 24 * 3600_000;
/** A failed URL is not asked for again for this long, so callers do not pile onto a failing endpoint. */
const FAILURE_TTL_MS = 30_000;
const RETRY_STATUSES = new Set([429, 503]);
const RETRY_CAP_MS = 5_000;
const RETRY_DEFAULT_MS = 1_000;

export class SecHttpError extends Error {
  constructor(public status: number, url: string) {
    super(`SEC request failed with ${status}: ${url}`);
  }
}

export const padCik = (cik: number) => String(cik).padStart(10, "0");

/** Seconds or an HTTP date, capped; a missing or unreadable header waits one second. */
function retryDelayMs(header: string | null, now: number): number {
  if (!header) return RETRY_DEFAULT_MS;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
  if (!Number.isFinite(ms)) return RETRY_DEFAULT_MS;
  return Math.min(Math.max(ms, 0), RETRY_CAP_MS);
}

/**
 * Fetch with the declared User-Agent, a request timeout, one retry on 429 or 503,
 * a per-process rate limit and a short negative cache. Nothing is cached here
 * except the ticker map: parsed summaries are cached by the caller, so the
 * multi-megabyte raw JSON is not kept.
 */
export function createSecClient(opts: SecClientOptions) {
  if (!opts.userAgent || !/@/.test(opts.userAgent)) {
    throw new Error("SEC_USER_AGENT must name the app and include a contact email address.");
  }
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const interval = 1000 / (opts.ratePerSecond ?? 8);
  let nextSlot = 0;
  const inflight = new Map<string, Promise<unknown>>();
  const failures = new Map<string, { error: unknown; expires: number }>();
  let tickerLoad: { map: Promise<Map<string, TickerEntry>>; expires: number } | null = null;

  /** Spaces requests at least `interval` apart. */
  async function takeSlot() {
    const t = now();
    const wait = Math.max(0, nextSlot - t);
    nextSlot = Math.max(t, nextSlot) + interval;
    if (wait > 0) await sleep(wait);
  }

  /** One logical request: up to two attempts, the second only after 429 or 503. A 404 means not a filer: null. */
  async function attempt<T>(url: string): Promise<T | null> {
    for (let tries = 1; ; tries++) {
      await takeSlot();
      let res: Response;
      try {
        res = await doFetch(url, {
          headers: { "User-Agent": opts.userAgent, Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
          throw new Error(`SEC request timed out after ${timeoutMs} ms: ${url}`);
        }
        throw e;
      }
      if (res.status === 404) return null;
      if (res.ok) return (await res.json()) as T;
      if (tries === 1 && RETRY_STATUSES.has(res.status)) {
        await sleep(retryDelayMs(res.headers.get("Retry-After"), now()));
        continue;
      }
      throw new SecHttpError(res.status, url);
    }
  }

  /** Concurrent callers share one attempt; a failure is remembered for 30 seconds. */
  function getJson<T>(url: string): Promise<T | null> {
    const failed = failures.get(url);
    if (failed && failed.expires > now()) return Promise.reject(failed.error);
    const pending = inflight.get(url);
    if (pending) return pending as Promise<T | null>;
    const task = attempt<T>(url).catch((error: unknown) => {
      failures.set(url, { error, expires: now() + FAILURE_TTL_MS });
      throw error;
    });
    inflight.set(url, task);
    return task.finally(() => inflight.delete(url));
  }

  /** The ticker map is built once per load and reused until it expires. */
  function tickers(): Promise<Map<string, TickerEntry>> {
    if (tickerLoad && tickerLoad.expires > now()) return tickerLoad.map;
    const load = (async () => {
      const raw = await getJson<{ fields: string[]; data: (string | number)[][] }>(TICKERS_URL);
      if (!raw) throw new SecHttpError(404, TICKERS_URL);
      const idx = (name: string) => raw.fields.indexOf(name);
      const [ci, ni, ti, ei] = [idx("cik"), idx("name"), idx("ticker"), idx("exchange")];
      const map = new Map<string, TickerEntry>();
      for (const row of raw.data) {
        const ticker = String(row[ti]).toUpperCase();
        if (!map.has(ticker)) map.set(ticker, { cik: Number(row[ci]), name: String(row[ni]), ticker, exchange: String(row[ei] ?? "") });
      }
      return map;
    })();
    const entry = { map: load, expires: now() + TICKERS_TTL_MS };
    tickerLoad = entry;
    load.catch(() => {
      if (tickerLoad === entry) tickerLoad = null;
    });
    return load;
  }

  return {
    tickers,
    /** CIK for a ticker, or null when the company does not file with the SEC. */
    async lookup(ticker: string): Promise<TickerEntry | null> {
      const map = await tickers();
      return map.get(normalizeTicker(ticker)) ?? null;
    },
    /** Null when the SEC has no submissions for the CIK. */
    submissions: (cik: number) =>
      getJson<SecSubmissions>(`https://data.sec.gov/submissions/CIK${padCik(cik)}.json`),
    /** Null when the SEC has no company facts for the CIK. */
    companyFacts: (cik: number) =>
      getJson<SecCompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`),
  };
}

export type SecClient = ReturnType<typeof createSecClient>;

/** The SEC lists class shares with a dash (BRK-B); some sources use a dot (BRK.B). */
export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, "-");
}
