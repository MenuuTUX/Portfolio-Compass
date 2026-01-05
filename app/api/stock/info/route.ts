import { NextResponse } from 'next/server';
import { getStockProfile } from '@/lib/scrapers/stock-analysis';
import { getEtfDescription } from '@/lib/scrapers/etf-dot-com';
import yahooFinance from 'yahoo-finance2';

// Simple in-memory cache to prevent DoS
const profileCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    const type = searchParams.get('type') || 'STOCK';

    if (!ticker) {
        return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
    }

    // Check Cache
    const cached = profileCache.get(ticker);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return NextResponse.json(cached.data);
    }

    try {
        let profile = await getStockProfile(ticker);

        // Fallback for description if missing or generic
        if (!profile?.description || profile.description.length < 50) {
             try {
                // Try ETF.com for ETFs
                if (type === 'ETF') {
                    const etfDesc = await getEtfDescription(ticker);
                    if (etfDesc) {
                         if (!profile) {
                            // If profile was null, initialize a partial one
                            profile = {
                                description: etfDesc,
                                sector: 'Unknown',
                                industry: 'Unknown'
                            } as any;
                         } else {
                            profile.description = etfDesc;
                         }
                    }
                }

                // Final fallback to Yahoo
                 if (!profile?.description || profile.description.length < 50) {
                     // Cast to any to avoid TS error: Property 'summaryProfile' does not exist on type 'never'
                     const yf = await yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile', 'assetProfile'] }) as any;
                     const yDesc = yf.summaryProfile?.longBusinessSummary || yf.assetProfile?.longBusinessSummary;
                     if (yDesc) {
                        if (!profile) {
                            profile = {
                                description: yDesc,
                                sector: 'Unknown',
                                industry: 'Unknown'
                            } as any;
                        } else {
                            profile.description = yDesc;
                        }
                     }
                 }

            } catch (err) {
                console.warn(`[API] Description fallback failed for ${ticker}:`, err);
            }
        }

        // If still completely failed, return partial
        if (!profile || Object.keys(profile).length === 0) {
             // Do not cache failures aggressively, or cache them for shorter time?
             // For now, return soft fail but don't cache empty results to allow retries
             return NextResponse.json({
                description: 'Profile unavailable',
                sector: 'Unknown',
                industry: 'Unknown'
            });
        }

        // Store in Cache
        profileCache.set(ticker, { data: profile, timestamp: Date.now() });

        return NextResponse.json(profile);
    } catch (error) {
        console.error(`[API] Error fetching info for ${ticker}:`, error);
        return NextResponse.json({
            description: 'Profile unavailable',
            sector: 'Unknown',
            industry: 'Unknown'
        }); // Soft fail
    }
}
