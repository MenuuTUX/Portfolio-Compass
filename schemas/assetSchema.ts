import { z } from 'zod';
import { quoteSessionValues } from "@/lib/quote-session";

const QuoteSessionSchema = z.enum(quoteSessionValues);

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
  mer: z.number().nullable().optional(),
  yield: z.number().nullable().optional(),
  merSource: z.string().nullable().optional(),
  merRetrievedAt: z.string().nullable().optional(),
  merSourceField: z.enum(["netExpenseRatio", "annualReportExpenseRatio", "Expense Ratio"]).nullable().optional(),
  merInputUnit: z.enum(["fraction", "percent", "unknown"]).nullable().optional(),
  merNormalization: z.string().nullable().optional(),
  merMeasurementDate: z.string().nullable().optional(),
  yieldSource: z.string().nullable().optional(),
  yieldRetrievedAt: z.string().nullable().optional(),
  yieldSourceField: z.enum(["trailingAnnualDividendYield", "dividendYield"]).nullable().optional(),
  yieldInputUnit: z.enum(["fraction", "percent"]).nullable().optional(),
  yieldNormalization: z.string().nullable().optional(),
  yieldMeasurementDate: z.string().nullable().optional(),
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
  currency: z.string().optional(),
  quoteAsOf: z.string().optional(),
  quoteSession: QuoteSessionSchema.optional(),
  quoteStatus: z.enum(["ok", "unavailable"]).optional(),
  changePercent: z.number(),
  assetType: z.string().optional(),
  isDeepAnalysisLoaded: z.boolean().optional(),
  history: z.array(EtfHistoryItemSchema),
  dividendHistory: z.array(DividendHistoryItemSchema).optional(),
  metrics: MetricsSchema,
  allocation: AllocationSchema,
  sectors: SectorsSchema.optional(),
  holdings: z
    .array(
      z.object({
        ticker: z.string(),
        name: z.string(),
        weight: z.number(),
        sector: z.string().optional(),
        shares: z.number().optional(),
      }),
    )
    .optional(),
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
  dividendYield: z.number().nullable().optional(),
  fiftyTwoWeekLow: z.number().optional(),
  fiftyTwoWeekHigh: z.number().optional(),
  dividendGrowth5Y: z.number().optional(),
  inceptionDate: z.string().optional(),
  payoutFrequency: z.string().optional(),
  payoutRatio: z.number().optional(),
  holdingsCount: z.number().optional(),
  bondMaturity: z.number().optional(),
  bondDuration: z.number().optional(),
  fundClass: z.string().optional(),
  category: z.string().optional(),
  family: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  creditQuality: z.record(z.string(), z.number()).optional(),
  redditCommunities: z
    .array(
      z.object({
        subreddit: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
});

export const PortfolioItemSchema = ETFSchema.extend({
  weight: z.number(),
  shares: z.number(),
});

export const PortfolioSchema = z.array(PortfolioItemSchema);

export type ETF = z.infer<typeof ETFSchema>;
export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
