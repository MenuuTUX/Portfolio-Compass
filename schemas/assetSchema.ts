import { z } from 'zod';

// Helper for date string validation (basic ISO check or just string)
const DateString = z.string();

export const EtfHistoryItemSchema = z.object({
  date: DateString,
  price: z.number(),
  interval: z.string().optional(),
});

export const DividendHistoryItemSchema = z.object({
  date: DateString,
  amount: z.number(),
  exDate: z.string().optional(),
});

export const MetricsSchema = z.object({
  mer: z.number(),
  yield: z.number(),
});

export const AllocationSchema = z.object({
  equities: z.number(),
  bonds: z.number(),
  cash: z.number(),
});

// Since sectors is { [key: string]: number }, we use z.record
export const SectorsSchema = z.record(z.string(), z.number());

export const HoldingSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  weight: z.number(),
  sector: z.string().optional(),
  shares: z.number().optional(),
});

export const ETFSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  price: z.number(),
  changePercent: z.number(),
  assetType: z.string().optional(),
  isDeepAnalysisLoaded: z.boolean().optional(),
  history: z.array(EtfHistoryItemSchema),
  dividendHistory: z.array(DividendHistoryItemSchema).optional(),
  metrics: MetricsSchema,
  allocation: AllocationSchema,
  sectors: SectorsSchema.optional(),
  holdings: z.array(HoldingSchema).optional(),

  // Extended Metrics
  marketCap: z.number().optional(),
  revenue: z.number().optional(),
  netIncome: z.number().optional(),
  eps: z.number().optional(),
  sharesOutstanding: z.number().optional(),
  volume: z.number().optional(),
  open: z.number().optional(),
  previousClose: z.number().optional(),
  daysRange: z.string().optional(),
  fiftyTwoWeekRange: z.string().optional(),
  beta: z.number().optional(),
  peRatio: z.number().optional(),
  forwardPe: z.number().optional(),
  earningsDate: z.string().optional(),
  dividend: z.number().optional(),
  exDividendDate: z.string().optional(),
  dividendYield: z.number().optional(),
  fiftyTwoWeekLow: z.number().optional(),
  fiftyTwoWeekHigh: z.number().optional(),
  dividendGrowth5Y: z.number().optional(),

  // New ETF Specific Metrics
  inceptionDate: z.string().optional(),
  payoutFrequency: z.string().optional(),
  payoutRatio: z.number().optional(),
  holdingsCount: z.number().optional(),
  bondMaturity: z.number().optional(),
  bondDuration: z.number().optional(),

  // Social
  redditUrl: z.string().optional(),
});

export const PortfolioItemSchema = ETFSchema.extend({
  weight: z.number(),
  shares: z.number(),
});

export const PortfolioSchema = z.array(PortfolioItemSchema);

export type ETF = z.infer<typeof ETFSchema>;
export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
