import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ETF, PortfolioItem } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const portfolioItems = await prisma.portfolioItem.findMany({
            include: {
                etf: {
                    include: {
                        history: { orderBy: { date: 'asc' } },
                        sectors: true,
                        allocation: true,
                    },
                },
            },
        });

        const formattedPortfolio: PortfolioItem[] = portfolioItems.map((item) => ({
            ticker: item.etf.ticker,
            name: item.etf.name,
            price: item.etf.price,
            changePercent: item.etf.daily_change,
            assetType: item.etf.assetType,
            isDeepAnalysisLoaded: item.etf.isDeepAnalysisLoaded,

            weight: item.weight,
            shares: item.shares,
            history: item.etf.history.map((h) => ({
                date: h.date.toISOString(),
                price: h.close,
                interval: h.interval
            })),
            metrics: { yield: item.etf.yield || 0, mer: item.etf.mer || 0 },
            allocation: {
                equities: item.etf.allocation?.stocks_weight || 0,
                bonds: item.etf.allocation?.bonds_weight || 0,
                cash: item.etf.allocation?.cash_weight || 0,
            },
            sectors: item.etf.sectors.reduce((acc, sector) => {
                acc[sector.sector_name] = sector.weight;
                return acc;
            }, {} as { [key: string]: number }),
        }));

        return NextResponse.json(formattedPortfolio);
    } catch (error) {
        console.error('[API] Error fetching portfolio:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const newStock: ETF = await request.json();

        if (!newStock.ticker) {
            return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
        }

        // 1. Ensure ETF exists in DB (Upsert)
        // We need to handle the nested relations carefully or just upsert the base fields
        // For simplicity, we assume the ETF data passed is valid and we want to store/update it.
        // However, usually we might just want to link to an existing ETF or ensure it's created.
        // Given the flow, we'll upsert the ETF base data.

        await prisma.etf.upsert({
            where: { ticker: newStock.ticker },
            update: {
                price: newStock.price,
                daily_change: newStock.changePercent,
                // We don't update everything here to avoid overwriting good data with potentially partial data
            },
            create: {
                ticker: newStock.ticker,
                name: newStock.name,
                price: newStock.price,
                daily_change: newStock.changePercent,
                assetType: newStock.assetType || 'ETF',
                currency: 'USD', // Defaulting
            },
        });

        // 2. Check if already in portfolio
        const existingItem = await prisma.portfolioItem.findUnique({
            where: { etfId: newStock.ticker },
        });

        if (existingItem) {
            return NextResponse.json({ message: 'Item already in portfolio' }, { status: 200 });
        }

        // 3. Add to portfolio with 0 weight initially or calculate immediately
        // The requirement says "Auto-balance logic", so let's do that.

        // Get current count to calculate new weights
        const currentCount = await prisma.portfolioItem.count();
        const newCount = currentCount + 1;
        const evenWeight = 100 / newCount;

        // Transaction to update all weights and insert new item
        await prisma.$transaction([
            prisma.portfolioItem.updateMany({
                data: { weight: evenWeight },
            }),
            prisma.portfolioItem.create({
                data: {
                    etfId: newStock.ticker,
                    weight: evenWeight,
                    shares: 0,
                },
            }),
        ]);

        // 4. Return updated portfolio or just success
        // The hook expects `res.json()`, let's return the added item or the whole list.
        // The hook invalidates 'portfolio' query, so returning success is enough, but returning the item is nice.
        return NextResponse.json({ message: 'Stock added successfully' }, { status: 201 });

    } catch (error) {
        console.error('[API] Error adding stock to portfolio:', error);
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

        const updateData: any = {};
        if (weight !== undefined) updateData.weight = weight;
        if (shares !== undefined) updateData.shares = shares;

        const updatedItem = await prisma.portfolioItem.update({
            where: { etfId: ticker },
            data: updateData,
        });

        return NextResponse.json(updatedItem);
    } catch (error) {
        console.error('[API] Error updating portfolio item:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
