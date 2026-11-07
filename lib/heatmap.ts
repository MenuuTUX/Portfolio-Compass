export interface HeatmapStock {
  ticker: string;
  name: string;
  changePercent: number;
  marketCap: number;
}

export interface HeatmapPayload {
  group: string;
  label: string;
  updatedAt: string;
  /** Day change of the index proxy (an ETF, or the cap-weighted members when there is none). */
  benchmark: { ticker: string | null; changePercent: number } | null;
  sectors: { name: string; stocks: HeatmapStock[] }[];
}
