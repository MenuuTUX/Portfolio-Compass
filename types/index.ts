import { Decimal } from 'decimal.js';

export interface ETF {
  ticker: string;
  name: string;
  price: number; // We converted back to number in API for now (Option A)
  changePercent: number;
  assetType?: string;
  isDeepAnalysisLoaded?: boolean;
  history: { date: string; price: number; interval?: string }[];
  dividendHistory?: { date: string; amount: number; exDate?: string }[];
  metrics: {
    mer: number;
    yield: number;
  };
  allocation: {
    equities: number;
    bonds: number;
    cash: number;
  };
  sectors?: {
    [key: string]: number;
  };
  holdings?: {
    ticker: string;
    name: string;
    weight: number;
    sector?: string;
    shares?: number;
  }[];
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
  dividendYield?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  dividendGrowth5Y?: number;
}

export interface PortfolioItem extends ETF {
  weight: number;
  shares: number;
}

export type Portfolio = PortfolioItem[];
