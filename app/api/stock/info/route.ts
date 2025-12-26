import { NextResponse } from 'next/server';
import { getStockProfile } from '@/lib/scrapers/stock-analysis';
import yahooFinance from 'yahoo-finance2';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json(
      { error: 'Ticker is required' },
      { status: 400 }
    );
  }

  try {
    let profile: any = await getStockProfile(ticker);

    // If description is missing (common for ETFs or failed scrapes), try Yahoo Finance
    if (!profile || !profile.description) {
        try {
            // Fetch summaryProfile (stocks) and fundProfile (ETFs)
            const summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile', 'price', 'fundProfile'] } as any) as any;

            const summaryProfile = summary.summaryProfile || {};
            const fundProfile = summary.fundProfile || {};

            const description = summaryProfile.longBusinessSummary || null;

            // Determine sector/industry/family
            const sector = profile?.sector || summaryProfile.sector || fundProfile.categoryName || 'Unknown';
            const industry = profile?.industry || summaryProfile.industry || fundProfile.family || 'Unknown';

            if (profile) {
                profile = {
                    ...profile,
                    description: profile.description || description,
                    sector,
                    industry
                };
            } else {
                profile = {
                    sector,
                    industry,
                    description,
                    analyst: undefined
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
            sector: 'Unknown',
            industry: 'Unknown',
            description: null
        });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching stock profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
