import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Decimal } from '@/lib/decimal';

export const dynamic = 'force-dynamic';

const safeDecimal = (val: any) => {
    if (Decimal.isDecimal(val)) return val.toNumber();
    if (typeof val === 'string') return parseFloat(val);
    if (typeof val === 'number') return val;
    return 0;
};

export async function GET() {
    try {
        const portfolioItems = await prisma.portfolioItem.findMany({
            include: {
                etf: {
                    include: {
                        sectors: true,
                        allocation: true,
                        holdings: true,
                        history: {
                            orderBy: { date: 'asc' },
                            take: 1 // Minimal history for basic check, or remove if not needed
                        }
                    }
                }
            }
        });

        const formatted = portfolioItems.map(item => {
            const etf = item.etf;
            return {
                ticker: etf.ticker,
                name: etf.name,
                portfolioWeight: safeDecimal(item.weight),
                shares: safeDecimal(item.shares),
                price: safeDecimal(etf.price),
                changePercent: safeDecimal(etf.daily_change),
                assetType: etf.assetType,

                // Optimized sector reduction
                sectors: (() => {
                    const result: Record<string, number> = {};
                    if (etf.sectors) {
                        for (const s of etf.sectors) {
                            result[s.sector_name] = safeDecimal(s.weight);
                        }
                    }
                    return result;
                })(),

                allocation: {
                    equities: etf.allocation?.stocks_weight ? safeDecimal(etf.allocation.stocks_weight) : 0,
                    bonds: etf.allocation?.bonds_weight ? safeDecimal(etf.allocation.bonds_weight) : 0,
                    cash: etf.allocation?.cash_weight ? safeDecimal(etf.allocation.cash_weight) : 0,
                },
                holdings: (etf.holdings || []).map(h => ({
                    ticker: h.ticker,
                    name: h.name,
                    weight: safeDecimal(h.weight),
                    sector: h.sector,
                    shares: h.shares ? safeDecimal(h.shares) : undefined
                }))
            };
        });

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('[API] Portfolio fetch error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
