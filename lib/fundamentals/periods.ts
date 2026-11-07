import { CONCEPTS, LINE_ITEMS, SHARE_COUNT_TAG } from "./concepts";
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
  Staleness,
  TrailingPeriod,
} from "./types";
import { DAY_MS, daysBetween, shiftIsoDate } from "@/lib/dates";

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "10-K405", "20-F", "20-F/A", "40-F", "40-F/A", "10-KT"]);
const QUARTERLY_FORMS = new Set(["10-Q", "10-Q/A"]);
/** Filings the app links to. 8-Ks are kept only when they report an auditor change or non-reliance (items 4.01, 4.02). */
const KEPT_FORMS = new Set(["10-K", "10-K405", "10-Q", "20-F", "40-F", "NT 10-K", "NT 10-Q"]);

/** A restatement smaller than this is treated as rounding, not a change. */
const RESTATEMENT_TOLERANCE = 0.005;

const isAnnualDuration = (f: SecFact) => !!f.start && daysBetween(f.start, f.end) >= 350 && daysBetween(f.start, f.end) <= 380;
const near = (a: string, b: string, tolerance = 7) => Math.abs(Date.parse(a) - Date.parse(b)) <= tolerance * DAY_MS;

interface Tagged extends SecFact { tag: string; unit: string }

/** Items counted in shares, not money. */
const SHARE_ITEMS = new Set<LineItem>(["dilutedShares", "optionsOutstanding", "rsusUnvested"]);

/**
 * Picks the unit to read. Money prefers the reporting currency (USD when the
 * company reports it, otherwise the first currency it uses); share counts use "shares".
 */
function pickUnit(units: Record<string, SecFact[]>, item: LineItem, currency: string): string | null {
  const keys = Object.keys(units);
  if (SHARE_ITEMS.has(item)) return keys.includes("shares") ? "shares" : null;
  if (item === "optionsExercisePrice") return keys.includes("USD/shares") ? "USD/shares" : null;
  if (keys.includes(currency)) return currency;
  return null;
}

/** The reporting currency: USD if any money concept reports in USD, else the most common currency unit. */
function detectCurrency(ns: Record<string, { units: Record<string, SecFact[]> }>): string {
  const counts = new Map<string, number>();
  for (const item of LINE_ITEMS) {
    if (SHARE_ITEMS.has(item)) continue;
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

/**
 * One list per sum group: for each filing and period where every tag in the group reports a value, the values
 * are added. The list is tagged with the group's tags joined by " + ", so the trailing logic can match it by tag.
 */
function sumListsFor(ns: Record<string, { units: Record<string, SecFact[]> }>, groups: string[][], item: LineItem, currency: string): Tagged[][] {
  return groups.map((group) => {
    const parts = group.map((tag) => factsFor(ns, [tag], item, currency)[0]);
    if (parts.some((list) => list.length === 0)) return [];
    const key = (f: SecFact) => `${f.start ?? ""}|${f.end}|${f.accn}|${f.form}|${f.filed}`;
    const [head, ...rest] = parts;
    const sums: Tagged[] = [];
    for (const f of head) {
      const matches = rest.map((list) => list.find((g) => key(g) === key(f)));
      if (matches.some((m) => m === undefined)) continue;
      const total = matches.reduce((sum, m) => sum + m!.val, f.val);
      sums.push({ ...f, val: total, tag: group.join(" + ") });
    }
    return sums;
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

/**
 * First tag in priority order that has a value matching `match`, so a tag switch mid-history is handled per period.
 * With pick "largest", every tag is read and the largest value wins (for tags that cover different scope).
 */
function firstMatch(byTag: Tagged[][], match: (f: Tagged) => boolean, pick: "first" | "largest" = "first"): FactValue | undefined {
  if (pick === "largest") {
    let best: FactValue | undefined;
    for (const list of byTag) {
      const hit = resolve(list.filter(match));
      if (hit && (!best || hit.value > best.value)) best = hit;
    }
    return best;
  }
  for (const list of byTag) {
    const hit = resolve(list.filter(match));
    if (hit) return hit;
  }
  return undefined;
}

export function accnUrl(cik: number, accn: string, doc?: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accn.replace(/-/g, "")}/${doc ?? ""}`;
}

/** Keeps the filings the app reads or links to; see KEPT_FORMS. */
export function parseFilings(sub: SecSubmissions, cik: number): Filing[] {
  const r = sub.filings.recent;
  const out: Filing[] = [];
  r.form.forEach((form, i) => {
    const items = (r.items?.[i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    // 8-K/A amendments count too: flags.ts reads any "8-K*" form, and restatement notices are often amended.
    const keep = KEPT_FORMS.has(form) || (form.startsWith("8-K") && items.some((n) => n === "4.01" || n === "4.02"));
    if (!keep) return;
    out.push({
      form,
      filed: r.filingDate[i],
      accn: r.accessionNumber[i],
      reportDate: r.reportDate?.[i] || undefined,
      items,
      url: accnUrl(cik, r.accessionNumber[i], r.primaryDocument?.[i]),
    });
  });
  return out;
}

export interface BuildOptions {
  ticker: string;
  source: FilingsSourceId;
  /** Fiscal years to keep, newest last. */
  years?: number;
}

/** Whole months from `from` to `to` (both YYYY-MM-DD). */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const months = (ty - fy) * 12 + (tm - fm);
  return td < fd ? months - 1 : months;
}

/** Ages of the annual and trailing ends, measured to the newest filing read. */
function stalenessOf(annualEnd: string | undefined, trailingEnd: string | undefined, asOf: string): Staleness {
  const annualMonths = annualEnd && asOf ? monthsBetween(annualEnd, asOf) : null;
  const trailingMonths = trailingEnd && asOf ? monthsBetween(trailingEnd, asOf) : null;
  return {
    annualMonths,
    annualStale: annualMonths !== null && annualMonths > 15,
    trailingMonths,
    trailingStale: trailingMonths !== null && trailingMonths > 6,
  };
}

/** One taxonomy's facts, read into tag-priority lists per line item. */
interface TaxonomyData {
  taxonomy: "us-gaap" | "ifrs-full";
  currency: string;
  byItem: Record<LineItem, Tagged[][]>;
  /** Amortization of intangibles, used to catch a depreciation-only figure filed under the combined D&A tag. */
  amortIntangibles: Tagged[];
  /** Annual period ends, each with its start and the fiscal-year label of the earliest filing that reported it. */
  ends: Map<string, { start: string; fy: number | undefined; filed: string }>;
}

function readTaxonomy(facts: SecCompanyFacts, taxonomy: TaxonomyData["taxonomy"]): TaxonomyData {
  const ns = facts.facts?.[taxonomy] ?? {};
  const currency = detectCurrency(ns);
  const byItem = Object.fromEntries(LINE_ITEMS.map((item) => {
    const c = CONCEPTS[item];
    const lists = factsFor(ns, taxonomy === "us-gaap" ? c.usGaap : c.ifrs, item, currency);
    // Sum groups come last, so they only supply a period that no single tag reports.
    if (taxonomy === "us-gaap" && c.sums) lists.push(...sumListsFor(ns, c.sums, item, currency));
    return [item, lists];
  })) as Record<LineItem, Tagged[][]>;
  // Fiscal years are defined by annual flow facts: revenue first, net income as a fallback (banks, holding companies).
  const ends: TaxonomyData["ends"] = new Map();
  for (const item of ["revenue", "netIncome", "operatingCashFlow"] as LineItem[]) {
    for (const list of byItem[item]) {
      for (const f of list) {
        if (!ANNUAL_FORMS.has(f.form) || !isAnnualDuration(f)) continue;
        // The SEC "fy" field is set per filing: a later 10-K repeats old years with its own fy. The filing that first
        // reported a period carries that period's own fiscal year, so its label is the one kept.
        const seen = ends.get(f.end);
        if (!seen || f.filed < seen.filed) ends.set(f.end, { start: f.start!, fy: f.fy, filed: f.filed });
      }
    }
  }
  const amortIntangibles = taxonomy === "us-gaap" ? factsFor(ns, ["AmortizationOfIntangibleAssets"], "depreciationAmortization", currency)[0] ?? [] : [];
  return { taxonomy, currency, byItem, amortIntangibles, ends };
}

/** Turns raw SEC company facts and submissions into clean annual and trailing periods. */
export function buildCompanyFilings(
  facts: SecCompanyFacts,
  sub: SecSubmissions,
  { ticker, source, years = 10 }: BuildOptions,
): CompanyFilings {
  const cik = Number(facts.cik);
  const present = (["us-gaap", "ifrs-full"] as const).filter((t) => facts.facts?.[t]);
  const data = (present.length ? present : ["ifrs-full" as const]).map((t) => readTaxonomy(facts, t));
  // A filer that moved taxonomies (GAAP to IFRS) is read per year: the taxonomy with the newest annual period leads,
  // and each fiscal year comes from the leading taxonomy that reported it, falling back to the older one.
  const latestEnd = (d: TaxonomyData) => [...d.ends.keys()].reduce((m, e) => (e > m ? e : m), "");
  const ranked = [...data].sort((a, b) => latestEnd(b).localeCompare(latestEnd(a)));
  const lead = ranked[0];

  // Collapse ends a few days apart (52/53-week years reported with slightly different dates): the later end wins.
  const merged: { end: string; start: string; fy: number | undefined; tax: TaxonomyData }[] = [];
  for (const tax of ranked) {
    for (const end of [...tax.ends.keys()].sort().reverse()) {
      if (merged.some((m) => near(m.end, end))) continue;
      merged.push({ end, ...tax.ends.get(end)!, tax });
    }
  }
  merged.sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0));

  let lastLabel = -Infinity;
  const annual: AnnualPeriod[] = merged.slice(-years).map((p) => {
    // The SEC fy is used only when it is the period's own year or the year before (a 52/53-week year can end in early
    // January). A filing that first reported an old period as a comparative carries a later fy, so any other fy falls
    // back to the year that holds most of the period: the end date less a week.
    const endYear = Number(p.end.slice(0, 4));
    const ownYear = p.fy === endYear || p.fy === endYear - 1;
    let fiscalYear = ownYear ? p.fy! : Number(shiftIsoDate(p.end, -7).slice(0, 4));
    // Never repeat a label; a clash can only come from unusual data, so the later period moves up by one.
    if (fiscalYear <= lastLabel) fiscalYear = lastLabel + 1;
    lastLabel = fiscalYear;
    const items: AnnualPeriod["items"] = {};
    for (const item of LINE_ITEMS) {
      const kind = CONCEPTS[item].kind;
      const matches = (f: Tagged) => ANNUAL_FORMS.has(f.form) && (
        kind === "flow" ? isAnnualDuration(f) && near(f.end, p.end) : !f.start && near(f.end, p.end)
      );
      // A summed pair of tags only fills a period that no single tag reports: a filed total beats a sum of two rounded parts.
      // Tiers: reported totals, then sums, then the bare "Depreciation" tag, which leaves amortization out.
      const isSum = (list: Tagged[]) => Boolean(list[0]?.tag.includes(" + "));
      const isBare = (list: Tagged[]) => list[0]?.tag === "Depreciation" && Boolean(CONCEPTS[item].sums);
      const lists = p.tax.byItem[item];
      const pick = CONCEPTS[item].pick;
      const value = firstMatch(lists.filter((l) => !isSum(l) && !isBare(l)), matches, pick)
        ?? firstMatch(lists.filter(isSum), matches, pick)
        ?? firstMatch(lists.filter(isBare), matches, pick);
      if (value) items[item] = value;
    }
    // A combined D&A total cannot be smaller than the amortization inside it. When it is (Cisco files only
    // depreciation under this tag), the figure is depreciation alone and the intangible amortization is added.
    const da = items.depreciationAmortization;
    if (da && !da.tag.includes("+")) {
      const amort = firstMatch([p.tax.amortIntangibles], (f) => ANNUAL_FORMS.has(f.form) && isAnnualDuration(f) && near(f.end, p.end));
      if (amort && da.value < amort.value) {
        items.depreciationAmortization = { ...da, value: da.value + amort.value, tag: `${da.tag} + AmortizationOfIntangibleAssets` };
      }
    }
    return { fiscalYear, start: p.start, end: p.end, items };
  });

  const trailing = buildTrailing(lead.byItem, annual[annual.length - 1]);
  const newestEnd = [annual[annual.length - 1]?.end, trailing?.end].filter((d): d is string => Boolean(d)).sort().pop();
  const sharesOutstanding = latestSharesOutstanding(facts, newestEnd ? shiftIsoDate(newestEnd, -STALE_COUNT_DAYS) : undefined);
  const filings = parseFilings(sub, cik);
  const asOf = sub.filings.recent.filingDate.reduce((max, d) => (d > max ? d : max), "");

  return {
    cik,
    ticker: ticker.toUpperCase(),
    name: sub.name || facts.entityName,
    sic: sub.sic ? Number(sub.sic) : null,
    sicDescription: sub.sicDescription,
    fiscalYearEnd: sub.fiscalYearEnd,
    taxonomy: lead.taxonomy,
    currency: lead.currency,
    annual,
    trailing,
    sharesOutstanding,
    filings,
    asOf,
    staleness: stalenessOf(annual[annual.length - 1]?.end, trailing?.end, asOf),
    source,
  };
}

/**
 * Trailing twelve months for flow items: last fiscal year + current
 * year-to-date - the same year-to-date a year earlier. This works for cash
 * flow statements, which 10-Qs report only year to date.
 *
 * Balance-sheet items all come from one date, the newest balance sheet found
 * (see latestBalanceDate). An item missing on that date stays missing.
 */
function buildTrailing(byItem: Record<LineItem, Tagged[][]>, lastYear: AnnualPeriod | undefined): TrailingPeriod | null {
  if (!lastYear) return null;

  // The newest year-to-date span after the last fiscal year end, from revenue or net income.
  let ytdEnd: string | null = null;
  for (const item of ["revenue", "netIncome"] as LineItem[]) {
    for (const list of byItem[item]) {
      for (const f of list) {
        if (QUARTERLY_FORMS.has(f.form) && f.start && near(f.start, shiftIsoDate(lastYear.end, 1), 7) &&
            f.end > lastYear.end && (!ytdEnd || f.end > ytdEnd)) ytdEnd = f.end;
      }
    }
  }

  const items: TrailingPeriod["items"] = {};
  if (!ytdEnd) {
    Object.assign(items, lastYear.items);
    return { end: lastYear.end, basis: "annual", balanceSheetDate: lastYear.end, missingOnBalanceDate: [], items };
  }

  const balanceSheetDate = latestBalanceDate(byItem);
  const ytdStart = shiftIsoDate(lastYear.end, 1);
  const priorStart = shiftIsoDate(lastYear.start, 0);
  const priorEnd = shiftIsoDate(ytdEnd, -364);
  const missingOnBalanceDate: LineItem[] = [];
  for (const item of LINE_ITEMS) {
    const kind = CONCEPTS[item].kind;
    if (kind === "instant") {
      if (!balanceSheetDate) continue;
      const v = firstMatch(byItem[item], (f) => !f.start && (ANNUAL_FORMS.has(f.form) || QUARTERLY_FORMS.has(f.form)) &&
        near(f.end, balanceSheetDate));
      if (v) items[item] = v;
      else if (byItem[item].some((list) => list.length > 0)) missingOnBalanceDate.push(item);
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
  return { end: ytdEnd, basis: "ytd", balanceSheetDate, missingOnBalanceDate, items };
}

/** The one balance-sheet date for the trailing figures: the newest instant that has total assets or cash. */
function latestBalanceDate(byItem: Record<LineItem, Tagged[][]>): string | null {
  let best: string | null = null;
  for (const item of ["assets", "cash"] as LineItem[]) {
    for (const list of byItem[item]) {
      for (const f of list) {
        if (f.start || !(ANNUAL_FORMS.has(f.form) || QUARTERLY_FORMS.has(f.form))) continue;
        if (!best || f.end > best) best = f.end;
      }
    }
  }
  return best;
}

const STALE_COUNT_DAYS = 400;

/**
 * Latest cover-page share count, summed over the share classes reported on the latest date.
 * companyfacts drops the share-class dimension, so classes cannot be told apart by name: each
 * row on the latest filing is one class, and the count is kept so consumers can flag it.
 * Falls back to the balance-sheet count (CommonStockSharesOutstanding) when the cover page has no dei total.
 */
function latestSharesOutstanding(facts: SecCompanyFacts, notBefore?: string): CompanyFilings["sharesOutstanding"] {
  // A count older than the latest fiscal year is not a current count: some filers stopped tagging the
  // cover page by class years ago (Visa, Mastercard, Berkshire), leaving one class from long ago.
  const fresh = (c: CompanyFilings["sharesOutstanding"]) => (c && (!notBefore || c.asOf >= notBefore) ? c : null);
  return fresh(latestCount(facts.facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares ?? []))
    ?? fresh(latestCount(facts.facts?.["us-gaap"]?.[SHARE_COUNT_TAG]?.units?.shares ?? []));
}

/** Sums the rows of the newest filing on the newest date. Earlier filings repeat old rows, so they are never added in. */
function latestCount(all: SecFact[]): CompanyFilings["sharesOutstanding"] {
  // A cover row of zero (a class not yet issued, or a placeholder) is not a count: dropped, so it can neither be the
  // whole answer nor hide the older real count behind a stale-looking zero.
  const list = all.filter((f) => f.val > 0);
  if (list.length === 0) return null;
  const latestEnd = list.reduce((m, f) => (f.end > m ? f.end : m), "");
  const onDate = list.filter((f) => f.end === latestEnd);
  const latestFiled = onDate.reduce((m, f) => (f.filed > m ? f.filed : m), "");
  const sameFiling = onDate.filter((f) => f.filed === latestFiled);
  const value = sameFiling.reduce((s, f) => s + f.val, 0);
  return { value, asOf: latestEnd, accn: sameFiling[0].accn, classes: sameFiling.length };
}

