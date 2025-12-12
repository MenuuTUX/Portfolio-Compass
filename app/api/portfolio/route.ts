import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { EtfHistory } from '@prisma/client';
import { ETF, PortfolioItem } from '@/types';
import { Decimal } from 'decimal.js';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const portfolioItems = await prisma.portfolioItem.findMany({
            include: {
                etf: {
                    include: {
                        history: {
                            orderBy: { date: 'desc' },
                            take: 30
                        },
                        sectors: true,
                        allocation: true,
                    },
                },
            },
        });

        // Map Prisma Decimal to number/Decimal as needed by the frontend types
        // Since we are sending JSON, Decimal will be serialized (usually to string)
        // However, the interface `PortfolioItem` in `types/index.ts` accepts `number | Decimal`.
        // If we want to return Numbers to the frontend (Option A), we convert here.
        // OR we return strings and let the frontend parse.
        // Given Option A's "conversion at the edge", converting to Number HERE is the easiest "edge"
        // before the frontend even sees it, ensuring standard JSON numbers.
        // BUT `decimal.js` handles precision better. If we convert to Number here, we lose precision on the wire.
        // But the user chose "Option A" to solve *compilation errors* and *UI issues*.
        // If I return numbers here, the frontend (which expects number | Decimal) will receive numbers.
        // This satisfies "Option A" cleanly.

        const formattedPortfolio: any[] = portfolioItems.map((item) => ({
            ticker: item.etf.ticker,
            name: item.etf.name,
            price: Number(item.etf.price),
            changePercent: Number(item.etf.daily_change),
            assetType: item.etf.assetType,
            isDeepAnalysisLoaded: item.etf.isDeepAnalysisLoaded,

            weight: Number(item.weight),
            shares: Number(item.shares),
            history: item.etf.history.map((h: EtfHistory) => ({
                date: h.date.toISOString(),
                price: Number(h.close),
                interval: h.interval
            })).reverse(),
            metrics: {
                yield: item.etf.yield ? Number(item.etf.yield) : 0,
                mer: item.etf.mer ? Number(item.etf.mer) : 0
            },
            allocation: {
                equities: item.etf.allocation?.stocks_weight ? Number(item.etf.allocation.stocks_weight) : 0,
                bonds: item.etf.allocation?.bonds_weight ? Number(item.etf.allocation.bonds_weight) : 0,
                cash: item.etf.allocation?.cash_weight ? Number(item.etf.allocation.cash_weight) : 0,
            },
            sectors: item.etf.sectors.reduce((acc, sector) => {
                acc[sector.sector_name] = Number(sector.weight);
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

        await prisma.etf.upsert({
            where: { ticker: newStock.ticker },
            update: {
                price: new Decimal(newStock.price),
                daily_change: new Decimal(newStock.changePercent),
            },
            create: {
                ticker: newStock.ticker,
                name: newStock.name,
                price: new Decimal(newStock.price),
                daily_change: new Decimal(newStock.changePercent),
                assetType: newStock.assetType || 'ETF',
                currency: 'USD',
            },
        });

        const existingItem = await prisma.portfolioItem.findUnique({
            where: { etfId: newStock.ticker },
        });

        if (existingItem) {
            return NextResponse.json({ message: 'Item already in portfolio' }, { status: 200 });
        }

        const currentCount = await prisma.portfolioItem.count();
        const newCount = currentCount + 1;
        const evenWeight = new Decimal(100).dividedBy(newCount);

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
        if (weight !== undefined) updateData.weight = new Decimal(weight);
        if (shares !== undefined) updateData.shares = new Decimal(shares);

        // We return the updated item. Prisma returns Decimals.
        // We should format this back to number/string for the frontend.
        const updatedItem = await prisma.portfolioItem.update({
            where: { etfId: ticker },
            data: updateData,
        });

        const formattedItem = {
            ...updatedItem,
            weight: Number(updatedItem.weight),
            shares: Number(updatedItem.shares)
        };

        return NextResponse.json(formattedItem);
    } catch (error) {
        console.error('[API] Error updating portfolio item:', error);
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

        await prisma.portfolioItem.delete({
            where: { etfId: ticker },
        });

        const currentCount = await prisma.portfolioItem.count();

        if (currentCount > 0) {
            const evenWeight = new Decimal(100).dividedBy(currentCount);
            await prisma.portfolioItem.updateMany({
                data: { weight: evenWeight },
            });
        }

        return NextResponse.json({ message: 'Stock removed successfully' });
    } catch (error) {
        console.error('[API] Error removing stock from portfolio:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
