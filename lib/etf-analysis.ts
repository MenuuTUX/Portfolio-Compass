import { ETF } from "@/types";
import { realizedAnnualVolatility } from "@/lib/asset-class";

type Status = "good" | "neutral" | "warning";

export interface VerdictEntry {
  status: Status;
  label: string;
  description: string;
}

export interface EtfVerdict {
  cost?: VerdictEntry;
  liquidity: VerdictEntry;
  volatility: VerdictEntry;
}

export interface AnalyzeEtfOptions {
  /** Price history used to estimate realized vol when beta is missing */
  history?: { price: number }[];
}

function volatilityFromBeta(beta: number): VerdictEntry {
  if (beta > 1.25) {
    return {
      status: "warning",
      label: "High Volatility",
      description: `This asset is ${((beta - 1) * 100).toFixed(0)}% more volatile than the market (beta ${beta.toFixed(2)}).`,
    };
  }
  if (beta < 0.85) {
    return {
      status: "good",
      label: "Low Volatility",
      description: `Generally more stable than the market (beta ${beta.toFixed(2)}).`,
    };
  }
  return {
    status: "neutral",
    label: "Market Risk",
    description:
      beta > 1
        ? `Slightly more volatile than the market (beta ${beta.toFixed(2)}).`
        : `Moves roughly in line with the market (beta ${beta.toFixed(2)}).`,
  };
}

/** Annualized realized vol thresholds (fraction). */
function volatilityFromRealized(annVol: number): VerdictEntry {
  const pct = (annVol * 100).toFixed(0);
  if (annVol > 0.35) {
    return {
      status: "warning",
      label: "High Volatility",
      description: `Realized annualized volatility ≈ ${pct}% (from price history).`,
    };
  }
  if (annVol < 0.1) {
    return {
      status: "good",
      label: "Low Volatility",
      description: `Realized annualized volatility ≈ ${pct}% (from price history).`,
    };
  }
  return {
    status: "neutral",
    label: "Moderate Volatility",
    description: `Realized annualized volatility ≈ ${pct}% (from price history).`,
  };
}

// Missing data must read as "unknown", never as a judgement.
export function analyzeEtf(
  etf: ETF,
  options: AnalyzeEtfOptions = {},
): EtfVerdict {
  const verdict = {} as EtfVerdict;

  // 1. Cost — funds only
  if (etf.assetType !== "STOCK") {
    const mer = etf.metrics?.mer;
    if (!mer || mer <= 0) {
      verdict.cost = {
        status: "neutral",
        label: "Fee Unknown",
        description: "No expense ratio / MER available from market data yet.",
      };
    } else {
      // Canadian leveraged/commodity funds often run 1%+ MER — thresholds
      // stay the same so high-fee products still flag clearly.
      const description = `Annual fee of ${mer.toFixed(2)}% (MER / expense ratio).`;
      if (mer > 0.75) {
        verdict.cost = { status: "warning", label: "High Fee", description };
      } else if (mer > 0.4) {
        verdict.cost = {
          status: "neutral",
          label: "Moderate Fee",
          description,
        };
      } else {
        verdict.cost = { status: "good", label: "Low Cost", description };
      }
    }
  }

  // 2. Liquidity
  const volume = etf.volume;
  if (!volume) {
    verdict.liquidity = {
      status: "neutral",
      label: "Liquidity Unknown",
      description: "No trading volume data available for this asset yet.",
    };
  } else if (volume > 1_000_000) {
    verdict.liquidity = {
      status: "good",
      label: "Highly Liquid",
      description: "High volume ensures easy entry and exit.",
    };
  } else if (volume > 100_000) {
    verdict.liquidity = {
      status: "neutral",
      label: "Moderate Liquidity",
      description: "Moderate volume; very large orders may move the price.",
    };
  } else {
    verdict.liquidity = {
      status: "warning",
      label: "Low Liquidity",
      description: "Low trading volume may lead to wider spreads (extra cost).",
    };
  }

  // 3. Volatility — beta first, then realized vol from history
  const beta = etf.beta;
  if (beta !== undefined && beta !== null && beta !== 0) {
    verdict.volatility = volatilityFromBeta(beta);
  } else {
    const history = options.history?.length
      ? options.history
      : etf.history;
    const annVol = history?.length
      ? realizedAnnualVolatility(history)
      : undefined;
    if (annVol !== undefined) {
      verdict.volatility = volatilityFromRealized(annVol);
    } else {
      verdict.volatility = {
        status: "neutral",
        label: "Volatility Unknown",
        description:
          "No beta or enough price history to estimate volatility yet.",
      };
    }
  }

  return verdict;
}
