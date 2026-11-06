import { buildCompanyFilings } from "./periods";
import { extensionDepreciation } from "./ixbrl";
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
 * Holding-company reorganizations where the new registrant has no annual report yet: new CIK -> predecessor CIK.
 * Each entry is a reviewed fact from the successor's 8-K12B, not a name guess.
 * 2115436 ExxonMobil Holdings Corp (8-K12B filed 2026-07-01) succeeds 34088 Exxon Mobil Corporation.
 */
export const SUCCESSOR_REGISTRANTS: Record<number, number> = { 2115436: 34088 };

/**
 * Live: asks the SEC for a company's facts and submissions, builds the summary,
 * and keeps the last 50 summaries for six hours (least recently used goes first).
 */
export function edgarLiveSource(client: SecClient, opts: { now?: () => number } = {}): FilingsSource {
  const now = opts.now ?? Date.now;
  const cache = new Map<number, { value: CompanyFilings; expires: number }>();

  /**
   * When the latest year's D&A is a sum of two tags, the company may file a fuller total under its own extension
   * tag that company-facts leaves out. The filing's inline XBRL is read for it, and a figure within a sane band of
   * the sum replaces the sum. A failed or empty read keeps the sum.
   */
  async function refineDepreciation(c: CompanyFilings): Promise<CompanyFilings> {
    const last = c.annual[c.annual.length - 1];
    const da = last?.items.depreciationAmortization;
    if (!last || !da || !da.tag.includes(" + ")) return c;
    const filing = c.filings.find((f) => f.accn === da.accn);
    if (!filing) return c;
    try {
      const html = await client.filingHtml(filing.url);
      const found = html ? extensionDepreciation(html, last.start, last.end) : null;
      if (!found || found.value < da.value * 0.6 || found.value > da.value * 2) return c;
      const annual = c.annual.slice(0, -1);
      annual.push({ ...last, items: { ...last.items, depreciationAmortization: { ...da, value: found.value, tag: found.tag } } });
      // Trailing = last year + year-to-date - prior year-to-date, so the correction carries over one for one. The
      // in-year change still comes from the two tags, which the tag text and the note keep saying.
      const tda = c.trailing?.items.depreciationAmortization;
      const trailing = c.trailing && tda && tda.tag === da.tag
        ? {
          ...c.trailing,
          items: {
            ...c.trailing.items,
            depreciationAmortization: {
              ...tda,
              value: tda.value + (found.value - da.value),
              tag: c.trailing.basis === "annual" ? found.tag : `${found.tag} + quarterly change from parts`,
            },
          },
        }
        : c.trailing;
      return { ...c, annual, trailing };
    } catch {
      return c;
    }
  }

  async function buildOne(cik: number, ticker: string): Promise<CompanyFilings | null> {
    const [facts, sub] = await Promise.all([client.companyFacts(cik), client.submissions(cik)]);
    if (!facts || !sub) return null;
    return refineDepreciation(buildCompanyFilings(facts, sub, { ticker, source: "edgar-live" }));
  }

  /**
   * A company that reorganized under a new holding company files under a new CIK with no annual report of its own.
   * For the reorganizations listed in SUCCESSOR_REGISTRANTS, the predecessor's annual history and quarters are used
   * with the holding company's name, current cover-page share count and filings on top.
   */
  async function buildFor(cik: number, ticker: string): Promise<CompanyFilings | null> {
    const built = await buildOne(cik, ticker);
    const predecessorCik = SUCCESSOR_REGISTRANTS[cik];
    if (!built || built.annual.length > 0 || !predecessorCik) return built;
    const old = await buildOne(predecessorCik, ticker).catch(() => null);
    if (!old || old.annual.length === 0) return built;
    return {
      ...old,
      cik: built.cik,
      name: built.name,
      sharesOutstanding: built.sharesOutstanding ?? old.sharesOutstanding,
      filings: [...built.filings, ...old.filings].sort((a, b) => b.filed.localeCompare(a.filed)),
      asOf: built.asOf > old.asOf ? built.asOf : old.asOf,
    };
  }

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
      const built = await buildFor(entry.cik, entry.ticker);
      if (!built) return null;
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
