import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { syncEtfDetails } from '@/lib/etf-sync';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ticker } = body;

        console.log(`[API] POST /api/portfolio request for: ${ticker}`);

        if (!ticker) {
            return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
        }

        const upperTicker = ticker.toUpperCase();

        // Data Assurance: Check if the ETF exists and is fully loaded
        const existingEtf = await prisma.etf.findUnique({
            where: { ticker: upperTicker },
        });

        if (!existingEtf || !existingEtf.isDeepAnalysisLoaded) {
            console.log(`[API] Ticker ${upperTicker} missing or incomplete, syncing...`);
            const syncedEtf = await syncEtfDetails(upperTicker);

            if (!syncedEtf) {
                console.error(`[API] Sync failed for ${upperTicker} - Ticker not found on market`);
                return NextResponse.json({ error: 'Ticker not found on market' }, { status: 404 });
            }
        }

        console.log(`[API] Upserting PortfolioItem for ${upperTicker}`);
        // The Safe Add: Upsert PortfolioItem
        const item = await prisma.portfolioItem.upsert({
            where: { etfId: upperTicker },
            create: {
                etfId: upperTicker,
                weight: 0,
                shares: 0,
            },
            update: {}, // Don't overwrite existing user data if they add it twice
        });
        console.log(`[API] Successfully upserted item: ${JSON.stringify(item)}`);

        return NextResponse.json({ message: 'Success', ticker: upperTicker }, { status: 201 });

    } catch (error) {
        console.error('[API] Error adding stock to portfolio:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const ticker = searchParams.get('ticker');

        if (!ticker) {
            return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
        }

        const upperTicker = ticker.toUpperCase();

        await prisma.portfolioItem.delete({
            where: { etfId: upperTicker },
        });

        return NextResponse.json({ message: 'Success' });
    } catch (error) {
        console.error('[API] Error removing stock from portfolio:', error);
        // If it doesn't exist, it's effectively deleted, so we can return 200.
        // Prisma throws P2025 if record not found.
        if ((error as any).code === 'P2025') {
             return NextResponse.json({ message: 'Success' }); // Already gone
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { ticker, weight, shares } = body;

        if (!ticker) {
            return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
        }

        const upperTicker = ticker.toUpperCase();

        const updatedItem = await prisma.portfolioItem.update({
            where: { etfId: upperTicker },
            data: {
                ...(weight !== undefined && { weight }),
                ...(shares !== undefined && { shares }),
            },
            include: {
                etf: {
                    include: {
                        sectors: true,
                        allocation: true,
                        history: {
                            take: 7,
                            orderBy: { date: 'desc' },
                        },
                    },
                },
            },
        });

        // Transform Response (same logic as GET)
        const etf = updatedItem.etf;
        const formattedItem = {
                ticker: etf.ticker,
                name: etf.name,
                price: Number(etf.price),
                changePercent: Number(etf.daily_change),
                assetType: etf.assetType,
                isDeepAnalysisLoaded: etf.isDeepAnalysisLoaded,

                weight: Number(updatedItem.weight),
                shares: Number(updatedItem.shares),

                // History: Latest 7 days, reversed for chart (oldest first)
                history: etf.history.map((h) => ({
                    date: h.date.toISOString(),
                    price: Number(h.close),
                    interval: h.interval
                })).reverse(),

                metrics: {
                    yield: etf.yield ? Number(etf.yield) : 0,
                    mer: etf.mer ? Number(etf.mer) : 0
                },

                allocation: {
                    equities: etf.allocation?.stocks_weight ? Number(etf.allocation.stocks_weight) : 0,
                    bonds: etf.allocation?.bonds_weight ? Number(etf.allocation.bonds_weight) : 0,
                    cash: etf.allocation?.cash_weight ? Number(etf.allocation.cash_weight) : 0,
                },

                sectors: etf.sectors && etf.sectors.length > 0
                    ? etf.sectors.reduce((acc, s) => {
                        acc[s.sector_name] = Number(s.weight);
                        return acc;
                    }, {} as Record<string, number>)
                    : undefined
            };

        return NextResponse.json(formattedItem);

    } catch (error) {
        console.error('[API] Error updating portfolio item:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET() {
    try {
        type PortfolioItemWithRelations = Prisma.PortfolioItemGetPayload<{
          include: {
              etf: {
                  include: {
                      sectors: true;
                      allocation: true;
                      history: true; // Note: 'take' argument doesn't change the payload type significantly for fields, just the count
                  },
              },
          },
        }>;

        const portfolioItems = await prisma.portfolioItem.findMany({
            include: {
                etf: {
                    include: {
                        sectors: true,
                        allocation: true,
                        history: {
                            take: 7,
                            orderBy: { date: 'desc' },
                        },
                    },
                },
            },
        }) as unknown as PortfolioItemWithRelations[];

        // Transform Response: Map the data to a clean JSON object.
        const formattedPortfolio = portfolioItems.map((item) => {
            // Flatten the response to match the PortfolioItem interface which extends ETF
            // This prevents frontend crashes due to changed data shape
            const etf = item.etf;
            return {
                ticker: etf.ticker,
                name: etf.name,
                price: Number(etf.price),
                changePercent: Number(etf.daily_change),
                assetType: etf.assetType,
                isDeepAnalysisLoaded: etf.isDeepAnalysisLoaded,

                weight: Number(item.weight),
                shares: Number(item.shares),

                // History: Latest 7 days, reversed for chart (oldest first)
                history: etf.history.map((h) => ({
                    date: h.date.toISOString(),
                    price: Number(h.close),
                    interval: h.interval
                })).reverse(),

                metrics: {
                    yield: etf.yield ? Number(etf.yield) : 0,
                    mer: etf.mer ? Number(etf.mer) : 0
                },

                allocation: {
                    equities: etf.allocation?.stocks_weight ? Number(etf.allocation.stocks_weight) : 0,
                    bonds: etf.allocation?.bonds_weight ? Number(etf.allocation.bonds_weight) : 0,
                    cash: etf.allocation?.cash_weight ? Number(etf.allocation.cash_weight) : 0,
                },

                // The interface expects sectors as Record<string, number> or undefined
                // The DB returns an array of objects
                sectors: etf.sectors && etf.sectors.length > 0
                    ? etf.sectors.reduce((acc, s) => {
                        acc[s.sector_name] = Number(s.weight);
                        return acc;
                    }, {} as Record<string, number>)
                    : undefined
            };
        });

        return NextResponse.json(formattedPortfolio);
    } catch (error) {
        console.error('[API] Error fetching portfolio:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
