import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { GET } from '../../../app/api/proxy/route';
import { NextRequest } from 'next/server';

describe('API: /api/proxy', () => {
    const originalFetch = global.fetch;
    const originalEnv = process.env;

    beforeAll(() => {
        // Mock process.env
        process.env = { ...originalEnv, COINGECKO_API_KEY: 'test-key' };
    });

    it('should return 400 if path is missing', async () => {
        const req = new NextRequest('http://localhost:3000/api/proxy');
        const res = await GET(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('Missing path parameter');
    });

    it('should forward request to CoinGecko with API key', async () => {
        const mockResponse = { bitcoin: { usd: 50000 } };
        global.fetch = mock(async (url, options) => {
            // Verify URL and Headers
            expect(url.toString()).toContain('https://api.coingecko.com/api/v3/simple/price');
            expect(url.toString()).toContain('ids=bitcoin');
            expect((options?.headers as any)['x-cg-demo-api-key']).toBe('test-key');

            return new Response(JSON.stringify(mockResponse), { status: 200 });
        });

        const req = new NextRequest('http://localhost:3000/api/proxy?path=simple/price&ids=bitcoin&vs_currencies=usd');
        const res = await GET(req);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual(mockResponse);

        global.fetch = originalFetch;
    });

    it('should handle upstream errors', async () => {
         global.fetch = mock(async () => {
            return new Response('Rate Limited', { status: 429, statusText: 'Too Many Requests' });
        });

        const req = new NextRequest('http://localhost:3000/api/proxy?path=simple/price');
        const res = await GET(req);

        expect(res.status).toBe(429);
        const data = await res.json();
        expect(data.error).toBe('Upstream error: 429 Too Many Requests');

        global.fetch = originalFetch;
    });
});
