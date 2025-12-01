import { ETF } from '@/types';

async function testPortfolioApi() {
    const baseUrl = 'http://localhost:3001/api/portfolio';

    console.log('--- Testing GET /api/portfolio ---');
    try {
        const res = await fetch(baseUrl);
        if (!res.ok) throw new Error(`GET failed: ${res.status} ${res.statusText}`);
        const data = await res.json();
        console.log('GET Success. Items:', data.length);
    } catch (error) {
        console.error('GET Error:', error);
    }

    console.log('\n--- Testing POST /api/portfolio ---');
    const mockEtf: ETF = {
        ticker: 'TEST_ETF_' + Math.floor(Math.random() * 1000),
        name: 'Test ETF',
        price: 100,
        changePercent: 1.5,
        assetType: 'ETF',
        history: [],
        metrics: { mer: 0.1, yield: 2.5 },
        allocation: { equities: 100, bonds: 0, cash: 0 },
        sectors: { 'Technology': 100 }
    };

    try {
        const res = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mockEtf),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`POST failed: ${res.status} ${res.statusText} - ${text}`);
        }

        const data = await res.json();
        console.log('POST Success:', data);
    } catch (error) {
        console.error('POST Error:', error);
    }
}

testPortfolioApi();
