
import type { QuoteSession } from "@/lib/quote-session";

export interface ETF {
  ticker: string;
  name: string;
  price: number;
  currency?: string;
  quoteAsOf?: string;
  quoteSession?: QuoteSession;
  quoteStatus?: "ok" | "unavailable";
  changePercent: number;
  assetType?: string;
  isDeepAnalysisLoaded?: boolean;
  history: { date: string; price: number; interval?: string }[];
  dividendHistory?: { date: string; amount: number; exDate?: string }[];
  metrics: {
    mer?: number | null;
    yield?: number | null;
    merSource?: string | null;
    merRetrievedAt?: string | null;
    merSourceField?: "netExpenseRatio" | "annualReportExpenseRatio" | "Expense Ratio" | null;
    merInputUnit?: "fraction" | "percent" | "unknown" | null;
    merNormalization?: string | null;
    /** Measurement/report date; provider adapters currently do not supply one. */
    merMeasurementDate?: string | null;
    yieldSource?: string | null;
    yieldRetrievedAt?: string | null;
    yieldSourceField?: "trailingAnnualDividendYield" | "dividendYield" | null;
    yieldInputUnit?: "fraction" | "percent" | null;
    yieldNormalization?: string | null;
    /** The quote date used for a yield calculated from dated distributions. */
    yieldMeasurementDate?: string | null;
  };
  allocation: {
    equities: number;
    bonds: number;
    cash: number;
  };
  sectors?: {
    [key: string]: number;
  };
  /** Bond credit-quality weights (0-1), keyed by rating label */
  creditQuality?: {
    [key: string]: number;
  };
  holdings?: {
    ticker: string;
    name: string;
    weight: number;
    sector?: string;
    shares?: number;
  }[];
  /** equity | bond | mixed | commodity | leveraged | cash | unknown */
  fundClass?: string;
  category?: string;
  family?: string;
  /** GICS-style sector (stocks) or fund category (ETFs) */
  sector?: string;
  /** Industry within sector (stocks) or fund category (ETFs) */
  industry?: string;
  // Extended Metrics (Optional, for Stocks primarily)
  marketCap?: number;
  revenue?: number;
  netIncome?: number;
  eps?: number;
  sharesOutstanding?: number;
  volume?: number;
  open?: number;
  previousClose?: number;
  daysRange?: string;
  fiftyTwoWeekRange?: string;
  beta?: number;
  peRatio?: number;
  forwardPe?: number;
  earningsDate?: string;
  dividend?: number;
  exDividendDate?: string;
  dividendYield?: number | null;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  dividendGrowth5Y?: number;

  // New ETF Specific Metrics
  inceptionDate?: string;
  payoutFrequency?: string;
  payoutRatio?: number;
  holdingsCount?: number;
  bondMaturity?: number;
  bondDuration?: number;

  // Reddit Communities
  redditCommunities?: {
    subreddit: string;
    url: string;
  }[];
}

export interface PortfolioItem extends ETF {
  weight: number;
  shares: number;
}

export type Portfolio = PortfolioItem[];
