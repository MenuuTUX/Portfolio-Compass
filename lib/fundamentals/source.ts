import { buildCompanyFilings } from "./periods";
import { normalizeTicker, type SecClient } from "./sec-client";
import type { CompanyFilings, FilingsSourceId } from "./types";

/**
 * Where company filings come from. Both sources return the same parsed shape,
 * so nothing downstream depends on which one answered.
 */
export interface FilingsSource {
  id: FilingsSourceId;
  /** Parsed filings for one company, or null if the ticker does not file with the SEC. */
  getCompany(ticker: string): Promise<CompanyFilings | null>;
}

/** Built summaries kept per CIK. Raw company facts are dropped once a summary is built. */
const LIVE_CACHE_MAX = 50;
const LIVE_CACHE_TTL_MS = 6 * 3600_000;

/**
 * Live: asks the SEC for a company's facts and submissions, builds the summary,
 * and keeps the last 50 summaries for six hours (least recently used goes first).
 */
export function edgarLiveSource(client: SecClient, opts: { now?: () => number } = {}): FilingsSource {
  const now = opts.now ?? Date.now;
  const cache = new Map<number, { value: CompanyFilings; expires: number }>();
  return {
    id: "edgar-live",
    async getCompany(ticker) {
      const entry = await client.lookup(ticker);
      if (!entry) return null;
      const hit = cache.get(entry.cik);
      if (hit && hit.expires > now()) {
        cache.delete(entry.cik);
        cache.set(entry.cik, hit);
        return { ...hit.value, ticker: entry.ticker };
      }
      cache.delete(entry.cik);
      const [facts, sub] = await Promise.all([client.companyFacts(entry.cik), client.submissions(entry.cik)]);
      if (!facts || !sub) return null;
      const built = buildCompanyFilings(facts, sub, { ticker: entry.ticker, source: "edgar-live" });
      cache.set(entry.cik, { value: built, expires: now() + LIVE_CACHE_TTL_MS });
      while (cache.size > LIVE_CACHE_MAX) cache.delete(cache.keys().next().value!);
      return built;
    },
  };
}

/**
 * Snapshot: static files built nightly from the SEC's bulk downloads, served
 * from any static host (`baseUrl`). Layout: sec/tickers.json maps a ticker to
 * its CIK; sec/c/{CIK}.json holds one CompanyFilings.
 */
export function snapshotSource(baseUrl: string, doFetch: typeof fetch = fetch): FilingsSource {
  const root = baseUrl.replace(/\/+$/, "");
  let tickers: Promise<Record<string, number>> | null = null;
  const loadTickers = () => {
    tickers ??= doFetch(`${root}/sec/tickers.json`).then((r) => {
      if (!r.ok) throw new Error(`Snapshot ticker list unavailable (${r.status}).`);
      return r.json() as Promise<Record<string, number>>;
    }).catch((e) => {
      tickers = null;
      throw e;
    });
    return tickers;
  };
  return {
    id: "snapshot",
    async getCompany(ticker) {
      const cik = (await loadTickers())[normalizeTicker(ticker)];
      if (!cik) return null;
      const res = await doFetch(`${root}/sec/c/${cik}.json`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Snapshot file unavailable (${res.status}).`);
      return { ...((await res.json()) as CompanyFilings), source: "snapshot" };
    },
  };
}

/** A lookup result with the errors from that lookup only (sources that failed before one answered). */
export interface FilingsLookup {
  company: CompanyFilings | null;
  errors: string[];
}

/**
 * Tries each source in order. A source that throws (SEC down, rate limited,
 * not configured) falls through to the next; a definite "not a filer" (null)
 * from a source that answered is final. When no source answers, the thrown
 * error carries that lookup's `errors`.
 */
export function withFallback(...sources: FilingsSource[]): FilingsSource & {
  lookup: (ticker: string) => Promise<FilingsLookup>;
  /** @deprecated Shared by all calls; with parallel calls it may hold another call's errors. Use `lookup().errors`. */
  lastErrors: () => string[];
} {
  let lastCompleted: string[] = [];
  const lookup = async (ticker: string): Promise<FilingsLookup> => {
    const errors: string[] = [];
    for (const s of sources) {
      try {
        const company = await s.getCompany(ticker);
        lastCompleted = errors;
        return { company, errors };
      } catch (e) {
        errors.push(`${s.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    lastCompleted = errors;
    throw Object.assign(new Error(`No filings source answered. ${errors.join(" ")}`), { errors });
  };
  return {
    id: sources[0].id,
    lookup,
    lastErrors: () => lastCompleted,
    async getCompany(ticker) {
      return (await lookup(ticker)).company;
    },
  };
}
