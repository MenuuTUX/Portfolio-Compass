import { olsSlope } from "@/lib/math/stats";
import { selectReturnBasis, validAdjusted, type ReturnBasis } from "@/lib/math/history";
import { isoDay } from "@/lib/dates";

/**
 * Market proxy for beta. Yahoo's fund `beta3Year` is measured against each
 * fund's category benchmark (BND reads 0.98 against a bond index, with R² near
 * 100), so it is not a market beta and cannot feed a return proxy that prices
 * beta in equity-risk units. Every asset is measured against the same index.
 */
export const MARKET_PROXY = "SPY";

/** About six months of trading days; fewer gives a beta too noisy to use. */
export const MIN_BETA_OBSERVATIONS = 120;

export interface BetaEstimate {
  beta: number;
  observations: number;
  basis: ReturnBasis;
  source: string;
}

type HistoryLike = { date: string; price: number; adjPrice?: number };

function byUtcDay(points: readonly HistoryLike[]): Map<string, HistoryLike> {
  const out = new Map<string, HistoryLike>();
  for (const point of points) {
    const time = new Date(point.date).getTime();
    const price = Number(point.price);
    if (!Number.isFinite(time) || !Number.isFinite(price) || price <= 0) continue;
    out.set(isoDay(time), point);
  }
  return out;
}

/**
 * OLS beta of an asset's daily returns on the market proxy's daily returns,
 * over the dates both series share. Uses dividend-adjusted closes when both
 * series carry them, else split-adjusted closes. Returns null when the overlap
 * is too short or the market series has no variance.
 */
export function estimateMarketBeta(
  asset: readonly HistoryLike[],
  market: readonly HistoryLike[],
): BetaEstimate | null {
  const basis = selectReturnBasis([asset, market]);
  const value = (point: HistoryLike) =>
    basis === "total" ? validAdjusted(point) : Number(point.price);

  const assetByDay = byUtcDay(asset);
  const marketByDay = byUtcDay(market);
  const days = [...assetByDay.keys()]
    .filter((day) => {
      const m = marketByDay.get(day);
      return m !== undefined && value(assetByDay.get(day)!) !== null && value(m) !== null;
    })
    .sort();

  const assetReturns: number[] = [];
  const marketReturns: number[] = [];
  for (let i = 1; i < days.length; i++) {
    const a0 = value(assetByDay.get(days[i - 1])!)!;
    const a1 = value(assetByDay.get(days[i])!)!;
    const m0 = value(marketByDay.get(days[i - 1])!)!;
    const m1 = value(marketByDay.get(days[i])!)!;
    assetReturns.push(a1 / a0 - 1);
    marketReturns.push(m1 / m0 - 1);
  }

  const n = assetReturns.length;
  if (n < MIN_BETA_OBSERVATIONS) return null;

  const fit = olsSlope(marketReturns, assetReturns);
  if (!fit) return null;
  const beta = fit.slope;
  if (!Number.isFinite(beta)) return null;

  return {
    beta: Math.round(beta * 100) / 100,
    observations: n,
    basis,
    source: `Estimated vs ${MARKET_PROXY} from ${n} daily ${basis === "total" ? "total" : "price"} returns`,
  };
}
