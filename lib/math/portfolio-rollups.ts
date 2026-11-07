import { getSourcedExpenseRatio } from "@/lib/provenance";
import { formatSectorName } from "@/lib/utils";
import type { Portfolio } from "@/types";

/** Position weights (percent) above which a holding is flagged as concentrated. */
export const CONCENTRATION_BANDS = { watch: 5, elevated: 10, severe: 20 } as const;

const totalWeightOf = (portfolio: Portfolio) => portfolio.reduce((sum, item) => sum + (item.weight || 0), 0);

/**
 * Provider data mixes fractions and percents. When any value in the set is above 1
 * the whole set is read as percent; a set of values at or below 1 is already a fraction.
 */
export function normalizePercent(values: number[]): number[] {
  return values.some((v) => v > 1) ? values.map((v) => v / 100) : values;
}

/** Weight-averaged MER; null unless every holding has a sourced one. */
export function weightedExpenseRatio(portfolio: Portfolio): number | null {
  const total = totalWeightOf(portfolio);
  if (!(total > 0) || !portfolio.every((item) => getSourcedExpenseRatio(item.metrics) != null)) return null;
  return portfolio.reduce((acc, item) => acc + (getSourcedExpenseRatio(item.metrics) ?? 0) * (item.weight / total), 0);
}

/** Weight-averaged beta; null unless every holding has one. */
export function weightedBeta(portfolio: Portfolio): number | null {
  const total = totalWeightOf(portfolio);
  if (!(total > 0) || !portfolio.every((item) => item.beta != null && Number.isFinite(item.beta))) return null;
  return portfolio.reduce((acc, item) => acc + (item.beta ?? 0) * (item.weight / total), 0);
}

/** Equity, bond and cash shares of the whole portfolio, as fractions. */
export function assetAllocation(portfolio: Portfolio) {
  const total = totalWeightOf(portfolio);
  const sums = { equities: 0, bonds: 0, cash: 0 };
  for (const item of portfolio) {
    const w = total > 0 ? item.weight / total : 0;
    const [e, b, c] = normalizePercent([
      item.allocation?.equities || 0,
      item.allocation?.bonds || 0,
      item.allocation?.cash || 0,
    ]);
    sums.equities += e * w;
    sums.bonds += b * w;
    sums.cash += c * w;
  }
  return sums;
}

/** Sector shares of the whole portfolio as fractions; a holding with no sector data counts as "Unknown". */
export function sectorBreakdown(portfolio: Portfolio): Record<string, number> {
  const total = totalWeightOf(portfolio);
  const out: Record<string, number> = {};
  for (const item of portfolio) {
    const w = total > 0 ? item.weight / total : 0;
    const entries = Object.entries(item.sectors || {});
    if (entries.length === 0) {
      out.Unknown = (out.Unknown || 0) + w;
      continue;
    }
    for (const [slug, raw] of entries) {
      const name = formatSectorName(slug);
      out[name] = (out[name] || 0) + normalizePercent([Number(raw) || 0])[0] * w;
    }
  }
  return out;
}

/**
 * Percent weight each holding carries in sector math: its target weight when any are set,
 * otherwise its share of market value. `usdCad` converts USD positions in a mixed portfolio.
 */
export function sectorWeights(portfolio: Portfolio, usdCad?: number): Map<string, number> {
  const weights = new Map<string, number>();
  if (totalWeightOf(portfolio) > 0) {
    for (const item of portfolio) weights.set(item.ticker, item.weight || 0);
    return weights;
  }
  const values = portfolio.map((item) => {
    const value = item.shares > 0 && item.price > 0 ? item.shares * item.price : 0;
    return usdCad && item.currency === "USD" ? value * usdCad : value;
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  portfolio.forEach((item, i) => weights.set(item.ticker, total > 0 ? (values[i] / total) * 100 : 0));
  return weights;
}

/** Sector exposure in percent points, each holding's sector mix scaled by its weight. */
export function sectorAllocation(portfolio: Portfolio, weights: Map<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of portfolio) {
    for (const [slug, amount] of Object.entries(item.sectors ?? {})) {
      const name = formatSectorName(slug);
      out[name] = (out[name] || 0) + amount * ((weights.get(item.ticker) ?? 0) / 100);
    }
  }
  return out;
}

interface LookThroughRow {
  name: string;
  fullName: string;
  totalWeight: number;
  isCash: boolean;
  assetType: string;
  /** Percent contributed by each source fund (or "Direct"), keyed by source name. */
  [source: string]: string | number | boolean;
}

/**
 * Every underlying holding with the percent of the portfolio it adds up to across funds,
 * plus the unallocated remainder as cash. Largest first, capped at `maxRows`.
 */
export function lookThroughExposure(portfolio: Portfolio, maxRows = 25) {
  const byHolding: Record<string, {
    totalWeight: number;
    name: string;
    isCash: boolean;
    assetType: string;
    sources: Record<string, number>;
  }> = {};
  const sources = new Set<string>();

  const add = (key: string, name: string, assetType: string, isCash: boolean, source: string, weight: number) => {
    const row = (byHolding[key] ??= { totalWeight: 0, name, isCash, assetType, sources: {} });
    row.totalWeight += weight;
    row.sources[source] = (row.sources[source] || 0) + weight;
  };

  for (const item of portfolio) {
    // A 0% holding adds nothing but an empty legend entry.
    if (!(item.weight > 0)) continue;

    if (item.holdings && item.holdings.length > 0) {
      sources.add(item.ticker);
      let holdingsSumPercent = 0;
      for (const h of item.holdings) {
        add(h.ticker, h.name, "STOCK", false, item.ticker, (item.weight * h.weight) / 100);
        holdingsSumPercent += h.weight;
      }
      const residue = Math.max(0, 100 - holdingsSumPercent);
      if (residue > 1) add("Other", "Other Assets", "STOCK", false, item.ticker, (item.weight * residue) / 100);
    } else {
      sources.add("Direct");
      add(item.ticker, item.name, item.assetType || "STOCK", false, "Direct", item.weight);
    }
  }

  const cashBuffer = Math.max(0, 100 - portfolio.reduce((sum, item) => sum + item.weight, 0));
  if (cashBuffer > 0.01) {
    sources.add("Direct");
    add("Cash", "Cash Buffer", "Cash", true, "Direct", cashBuffer);
  }

  const rows = Object.entries(byHolding)
    .map(([ticker, d]): LookThroughRow => ({
      name: ticker,
      fullName: d.name,
      totalWeight: d.totalWeight,
      isCash: d.isCash,
      assetType: d.assetType,
      ...d.sources,
    }))
    .sort((a, b) => b.totalWeight - a.totalWeight)
    .slice(0, maxRows);

  const sourceList = [...sources].sort((a, b) => (a === "Direct" ? -1 : b === "Direct" ? 1 : a.localeCompare(b)));
  return { rows, sources: sourceList };
}
