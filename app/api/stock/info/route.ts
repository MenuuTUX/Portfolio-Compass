import { NextResponse } from "next/server";
import {
  getStockProfile,
  type StockProfile,
} from "@/lib/scrapers/stock-analysis";
import { getEtfDescription } from "@/lib/scrapers/etf-dot-com";
import YahooFinance from "yahoo-finance2";
import { z } from "zod";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

const tickerSchema = z.string().min(1).max(12).regex(/^[a-zA-Z0-9.-]+$/);
const YahooProfileSchema = z.object({
  summaryProfile: z.object({
    longBusinessSummary: z.string().optional(),
    sector: z.string().optional(),
    industry: z.string().optional(),
  }).optional(),
  fundProfile: z.object({
    categoryName: z.string().optional(),
    family: z.string().optional(),
  }).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  }

  const validation = tickerSchema.safeParse(ticker);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid ticker format" }, { status: 400 });
  }

  try {
    // Primary profile source
    let profile: Partial<StockProfile> | null = await getStockProfile(ticker);

    // 2. Try to get specialized ETF description from ETF.com (User requested source)
    // We do this if profile is missing, or even if present to see if we can get "Analysis & Insights"
    // However, to save time, we might only do it if we suspect it's an ETF or if description is missing.
    // Given the user request "scrap this website... for the description", we prioritize it.
    const etfDesc = await getEtfDescription(ticker);
    if (etfDesc) {
      profile = profile
        ? { ...profile, description: etfDesc }
        : { sector: "Unknown", industry: "Unknown", description: etfDesc };
    }

    // 3. Fallback to Yahoo Finance if still missing description or basic info
    if (!profile || !profile.description) {
      try {
        // Fetch summaryProfile (stocks) and fundProfile (ETFs)
        const rawSummary = await yahooFinance.quoteSummary(ticker, {
          modules: ["summaryProfile", "price", "fundProfile"],
        });
        const summary = YahooProfileSchema.parse(rawSummary);

        const summaryProfile = summary.summaryProfile || {};
        const fundProfile = summary.fundProfile || {};

        const description = summaryProfile.longBusinessSummary;

        // Determine sector/industry/family
        const sector =
          profile?.sector ||
          summaryProfile.sector ||
          fundProfile.categoryName ||
          "Unknown";
        const industry =
          profile?.industry ||
          summaryProfile.industry ||
          fundProfile.family ||
          "Unknown";

        if (profile) {
          profile = {
            ...profile,
            description: profile.description || description,
            sector,
            industry,
          };
        } else {
          profile = {
            sector,
            industry,
            description,
            analyst: undefined,
          };
        }
      } catch (yfError) {
        console.warn(`Yahoo Finance fallback failed for ${ticker}:`, yfError);
      }
    }

    // Use 404 when no profile source resolves so clients do not treat empty data as success.
    if (!profile) {
      return NextResponse.json(
        {
          error: "Stock profile not found",
          ticker: validation.data.toUpperCase(),
        },
        { status: 404 },
      );
    }

    // Partial profile is still useful (sector/industry without description)
    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching stock profile:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
