import { CONCEPTS, LINE_ITEMS } from "./concepts";
import type {
  AnnualPeriod,
  CompanyFilings,
  FactValue,
  Filing,
  FilingsSourceId,
  LineItem,
  SecCompanyFacts,
  SecFact,
  SecSubmissions,
  TrailingPeriod,
} from "./types";

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A", "10-KT"]);
const QUARTERLY_FORMS = new Set(["10-Q", "10-Q/A"]);
const DAY = 86_400_000;

/** A restatement smaller than this is treated as rounding, not a change. */
const RESTATEMENT_TOLERANCE = 0.005;

const days = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / DAY;
const isAnnualDuration = (f: SecFact) => !!f.start && days(f.start, f.end) >= 350 && days(f.start, f.end) <= 380;
const near = (a: string, b: string, tolerance = 7) => Math.abs(Date.parse(a) - Date.parse(b)) <= tolerance * DAY;

interface Tagged extends SecFact { tag: string; unit: string }

/**
 * Picks the unit to read. Money prefers the reporting currency (USD when the
 * company reports it, otherwise the first currency it uses); share counts use "shares".
 */
function pickUnit(units: Record<string, SecFact[]>, item: LineItem, currency: string): string | null {
  const keys = Object.keys(units);
  if (item === "dilutedShares") return keys.includes("shares") ? "shares" : null;
  if (keys.includes(currency)) return currency;
  return null;
}

/** The reporting currency: USD if any money concept reports in USD, else the most common currency unit. */
function detectCurrency(ns: Record<string, { units: Record<string, SecFact[]> }>): string {
  const counts = new Map<string, number>();
  for (const item of LINE_ITEMS) {
    if (item === "dilutedShares") continue;
    for (const tag of [...CONCEPTS[item].usGaap, ...CONCEPTS[item].ifrs]) {
      for (const [unit, list] of Object.entries(ns[tag]?.units ?? {})) {
        if (/^[A-Z]{3}$/.test(unit)) counts.set(unit, (counts.get(unit) ?? 0) + list.length);
      }
    }
  }
  // IFRS filers such as TSMC tag a few USD convenience translations; the currency with the most facts is the real one.
  let best = "USD";
  let bestCount = -1;
  for (const [unit, count] of counts) {
    if (count > bestCount) {
      best = unit;
      bestCount = count;
    }
  }
  return best;
}

/** All facts for one line item, each tagged with the concept and unit it came from, in tag priority order. */
function factsFor(
  ns: Record<string, { units: Record<string, SecFact[]> }>,
  tags: string[],
  item: LineItem,
  currency: string,
): Tagged[][] {
  return tags.map((tag) => {
    const units = ns[tag]?.units;
    if (!units) return [];
    const unit = pickUnit(units, item, currency);
    return unit ? units[unit].map((f) => ({ ...f, tag, unit })) : [];
  });
}

/** Latest-filed value among duplicates for one period, with any earlier different value recorded as a restatement. */
function resolve(candidates: Tagged[]): FactValue | undefined {
  if (candidates.length === 0) return undefined;
  const byFiled = [...candidates].sort((a, b) => a.filed.localeCompare(b.filed));
  const latest = byFiled[byFiled.length - 1];
  const first = byFiled[0];
  const out: FactValue = {
    value: latest.val,
    tag: latest.tag,
    unit: latest.unit,
    accn: latest.accn,
    form: latest.form,
    filed: latest.filed,
  };
  const base = Math.max(Math.abs(first.val), 1);
  if (Math.abs(latest.val - first.val) / base > RESTATEMENT_TOLERANCE) {
    out.restated = { original: first.val, originalAccn: first.accn };
  }
  return out;
}

/** First tag in priority order that has a value matching `match`, so a tag switch mid-history is handled per period. */
function firstMatch(byTag: Tagged[][], match: (f: Tagged) => boolean): FactValue | undefined {
  for (const list of byTag) {
    const hit = resolve(list.filter(match));
    if (hit) return hit;
  }
  return undefined;
}

export function accnUrl(cik: number, accn: string, doc?: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accn.replace(/-/g, "")}/${doc ?? ""}`;
}

export function parseFilings(sub: SecSubmissions, cik: number): Filing[] {
  const r = sub.filings.recent;
  return r.form.map((form, i) => ({
    form,
    filed: r.filingDate[i],
    accn: r.accessionNumber[i],
    reportDate: r.reportDate?.[i] || undefined,
    items: (r.items?.[i] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    url: accnUrl(cik, r.accessionNumber[i], r.primaryDocument?.[i]),
  }));
}

export interface BuildOptions {
  ticker: string;
  source: FilingsSourceId;
  /** Fiscal years to keep, newest last. */
  years?: number;
}

/** Turns raw SEC company facts and submissions into clean annual and trailing periods. */
export function buildCompanyFilings(
  facts: SecCompanyFacts,
  sub: SecSubmissions,
  { ticker, source, years = 10 }: BuildOptions,
): CompanyFilings {
  const cik = Number(facts.cik);
  const taxonomy: CompanyFilings["taxonomy"] = facts.facts["us-gaap"] ? "us-gaap" : "ifrs-full";
  const ns = facts.facts[taxonomy] ?? {};
  const currency = detectCurrency(ns);

  const byItem = Object.fromEntries(LINE_ITEMS.map((item) => {
    const c = CONCEPTS[item];
    return [item, factsFor(ns, taxonomy === "us-gaap" ? c.usGaap : c.ifrs, item, currency)];
  })) as Record<LineItem, Tagged[][]>;

  // Fiscal years are defined by annual flow facts: revenue first, net income as a fallback (banks, holding companies).
  const yearEnds = new Map<string, string>(); // end -> start
  for (const item of ["revenue", "netIncome", "operatingCashFlow"] as LineItem[]) {
    for (const list of byItem[item]) {
      for (const f of list) {
        if (ANNUAL_FORMS.has(f.form) && isAnnualDuration(f) && !yearEnds.has(f.end)) yearEnds.set(f.end, f.start!);
      }
    }
  }
  // Collapse ends a few days apart (52/53-week years reported with slightly different dates).
  const ends = [...yearEnds.keys()].sort();
  const distinct: string[] = [];
  for (const end of ends) {
    if (distinct.length && near(distinct[distinct.length - 1], end)) distinct[distinct.length - 1] = end;
    else distinct.push(end);
  }

  const annual: AnnualPeriod[] = distinct.slice(-years).map((end) => {
    const start = yearEnds.get(end)!;
    const items: AnnualPeriod["items"] = {};
    for (const item of LINE_ITEMS) {
      const kind = CONCEPTS[item].kind;
      const value = firstMatch(byItem[item], (f) => ANNUAL_FORMS.has(f.form) && (
        kind === "flow" ? isAnnualDuration(f) && near(f.end, end) : !f.start && near(f.end, end)
      ));
      if (value) items[item] = value;
    }
    return { fiscalYear: Number(end.slice(0, 4)), start, end, items };
  });

  const trailing = buildTrailing(byItem, annual[annual.length - 1]);
  const sharesOutstanding = latestSharesOutstanding(facts);
  const filings = parseFilings(sub, cik);

  return {
    cik,
    ticker: ticker.toUpperCase(),
    name: sub.name || facts.entityName,
    sic: sub.sic ? Number(sub.sic) : null,
    sicDescription: sub.sicDescription,
    fiscalYearEnd: sub.fiscalYearEnd,
    taxonomy,
    currency,
    annual,
    trailing,
    sharesOutstanding,
    filings,
    asOf: filings.reduce((max, f) => (f.filed > max ? f.filed : max), ""),
    source,
  };
}

/**
 * Trailing twelve months for flow items: last fiscal year + current
 * year-to-date - the same year-to-date a year earlier. This works for cash
 * flow statements, which 10-Qs report only year to date. Balance-sheet items
 * take the latest reported balance.
 */
function buildTrailing(byItem: Record<LineItem, Tagged[][]>, lastYear: AnnualPeriod | undefined): TrailingPeriod | null {
  if (!lastYear) return null;

  // The newest year-to-date span after the last fiscal year end, from revenue or net income.
  let ytdEnd: string | null = null;
  for (const item of ["revenue", "netIncome"] as LineItem[]) {
    for (const list of byItem[item]) {
      for (const f of list) {
        if (QUARTERLY_FORMS.has(f.form) && f.start && near(f.start, addDays(lastYear.end, 1), 7) &&
            f.end > lastYear.end && (!ytdEnd || f.end > ytdEnd)) ytdEnd = f.end;
      }
    }
  }

  const items: TrailingPeriod["items"] = {};
  if (!ytdEnd) {
    Object.assign(items, lastYear.items);
    return { end: lastYear.end, basis: "annual", items };
  }

  const ytdStart = addDays(lastYear.end, 1);
  const priorStart = addDays(lastYear.start, 0);
  const priorEnd = addDays(ytdEnd, -364);
  for (const item of LINE_ITEMS) {
    const kind = CONCEPTS[item].kind;
    if (kind === "instant") {
      const latest = latestInstant(byItem[item]);
      if (latest) items[item] = latest;
      continue;
    }
    const fy = lastYear.items[item];
    if (!fy) continue;
    if (item === "dilutedShares") {
      // A share count is an average, not a sum: use the latest year-to-date average.
      const cur = firstMatch(byItem[item], (f) => !!f.start && near(f.start, ytdStart) && near(f.end, ytdEnd!));
      items[item] = cur ?? fy;
      continue;
    }
    // Year-to-date values must come from the same tag as the fiscal year so the three numbers are comparable.
    const sameTag = byItem[item].find((list) => list[0]?.tag === fy.tag) ?? [];
    const cur = resolve(sameTag.filter((f) => f.start && near(f.start, ytdStart) && near(f.end, ytdEnd!)));
    const prior = resolve(sameTag.filter((f) => f.start && near(f.start, priorStart) && near(f.end, priorEnd)));
    if (cur && prior) {
      items[item] = { ...cur, value: fy.value + cur.value - prior.value };
    }
  }
  return { end: ytdEnd, basis: "ytd", items };
}

function latestInstant(byTag: Tagged[][]): FactValue | undefined {
  let best: Tagged[] = [];
  let bestEnd = "";
  for (const list of byTag) {
    for (const f of list) {
      if (f.start || !(ANNUAL_FORMS.has(f.form) || QUARTERLY_FORMS.has(f.form))) continue;
      if (f.end > bestEnd) {
        bestEnd = f.end;
        best = [f];
      } else if (f.end === bestEnd && f.tag === best[0]?.tag) {
        best.push(f);
      }
    }
    // Tags are in priority order: stop at the first tag that has the newest date we have seen.
  }
  return resolve(best);
}

/** Latest cover-page share count, summed across share classes reported on the same date. */
function latestSharesOutstanding(facts: SecCompanyFacts): CompanyFilings["sharesOutstanding"] {
  const list = facts.facts.dei?.EntityCommonStockSharesOutstanding?.units?.shares ?? [];
  if (list.length === 0) return null;
  const latestEnd = list.reduce((m, f) => (f.end > m ? f.end : m), "");
  const onDate = list.filter((f) => f.end === latestEnd);
  const latestFiled = onDate.reduce((m, f) => (f.filed > m ? f.filed : m), "");
  const sameFiling = onDate.filter((f) => f.filed === latestFiled);
  // The same class can repeat within one filing; dedupe by value before summing classes.
  const value = [...new Set(sameFiling.map((f) => f.val))].reduce((s, v) => s + v, 0);
  return { value, asOf: latestEnd, accn: sameFiling[0].accn };
}

function addDays(date: string, n: number): string {
  return new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);
}
