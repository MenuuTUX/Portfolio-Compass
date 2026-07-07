import { ETF } from "@/types";

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

// Missing data must read as "unknown", never as a judgement: a freshly
// seeded row without volume/beta used to show "Low Liquidity" and fee
// verdicts for blue chips like MSFT.
export function analyzeEtf(etf: ETF): EtfVerdict {
  const verdict = {} as EtfVerdict;

  // 1. Cost (Expense Ratio / MER) — only meaningful for funds; stocks have
  // no management fee, so the card is omitted entirely.
  if (etf.assetType !== "STOCK") {
    const mer = etf.metrics?.mer;
    if (!mer) {
      verdict.cost = {
        status: "neutral",
        label: "Fee Unknown",
        description: "No expense ratio data available for this fund yet.",
      };
    } else {
      const description = `Annual fee of ${mer}% reduces long-term returns.`;
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

  // 2. Liquidity (Volume)
  // Rule of thumb: Higher volume = easier to trade without slippage
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

  // 3. Volatility (Beta)
  // Beta > 1 means more volatile than the market
  const beta = etf.beta;
  if (beta === undefined || beta === null) {
    verdict.volatility = {
      status: "neutral",
      label: "Volatility Unknown",
      description: "No beta data available for this asset yet.",
    };
  } else if (beta > 1.25) {
    verdict.volatility = {
      status: "warning",
      label: "High Volatility",
      description: `This asset is ${((beta - 1) * 100).toFixed(0)}% more volatile than the market.`,
    };
  } else if (beta < 0.85) {
    verdict.volatility = {
      status: "good",
      label: "Low Volatility",
      description: "This asset is generally more stable than the market.",
    };
  } else {
    verdict.volatility = {
      status: "neutral",
      label: "Market Risk",
      description:
        beta > 1
          ? `This asset is ${((beta - 1) * 100).toFixed(0)}% more volatile than the market.`
          : "This asset moves roughly in line with the market.",
    };
  }

  return verdict;
}
