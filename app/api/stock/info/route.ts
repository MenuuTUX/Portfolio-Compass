import { NextResponse } from 'next/server';
import { getStockProfile } from '@/lib/scrapers/stock-analysis';

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
    const profile = await getStockProfile(ticker);

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
