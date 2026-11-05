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

/** Live: asks the SEC on each request (through the client's cache). */
export function edgarLiveSource(client: SecClient): FilingsSource {
  return {
    id: "edgar-live",
    async getCompany(ticker) {
      const entry = await client.lookup(ticker);
      if (!entry) return null;
      const [facts, sub] = await Promise.all([client.companyFacts(entry.cik), client.submissions(entry.cik)]);
      return buildCompanyFilings(facts, sub, { ticker: entry.ticker, source: "edgar-live" });
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

/**
 * Tries each source in order. A source that throws (SEC down, rate limited,
 * not configured) falls through to the next; a definite "not a filer" (null)
 * from a source that answered is final.
 */
export function withFallback(...sources: FilingsSource[]): FilingsSource & { lastErrors: () => string[] } {
  let errors: string[] = [];
  return {
    id: sources[0].id,
    lastErrors: () => errors,
    async getCompany(ticker) {
      errors = [];
      for (const s of sources) {
        try {
          return await s.getCompany(ticker);
        } catch (e) {
          errors.push(`${s.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      throw new Error(`No filings source answered. ${errors.join(" ")}`);
    },
  };
}
