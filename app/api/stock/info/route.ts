import { NextResponse } from "next/server";
import { getStockProfile } from "@/lib/scrapers/stock-analysis";
import { getEtfDescription } from "@/lib/scrapers/etf-dot-com";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  }

  try {
    // 1. Fetch main profile from StockAnalysis (robust source for metrics/sector)
    let profile: any = await getStockProfile(ticker);

    // 2. Try to get specialized ETF description from ETF.com (User requested source)
    // We do this if profile is missing, or even if present to see if we can get "Analysis & Insights"
    // However, to save time, we might only do it if we suspect it's an ETF or if description is missing.
    // Given the user request "scrap this website... for the description", we prioritize it.
    if (!profile?.description || profile.sector === "Unknown") {
      const etfDesc = await getEtfDescription(ticker);
      if (etfDesc) {
        if (!profile) profile = { sector: "Unknown", industry: "Unknown" };
        profile.description = etfDesc;
      }
    } else {
      // If we have a profile, we can still try to upgrade the description if it's an ETF
      // But doing 2 scrapes per request is slow.
      // Let's assume if StockAnalysis gave us a description, it's "good enough" unless the user
      // explicitly wants ETF.com.
      // But the user complained about "lazy/clunky" which was Yahoo.
      // StockAnalysis description is actually quite good.
      // But let's try ETF.com as an override if we can confirm it's an ETF?
      // Simpler: Just try ETF.com if StockAnalysis failed to give a description.
      // Wait, I want to use ETF.com as the *preferred* source for description per user request.
      const etfDesc = await getEtfDescription(ticker);
      if (etfDesc) {
        profile.description = etfDesc;
      }
    }

    // 3. Fallback to Yahoo Finance if still missing description or basic info
    if (!profile || !profile.description) {
      try {
        // Fetch summaryProfile (stocks) and fundProfile (ETFs)
        const summary = (await yahooFinance.quoteSummary(ticker, {
          modules: ["summaryProfile", "price", "fundProfile"],
        } as any)) as any;

        const summaryProfile = summary.summaryProfile || {};
        const fundProfile = summary.fundProfile || {};

        const description = summaryProfile.longBusinessSummary || null;

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

    // Even if profile is empty/partial, return it so the UI can render what it has (e.g. just Sector/Industry)
    // instead of a 404 which causes a red error box.
    if (!profile) {
      // Return a minimal valid object
      return NextResponse.json({
        sector: "Unknown",
        industry: "Unknown",
        description: null,
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching stock profile:", error);

    const errorMessage =
      process.env.NODE_ENV === "development"
        ? (error as Error).message
        : "Internal Server Error";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
