export interface ETF {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  history: number[];
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
}

export type Portfolio = PortfolioItem[];
