import { buildCompanyFilings } from "./periods";
import { classConversionRates, coverShareCount, extensionDepreciation } from "./ixbrl";
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
 * Found with `bun scripts/sec-bulk.ts check` (quarterlies, no annual report, 8-K12B filed) and kept only where the
 * predecessor has the same name stem and SIC code, has annual history, and filed a 15-12G within two weeks of the
 * new registrant's 8-K12B (Exxon is the exception: it keeps filing as the operating company). Never guessed at run time.
 *   2115436 ExxonMobil Holdings Corp   <- 34088    Exxon Mobil Corp         8-K12B 2026-07-01
 *   2115119 Columbia Financial, Inc.   <- 1723596  Columbia Financial, Inc. 8-K12B 2026-07-21, 15-12G 2026-07-21
 *   2126198 Expro Ltd                  <- 1575828  Expro Group Holdings N.V. 8-K12B 2026-07-13, 15-12G 2026-07-24
 *   2152623 Navient Holdings, Inc.     <- 1593538  Navient LLC (was Navient Corp) 8-K12B 2026-10-29, 15-12G 2026-10-29
 *   2136387 Real REMAX Group Inc.      <- 1581091  RE/MAX Holdings, Inc. 8-K12B 2026-08-24, 15-12G 2026-09-04
 *   2119322 Digimarc Corp              <- 1438231  Old Digimarc Corp 8-K12B 2026-05-18, 15-12G 2026-05-18
 */
export const SUCCESSOR_REGISTRANTS: Record<number, number> = {
  2115436: 34088,
  2115119: 1723596,
  2126198: 1575828,
  2152623: 1593538,
  2136387: 1581091,
  2119322: 1438231,
};

/**
 * Share classes that are not one-for-one, as the weight of each class in the economically common class, keyed by
 * CIK and then the class member name in the filing. Berkshire's Class A converts into 1,500 Class B shares.
 * The weighted total is then in Class B equivalents, which is what the Class B price multiplies.
 */
const CLASS_WEIGHTS: Record<number, Record<string, number>> = {
  1067983: { CommonClassAMember: 1500, CommonClassBMember: 1 },
};

/**
 * Companies whose conversion rates change over time and are tagged in the filing itself: the fact that holds the
 * rate for each class, and the class that is the unit (rate 1, shown as a dash). Visa's class B and C shares
 * convert into class A at rates that fall as litigation losses are recovered, so the rates are read, not fixed.
 */
const CLASS_RATE_FACTS: Record<number, { fact: string; unit: string }> = {
  1403161: { fact: "v:CommonStockConversionRate", unit: "CommonClassAMember" },
};

/**
 * Whether a cover-page sum is far from the diluted average. Some filers tag the average in thousands or millions
 * without scaling it (McDonald's tags 716 for 716 million), which would make any sum look wrong, so a diluted
 * average that is about 1,000 or 1,000,000 times too small is read at the matching scale before comparing.
 */
function disagrees(sum: number, diluted: number): boolean {
  const near = (r: number) => r >= 0.75 && r <= 1.33;
  return ![1, 1e3, 1e6].some((scale) => near(sum / (diluted * scale)));
}

/**
 * Whether a cover-page sum agrees with any of the diluted averages given (newest first: the year-to-date average,
 * then the last fiscal year's). A company that grew its share count since its last fiscal year, as after an IPO,
 * agrees with the newer average; one that disagrees with all of them has classes that are not one-for-one.
 * With no average to compare, the sum is kept.
 */
export function sumAgreesWithDiluted(sum: number, averages: (number | undefined)[]): boolean {
  const known = averages.filter((d): d is number => typeof d === "number" && d > 0);
  return known.length === 0 || known.some((d) => !disagrees(sum, d));
}

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
      // Trailing = last year + year-to-date - prior year-to-date. When the 10-Q carries the same extension total for
      // both year-to-date spans, all three come from filed totals. Otherwise the correction to the fiscal year moves
      // trailing one for one and the in-year change stays built from the two tags, which the tag text says.
      const tda = c.trailing?.items.depreciationAmortization;
      let trailing = c.trailing;
      if (c.trailing && tda && tda.tag === da.tag) {
        const ytd = await quarterlyChange(tda.accn, last.end, c.trailing.end, last.start, found.tag, c.filings);
        trailing = {
          ...c.trailing,
          items: {
            ...c.trailing.items,
            depreciationAmortization: {
              ...tda,
              value: c.trailing.basis === "annual" ? found.value : ytd !== null ? found.value + ytd : tda.value + (found.value - da.value),
              tag: c.trailing.basis === "annual" || ytd !== null ? found.tag : `${found.tag} + quarterly change from parts`,
            },
          },
        };
      }
      return { ...c, annual, trailing };
    } catch {
      return c;
    }
  }

  /** Year-to-date minus prior year-to-date for the given extension tag, read from the 10-Q's inline XBRL, or null. */
  async function quarterlyChange(accn: string, yearEnd: string, ytdEnd: string, priorStart: string, tag: string, filings: CompanyFilings["filings"]): Promise<number | null> {
    const filing = filings.find((f) => f.accn === accn);
    if (!filing) return null;
    try {
      const html = await client.filingHtml(filing.url);
      if (!html) return null;
      const day = 86_400_000;
      const shift = (d: string, n: number) => new Date(Date.parse(d) + n * day).toISOString().slice(0, 10);
      const cur = extensionDepreciation(html, shift(yearEnd, 1), ytdEnd);
      const prior = extensionDepreciation(html, priorStart, shift(ytdEnd, -364));
      return cur && prior && cur.tag === tag && prior.tag === tag ? cur.value - prior.value : null;
    } catch {
      return null;
    }
  }

  /**
   * With no cover share count in company-facts (it leaves out counts reported per share class), the newest periodic
   * filing's inline XBRL is read for them. A failed or empty read leaves the count missing.
   */
  async function refineShares(c: CompanyFilings): Promise<CompanyFilings> {
    if (c.sharesOutstanding) return c;
    const filing = c.filings.find((f) => ["10-Q", "10-K", "20-F", "40-F"].includes(f.form));
    if (!filing) return c;
    try {
      const html = await client.filingHtml(filing.url);
      const rateFact = CLASS_RATE_FACTS[c.cik];
      const weights = html && rateFact
        ? { [rateFact.unit]: 1, ...classConversionRates(html, rateFact.fact) }
        : CLASS_WEIGHTS[c.cik];
      const count = html ? coverShareCount(html, weights) : null;
      const newest = [c.annual[c.annual.length - 1]?.end, c.trailing?.end].filter((d): d is string => Boolean(d)).sort().pop();
      // Same freshness rule as company-facts counts: not older than a year before the newest period.
      if (!count || (newest && Date.parse(count.asOf) < Date.parse(newest) - 400 * 86_400_000)) return c;
      // A raw sum over classes that are not one-for-one can be badly wrong (Berkshire's A is 1,500 B, handled by
      // CLASS_WEIGHTS) or double count (an Up-C voting class). A sum far from the latest diluted average is left out.
      // With no diluted average to check against, the sum is kept: its classes count is above 1, which downstream
      // shows as an approximate per-share warning.
      const averages = [c.trailing?.items.dilutedShares?.value, c.annual[c.annual.length - 1]?.items.dilutedShares?.value];
      if (count.classes > 1 && !count.weighted && !sumAgreesWithDiluted(count.value, averages)) return c;
      return { ...c, sharesOutstanding: { value: Math.round(count.value), asOf: count.asOf, classes: count.classes, accn: filing.accn } };
    } catch {
      return c;
    }
  }

  async function buildOne(cik: number, ticker: string): Promise<CompanyFilings | null> {
    const [facts, sub] = await Promise.all([client.companyFacts(cik), client.submissions(cik)]);
    if (!facts || !sub) return null;
    return refineShares(await refineDepreciation(buildCompanyFilings(facts, sub, { ticker, source: "edgar-live" })));
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
