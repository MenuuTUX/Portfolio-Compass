export interface ETF {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  assetType?: string;
  isDeepAnalysisLoaded?: boolean;
  history: { date: string; price: number; interval?: string }[];
  metrics: {
    mer: number;
    yield: number;
  };
  allocation: {
    equities: number;
    bonds: number;
    cash: number;
  };
  sectors: {
    [key: string]: number;
  };
}

export interface PortfolioItem extends ETF {
  weight: number;
  shares: number;
}

export type Portfolio = PortfolioItem[];
