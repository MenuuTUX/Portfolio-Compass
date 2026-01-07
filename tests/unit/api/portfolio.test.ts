
import { describe, it, expect, mock } from 'bun:test';
import { Decimal } from '@/lib/decimal';

// Define mocks before importing the module under test

// Mock next-auth
const mockGetServerSession = mock(() => Promise.resolve({
    user: { id: 'test-user-id', name: 'Test User' }
}));

mock.module('next-auth', () => ({
    getServerSession: mockGetServerSession
}));

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

// Mock lib/auth
mock.module('@/lib/auth', () => ({
    authOptions: {}
}));

// Import after mocks
const { GET } = await import('@/app/api/portfolio/route');

describe('Portfolio API', () => {
    it('returns formatted portfolio items with optimized sector reduction for authenticated user', async () => {
        const response = await GET();

        // If unauthorized, it returns { error: 'Unauthorized' }
        if (response.status === 401) {
            console.error('Test returned 401 Unauthorized. Mock session might not be working.');
        }

        const data = response.body;

        expect(data).toHaveLength(1);
        const item = data[0];

        expect(item.ticker).toBe('SPY');
        expect(item.sectors).toEqual({
            'Technology': 0.30,
            'Financials': 0.15
        });
        expect(item.allocation.equities).toBe(0.99);

        // Verify that findMany was called with the user ID
        expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                userId: 'test-user-id'
            }
        }));
    });
});
