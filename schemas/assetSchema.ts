import { z } from "zod";
import { quoteSessionValues } from "@/lib/quote-session";

const QuoteSessionSchema = z.enum(quoteSessionValues);

const EtfHistoryItemSchema = z.object({
  date: z.string(),
  price: z.number(),
  /** Dividend-adjusted close; absent when the provider returned none. */
  adjPrice: z.number().optional(),
  interval: z.string().optional(),
});

const DividendHistoryItemSchema = z.object({
  date: z.string(),
  amount: z.number(),
  exDate: z.string().optional(),
});

const MetricsSchema = z.object({
  mer: z.number().nullable().optional(),
  yield: z.number().nullable().optional(),
  merSource: z.string().nullable().optional(),
  merRetrievedAt: z.string().nullable().optional(),
  merSourceField: z.enum(["netExpenseRatio", "annualReportExpenseRatio", "Expense Ratio"]).nullable().optional(),
  merInputUnit: z.enum(["fraction", "percent", "unknown"]).nullable().optional(),
  merNormalization: z.string().nullable().optional(),
  /** Measurement/report date; provider adapters currently do not supply one. */
  merMeasurementDate: z.string().nullable().optional(),
  yieldSource: z.string().nullable().optional(),
  yieldRetrievedAt: z.string().nullable().optional(),
  yieldSourceField: z.enum(["trailingAnnualDividendYield", "dividendYield"]).nullable().optional(),
  yieldInputUnit: z.enum(["fraction", "percent"]).nullable().optional(),
  yieldNormalization: z.string().nullable().optional(),
  /** The quote date used for a yield calculated from dated distributions. */
  yieldMeasurementDate: z.string().nullable().optional(),
  /** How `beta` was obtained, e.g. "Estimated vs SPY from 249 daily total returns". */
  betaSource: z.string().nullable().optional(),
});

const AllocationSchema = z.object({
  equities: z.number(),
  bonds: z.number(),
  cash: z.number(),
  other: z.number().optional(),
});

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
  /** Percent weights (0-100). Null when no source reported an asset mix. */
  allocation: AllocationSchema.nullable(),
  sectors: z.record(z.string(), z.number()).optional(),
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
  /** equity | bond | mixed | commodity | leveraged | cash | unknown */
  fundClass: z.string().optional(),
  category: z.string().optional(),
  family: z.string().optional(),
  /** GICS-style sector (stocks) or fund category (ETFs). */
  sector: z.string().optional(),
  /** Industry within sector (stocks) or fund category (ETFs). */
  industry: z.string().optional(),
  /** Bond credit-quality weights (0-1), keyed by rating label. */
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

export type ETF = z.infer<typeof ETFSchema>;
