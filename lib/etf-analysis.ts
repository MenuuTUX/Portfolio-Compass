import { ETF } from "@/types";

type Status = "good" | "neutral" | "warning";

interface EtfVerdict {
  cost: {
    status: Status;
    label: string;
    description: string;
  };
  liquidity: {
    status: Status;
    label: string;
    description: string;
  };
  volatility: {
    status: Status;
    label: string;
    description: string;
  };
}

export function analyzeEtf(etf: ETF): EtfVerdict {
  // 1. Analyze Cost (Expense Ratio / MER)
  const mer = etf.metrics?.mer || 0;
  let costStatus: Status = "good";
  let costLabel = "Low Cost";

  if (mer > 0.75) {
    costStatus = "warning";
    costLabel = "High Fee";
  } else if (mer > 0.4) {
    costStatus = "neutral";
    costLabel = "Moderate Fee";
  }

  // 2. Analyze Liquidity (Volume)
  // Rule of thumb: Higher volume = easier to trade without slippage
  const volume = etf.volume || 0;
  let liqStatus: Status = "warning";
  let liqLabel = "Low Liquidity";

  if (volume > 1_000_000) {
    liqStatus = "good";
    liqLabel = "Highly Liquid";
  } else if (volume > 100_000) {
    liqStatus = "neutral";
    liqLabel = "Moderate Liquidity";
  }

  // 3. Analyze Volatility (Beta)
  // Beta > 1 means more volatile than the market
  const beta = etf.beta || 1;
  let volStatus: Status = "neutral";
  let volLabel = "Market Risk";

  if (beta > 1.25) {
    volStatus = "warning";
    volLabel = "High Volatility";
  } else if (beta < 0.85) {
    volStatus = "good";
    volLabel = "Low Volatility";
  }

  return {
    cost: {
      status: costStatus,
      label: costLabel,
      description: `Annual fee of ${mer}% reduces long-term returns.`,
    },
    liquidity: {
      status: liqStatus,
      label: liqLabel,
      description:
        volume < 100000
          ? "Low trading volume may lead to wider spreads (extra cost)."
          : "High volume ensures easy entry and exit.",
    },
    volatility: {
      status: volStatus,
      label: volLabel,
      description:
        beta > 1
          ? `This asset is ${((beta - 1) * 100).toFixed(0)}% more volatile than the market.`
          : `This asset is generally more stable than the market.`,
    },
  };
}
