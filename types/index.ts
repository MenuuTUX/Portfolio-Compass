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
}

export interface PortfolioItem extends ETF {
  weight: number;
  shares: number;
}

export type Portfolio = PortfolioItem[];
