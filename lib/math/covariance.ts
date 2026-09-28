import { PortfolioItem } from "@/types";
import {
  calculateLogReturns,
  calculateCovarianceMatrix,
} from "@/lib/monte-carlo";
import { classifyAsset, getAssetBeta } from "@/lib/math/portfolio-returns";
import { alignPriceHistories } from "@/lib/math/history";

/**
 * Annualized covariance matrix for a set of holdings.
 *
 * The allocator's whole job is trading return against portfolio variance, and
 * portfolio variance lives in the off-diagonal terms. Zeroing them — treating
 * every pair as independent — makes variance fall as 1/n for any n assets, so
 * sixteen S&P 500 trackers price out at 3.8% volatility instead of 15%. The
 * allocator then "diversifies" into funds that are the same bet.
 *
 * Two estimators, in preference order:
 *
 *  1. Sample covariance of aligned daily log returns, when every holding has
 *     enough overlapping history.
 *  2. A single-index (market model) matrix otherwise:
 *         cov(i, j) = β_i · β_j · σ²_market      for i ≠ j
 *         var(i)    = β_i² · σ²_market + idio_i
 *     Two funds tracking the same index both carry β ≈ 1, so the model puts
 *     their correlation near 1 without needing any price history at all.
 *
 * The two are never mixed: splicing sample rows into factor rows can produce a
 * matrix that is not positive semi-definite, and a negative modelled variance
 * would turn the risk penalty into a risk *reward*.
 */

export type CovarianceSource = "history" | "single-index";

export interface CovarianceEstimate {
  /** Annualized covariance, indexed to the input array. */
  matrix: number[][];
  source: CovarianceSource;
  /** Overlapping observations behind a `history` estimate. */
  samples: number;
}

/** Long-run annual volatility of the broad equity market. */
const MARKET_VOL = 0.15;

/**
 * Asset-specific variance the market factor does not explain. A single stock
 * carries far more of it than a broad fund, which is most of why a two-stock
 * portfolio is riskier than a two-fund portfolio at the same beta.
 */
const IDIOSYNCRATIC_VOL: Record<string, number> = {
  STOCK: 0.22,
  ETF: 0.06,
};

/** Minimum overlapping observations before a sample estimate is trustworthy. */
const MIN_SAMPLES = 40;

/** Variance floor, so a zero-variance asset cannot make the penalty vanish. */
const MIN_VARIANCE = 1e-6;

function singleIndexMatrix(portfolio: PortfolioItem[]): number[][] {
  const n = portfolio.length;
  const betas = portfolio.map(getAssetBeta);
  const marketVar = MARKET_VOL * MARKET_VOL;

  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const systematic = betas[i] * betas[j] * marketVar;
      if (i !== j) return systematic;

      // Cash is a genuine near-zero-variance asset; everything else carries
      // residual risk the single market factor does not account for.
      const assetClass = classifyAsset(portfolio[i]);
      const idioVol =
        assetClass === "cash"
          ? 0
          : (IDIOSYNCRATIC_VOL[portfolio[i].assetType ?? "ETF"] ??
            IDIOSYNCRATIC_VOL.ETF);

      return Math.max(MIN_VARIANCE, systematic + idioVol * idioVol);
    }),
  );
}

/**
 * Aligns every holding's close series on the latest common start date and
 * truncates to the shortest, so covariance is computed over the same calendar
 * days for every asset. Returns null when the overlap is too short.
 */
function alignedReturns(
  portfolio: PortfolioItem[],
): { returns: number[][]; samplesPerYear: number; samples: number } | null {
  const aligned = alignPriceHistories(portfolio);
  if (!aligned || aligned.prices[0].length < MIN_SAMPLES + 1) return null;

  const dates = aligned.dates.map((date) => new Date(date).getTime());
  const spanYears =
    (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24 * 365.25);
  if (!(spanYears > 0.25)) return null;

  const returns = aligned.prices.map((prices) => calculateLogReturns(prices));

  // calculateLogReturns skips non-positive prices, so series can come back at
  // different lengths; covariance needs them rectangular.
  const usable = Math.min(...returns.map((r) => r.length));
  if (usable < MIN_SAMPLES) return null;

  return {
    returns: returns.map((r) => r.slice(r.length - usable)),
    samplesPerYear: usable / spanYears,
    samples: usable,
  };
}

export function estimateAnnualCovariance(
  portfolio: PortfolioItem[],
): CovarianceEstimate {
  if (portfolio.length === 0) {
    return { matrix: [], source: "single-index", samples: 0 };
  }

  const aligned = alignedReturns(portfolio);
  if (!aligned) {
    return {
      matrix: singleIndexMatrix(portfolio),
      source: "single-index",
      samples: 0,
    };
  }

  const perStep = calculateCovarianceMatrix(aligned.returns);
  const matrix = perStep.map((row, i) =>
    row.map((value, j) => {
      const annual = value * aligned.samplesPerYear;
      return i === j ? Math.max(MIN_VARIANCE, annual) : annual;
    }),
  );

  return { matrix, source: "history", samples: aligned.samples };
}
