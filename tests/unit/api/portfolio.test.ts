
import { describe, it, expect, mock } from 'bun:test';
import { GET } from '@/app/api/portfolio/route';
import { Decimal } from '@/lib/decimal';

// Mock prisma
const mockFindMany = mock(() => Promise.resolve([
    {
        weight: new Decimal(0.5),
        shares: new Decimal(10),
        etf: {
            ticker: 'SPY',
            name: 'SPDR S&P 500 ETF Trust',
            price: new Decimal(450.00),
            daily_change: new Decimal(0.01),
            assetType: 'ETF',
            sectors: [
                { sector_name: 'Technology', weight: new Decimal(0.30) },
                { sector_name: 'Financials', weight: new Decimal(0.15) }
            ],
            allocation: {
                stocks_weight: new Decimal(0.99),
                bonds_weight: new Decimal(0.00),
                cash_weight: new Decimal(0.01)
            },
            holdings: [],
            history: []
        }
    }
]));

mock.module('@/lib/db', () => ({
    default: {
        portfolioItem: {
            findMany: mockFindMany
        }
    }
}));

// Mock NextResponse
mock.module('next/server', () => ({
    NextResponse: {
        json: (body: any, options?: any) => ({ body, status: options?.status || 200 })
    }
}));

describe('Portfolio API', () => {
    it('returns formatted portfolio items with optimized sector reduction', async () => {
        // Mock request with user ID
        const req = new Request('http://localhost/api/portfolio', {
            headers: { 'x-user-id': 'user123' }
        });

        const response = await GET(req);
        const data = response.body;

        expect(data).toHaveLength(1);
        const item = data[0];

        expect(item.ticker).toBe('SPY');
        expect(item.sectors).toEqual({
            'Technology': 0.30,
            'Financials': 0.15
        });
        expect(item.allocation.equities).toBe(0.99);
    });

    it('returns 401 Unauthorized when x-user-id header is missing', async () => {
        const req = new Request('http://localhost/api/portfolio');
        const response = await GET(req);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Unauthorized' });
    });
});
