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
});

export const PortfolioItemSchema = ETFSchema.extend({
  weight: z.number(),
  shares: z.number(),
});

export const PortfolioSchema = z.array(PortfolioItemSchema);

export type ETF = z.infer<typeof ETFSchema>;
export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
