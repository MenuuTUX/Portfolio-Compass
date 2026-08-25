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
      label: "Beta Above 1.25",
      description: `Beta ${beta.toFixed(2)} indicates greater historical sensitivity to the selected market benchmark.`,
    };
  }
  if (beta < 0.85) {
    return {
      status: "good",
      label: "Beta Below 0.85",
      description: `Beta ${beta.toFixed(2)} indicates lower historical sensitivity to the selected market benchmark.`,
    };
  }
  return {
    status: "neutral",
    label: "Beta Near 1",
    description:
      beta > 1
        ? `Beta ${beta.toFixed(2)} indicates slightly greater historical sensitivity to the benchmark.`
        : `Beta ${beta.toFixed(2)} indicates historical sensitivity near the benchmark.`,
  };
}

/** Annualized realized vol thresholds (fraction). */
function volatilityFromRealized(annVol: number): VerdictEntry {
  const pct = (annVol * 100).toFixed(0);
  if (annVol > 0.35) {
    return {
      status: "warning",
      label: "Volatility Above 35%",
      description: `Annualized realized volatility is about ${pct}% for the available price history.`,
    };
  }
  if (annVol < 0.1) {
    return {
      status: "good",
      label: "Volatility Below 10%",
      description: `Annualized realized volatility is about ${pct}% for the available price history.`,
    };
  }
  return {
    status: "neutral",
    label: "Volatility from 10% to 35%",
    description: `Annualized realized volatility is about ${pct}% for the available price history.`,
  };
}

// Missing data must read as "unknown", never as a judgement.
export function analyzeEtf(
  etf: ETF,
  options: AnalyzeEtfOptions = {},
): EtfVerdict {
  const verdict: EtfVerdict = {
    liquidity: {
      status: "neutral",
      label: "Volume Data Unavailable",
      description: "The market data response did not include trading volume.",
    },
    volatility: {
      status: "neutral",
      label: "Volatility Data Unavailable",
      description:
        "The available data does not include beta or enough price history for this estimate.",
    },
  };

  // Cost applies to funds only.
  if (etf.assetType !== "STOCK") {
    const mer = etf.metrics?.mer;
    if (!mer || mer <= 0) {
      verdict.cost = {
        status: "neutral",
        label: "Fee Data Unavailable",
        description: "The market data response did not include an expense ratio or MER.",
      };
    } else {
      const description = `Annual fee of ${mer.toFixed(2)}% (MER / expense ratio).`;
      if (mer > 0.75) {
        verdict.cost = {
          status: "warning",
          label: "MER Above 0.75%",
          description,
        };
      } else if (mer > 0.4) {
        verdict.cost = {
          status: "neutral",
          label: "MER from 0.40% to 0.75%",
          description,
        };
      } else {
        verdict.cost = {
          status: "good",
          label: "MER Below 0.40%",
          description,
        };
      }
    }
  }

  // Volume is a liquidity input, not a complete liquidity measure.
  const volume = etf.volume;
  if (!volume) {
    verdict.liquidity = {
      status: "neutral",
      label: "Volume Data Unavailable",
      description: "The market data response did not include trading volume.",
    };
  } else if (volume > 1_000_000) {
    verdict.liquidity = {
      status: "good",
      label: "Volume Above 1M",
      description: "Reported trading volume is above one million shares. Spread and order-book depth still matter.",
    };
  } else if (volume > 100_000) {
    verdict.liquidity = {
      status: "neutral",
      label: "Volume from 100K to 1M",
      description: "Reported trading volume is between 100,000 and one million shares.",
    };
  } else {
    verdict.liquidity = {
      status: "warning",
      label: "Volume Below 100K",
      description: "Lower reported volume can coincide with wider spreads or more price impact.",
    };
  }

  // Use beta first, then realized volatility from price history.
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
        label: "Volatility Data Unavailable",
        description:
          "The available data does not include beta or enough price history for this estimate.",
      };
    }
  }

  return verdict;
}
