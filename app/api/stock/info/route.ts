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
    let profile = await getStockProfile(ticker);

    // If description is missing (common for ETFs or failed scrapes), try Yahoo Finance
    if (!profile || !profile.description) {
        try {
            const summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile', 'price'] } as any) as any;
            if (summary.summaryProfile?.longBusinessSummary) {
                // Determine sector/industry if missing
                const sector = profile?.sector || summary.summaryProfile.sector || 'Unknown';
                const industry = profile?.industry || summary.summaryProfile.industry || 'Unknown';

                if (profile) {
                    profile = {
                        ...profile,
                        description: summary.summaryProfile.longBusinessSummary,
                        sector,
                        industry
                    };
                } else {
                    profile = {
                        sector,
                        industry,
                        description: summary.summaryProfile.longBusinessSummary,
                        analyst: undefined
                    };
                }
            }
        } catch (yfError) {
            console.warn(`Yahoo Finance fallback failed for ${ticker}:`, yfError);
        }
    }

    if (!profile) {
       return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
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
