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
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface TickerEntry { cik: number; name: string; ticker: string; exchange: string }

const TTL = {
  tickers: 24 * 3600_000,
  submissions: 6 * 3600_000,
  facts: 6 * 3600_000,
};

export class SecHttpError extends Error {
  constructor(public status: number, url: string) {
    super(`SEC request failed with ${status}: ${url}`);
  }
}

export const padCik = (cik: number) => String(cik).padStart(10, "0");

export function createSecClient(opts: SecClientOptions) {
  if (!opts.userAgent || !/@/.test(opts.userAgent)) {
    throw new Error("SEC_USER_AGENT must name the app and include a contact email address.");
  }
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const interval = 1000 / (opts.ratePerSecond ?? 8);
  let nextSlot = 0;
  const inflight = new Map<string, Promise<unknown>>();
  const cache = new Map<string, { value: unknown; expires: number }>();

  /** Spaces requests at least `interval` apart. */
  async function takeSlot() {
    const t = now();
    const wait = Math.max(0, nextSlot - t);
    nextSlot = Math.max(t, nextSlot) + interval;
    if (wait > 0) await sleep(wait);
  }

  async function getJson<T>(url: string, ttl: number): Promise<T> {
    const hit = cache.get(url);
    if (hit && hit.expires > now()) return hit.value as T;
    const pending = inflight.get(url);
    if (pending) return pending as Promise<T>;
    const task = (async () => {
      await takeSlot();
      const res = await doFetch(url, { headers: { "User-Agent": opts.userAgent, Accept: "application/json" } });
      if (!res.ok) throw new SecHttpError(res.status, url);
      const value = (await res.json()) as T;
      cache.set(url, { value, expires: now() + ttl });
      return value;
    })();
    inflight.set(url, task);
    try {
      return await task;
    } finally {
      inflight.delete(url);
    }
  }

  async function tickers(): Promise<Map<string, TickerEntry>> {
    const raw = await getJson<{ fields: string[]; data: (string | number)[][] }>(
      "https://www.sec.gov/files/company_tickers_exchange.json", TTL.tickers);
    const idx = (name: string) => raw.fields.indexOf(name);
    const [ci, ni, ti, ei] = [idx("cik"), idx("name"), idx("ticker"), idx("exchange")];
    const map = new Map<string, TickerEntry>();
    for (const row of raw.data) {
      const ticker = String(row[ti]).toUpperCase();
      if (!map.has(ticker)) map.set(ticker, { cik: Number(row[ci]), name: String(row[ni]), ticker, exchange: String(row[ei] ?? "") });
    }
    return map;
  }

  return {
    tickers,
    /** CIK for a ticker, or null when the company does not file with the SEC. */
    async lookup(ticker: string): Promise<TickerEntry | null> {
      const map = await tickers();
      return map.get(normalizeTicker(ticker)) ?? null;
    },
    submissions: (cik: number) =>
      getJson<SecSubmissions>(`https://data.sec.gov/submissions/CIK${padCik(cik)}.json`, TTL.submissions),
    companyFacts: (cik: number) =>
      getJson<SecCompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`, TTL.facts),
  };
}

export type SecClient = ReturnType<typeof createSecClient>;

/** The SEC lists class shares with a dash (BRK-B); some sources use a dot (BRK.B). */
export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, "-");
}
