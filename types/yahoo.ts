export interface MarketSnapshotItem {
  ticker: string;
  name: string;
  price: number;
  daily_change: number;
  asset_type: string;
  yield: number;
  mer: number;
}

export interface EtfDetails {
  ticker: string;
  name: string;
  currency: string;
  exchange: string;
  price: number;
  daily_change: number;
  yield: number;
  mer: number;
  asset_type: string;
  history: Array<{ date: string; close: number; interval: string }>;
  dividendHistory: Array<{ date: string; amount: number }>;
  sectors: Array<{ sector_name: string; weight: number }>;
  allocation: {
    stocks_weight: number;
    bonds_weight: number;
    cash_weight: number;
  };
}
