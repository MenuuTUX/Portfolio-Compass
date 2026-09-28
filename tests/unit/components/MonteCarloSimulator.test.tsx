import { describe, it, expect, afterEach } from 'bun:test';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { Portfolio, PortfolioItem } from '@/types';
import * as matchers from '@testing-library/jest-dom/matchers';
import { mockModule } from '@/tests/helpers/mock-module';

expect.extend(matchers);

let capturedSimulation: { prices: number[]; weights: number[] } | null = null;
let capturedReturnPrices: number[][] = [];

// Mock rechart components to avoid rendering issues in test env
await mockModule('recharts', () => ({
    AreaChart: () => <div />,
    Area: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    LineChart: () => <div />,
    Line: () => <div />,
    ComposedChart: () => <div />,
}));

// Mock Monte Carlo calculations
await mockModule('@/lib/monte-carlo', () => ({
    calculateLogReturns: (prices: number[]) => {
        capturedReturnPrices.push(prices);
        return prices.slice(1).map((price, index) => Math.log(price / prices[index]));
    },
    calculateCovarianceMatrix: (returns: number[][]) => returns.map(() => returns.map(() => 0.0001)),
    getCholeskyDecomposition: (matrix: number[][]) => matrix.map((row, index) => row.map((_, column) => index === column ? 1 : 0)),
    generateMonteCarloPaths: (prices: number[], weights: number[], _means: number[], _cholesky: number[][], count: number, days: number, initial: number) => {
        capturedSimulation = { prices, weights };
        return Array.from({ length: count }, () => Array.from({ length: days + 1 }, () => initial));
    },
    calculateCone: () => ({
        median: [],
        p05: [],
        p95: [],
        dates: []
    }),
}));

// Mock Decimal
await mockModule('decimal.js', () => ({
    Decimal: class {
        constructor(val: any) { }
        toNumber() { return 0; }
    }
}));

// Import component after mocks
import MonteCarloSimulator from '@/components/simulation/MonteCarloSimulator';

describe('MonteCarloSimulator', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        capturedSimulation = null;
        capturedReturnPrices = [];
    });

    const mockPortfolio: Portfolio = [
        {
            ticker: 'AAPL',
            name: 'Apple Inc.',
            price: 150,
            currency: 'USD',
            quoteAsOf: new Date().toISOString(),
            daily_change: 1.5,
            history: [],
            shares: 10,
            weight: 0.5
        } as unknown as PortfolioItem,
        {
            ticker: 'MSFT',
            name: 'Microsoft',
            price: 300,
            currency: 'USD',
            quoteAsOf: new Date().toISOString(),
            daily_change: 2.0,
            history: [],
            shares: 5,
            weight: 0.5
        } as unknown as PortfolioItem
    ];

    it('renders correctly with initial state', () => {
        render(<MonteCarloSimulator portfolio={mockPortfolio} />);

        // Check for header
        expect(screen.getByText('Monte Carlo Simulation')).toBeInTheDocument();

        // Check for inputs
        expect(screen.getByText('Investment')).toBeInTheDocument();
        const input = screen.getByDisplayValue('3000'); // 150*10 + 300*5
        expect(input).toBeInTheDocument();

        // Check for action button
        expect(screen.getByText('Run simulation')).toBeInTheDocument();
    });

    it('states that outcomes are price-only buy-and-hold scenarios without contributions', () => {
        render(<MonteCarloSimulator portfolio={mockPortfolio} />);

        expect(screen.getByText(/not forecasts or calibrated probabilities/i)).toBeInTheDocument();
        expect(screen.getByText(/buy-and-hold portfolio\. Recurring contributions, withdrawals, rebalancing/i)).toBeInTheDocument();
    });

    it('blocks simulation when aligned history is insufficient', async () => {
        globalThis.fetch = (async () => new Response(JSON.stringify({ series: {} }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })) as unknown as typeof fetch;

        render(<MonteCarloSimulator portfolio={mockPortfolio} />);
        fireEvent.click(screen.getByText('Run simulation'));

        expect(await screen.findByText(/needs at least 200 aligned daily returns/)).toBeInTheDocument();
    });

    it('does not invent a starting balance or fetch history for a stale valuation', async () => {
        let fetchCalled = false;
        const trackedFetch = Object.assign(async (_input: RequestInfo | URL, _init?: RequestInit) => {
            fetchCalled = true;
            return new Response(JSON.stringify({ series: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }, { preconnect: () => undefined }) as typeof fetch;
        globalThis.fetch = trackedFetch;
        const stalePortfolio = mockPortfolio.map((item) => ({
            ...item,
            quoteAsOf: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        })) as Portfolio;

        render(<MonteCarloSimulator portfolio={stalePortfolio} />);

        expect(screen.getByDisplayValue('0')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Run simulation'));

        expect(await screen.findByText('Simulation requires a positive valued portfolio.')).toBeInTheDocument();
        expect(fetchCalled).toBe(false);
    });

    it('rejects stale quotes even when a starting balance is supplied', async () => {
        let fetchCalled = false;
        globalThis.fetch = (async () => {
            fetchCalled = true;
            return new Response(JSON.stringify({ series: {} }), { status: 200 });
        }) as unknown as typeof fetch;
        const stalePortfolio = mockPortfolio.map((item) => ({
            ...item,
            quoteAsOf: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        })) as Portfolio;

        render(<MonteCarloSimulator portfolio={stalePortfolio} startingValue={3000} />);
        fireEvent.click(screen.getByText('Run simulation'));

        expect(await screen.findByText(/requires fresh, complete quotes/)).toBeInTheDocument();
        expect(fetchCalled).toBe(false);
    });

    it('excludes zero-share rows from quote checks and history requests', async () => {
        let requestedUrl = '';
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            requestedUrl = String(input);
            return new Response(JSON.stringify({ series: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }) as unknown as typeof fetch;
        const withWatchlistRow = [
            mockPortfolio[0],
            { ...mockPortfolio[1], shares: 0, price: 0, history: [] },
        ] as Portfolio;

        render(<MonteCarloSimulator portfolio={withWatchlistRow} />);
        fireEvent.click(screen.getByText('Run simulation'));

        expect(await screen.findByText(/needs at least 200 aligned daily returns/)).toBeInTheDocument();
        expect(requestedUrl).toContain('tickers=AAPL');
        expect(requestedUrl).not.toContain('MSFT');
    });

    it('fails closed when mixed currency history has no dated FX coverage', async () => {
        const dates = Array.from({ length: 220 }, (_, index) => {
            const date = new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10);
            return { date, price: 100 + index / 10 };
        });
        let fxRequested = false;
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            fxRequested = String(input).includes('/api/market/fx-history');
            return new Response(JSON.stringify({ series: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }) as unknown as typeof fetch;
        const mixed = [
            { ...mockPortfolio[0], currency: 'CAD', history: dates },
            { ...mockPortfolio[1], currency: 'USD', history: dates },
        ] as Portfolio;
        render(<MonteCarloSimulator
            portfolio={mixed}
            baseCurrency="CAD"
            startingValue={3000}
            fxProvenance={{ date: new Date().toISOString().slice(0, 10), usdCad: 1.35 }}
        />);
        fireEvent.click(screen.getByText('Run simulation'));

        expect(await screen.findByText('Historical FX does not cover every held price observation.')).toBeInTheDocument();
        expect(fxRequested).toBe(true);
    });

    it('models mixed holdings from historical and current CAD-converted prices', async () => {
        const dates = Array.from({ length: 220 }, (_, index) => {
            const date = new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10);
            return { date, price: 100 + index };
        });
        const fxSeries = Array.from({ length: 230 }, (_, index) => {
            const date = new Date(Date.UTC(2024, 11, 22 + index)).toISOString().slice(0, 10);
            return { date, usdCad: 1.1 + index / 1000 };
        });
        globalThis.fetch = (async () => new Response(JSON.stringify({ series: fxSeries }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })) as unknown as typeof fetch;
        const mixed = [
            { ...mockPortfolio[0], currency: 'CAD', price: 100, shares: 2, history: dates },
            { ...mockPortfolio[1], currency: 'USD', price: 100, shares: 1, history: dates },
        ] as Portfolio;
        render(<MonteCarloSimulator
            portfolio={mixed}
            baseCurrency="CAD"
            startingValue={335}
            fxProvenance={{ date: new Date().toISOString().slice(0, 10), usdCad: 1.35 }}
        />);
        fireEvent.click(screen.getByText('Run simulation'));

        await waitFor(() => expect(capturedSimulation).not.toBeNull());
        expect(capturedSimulation!.prices).toEqual([100, 135]);
        expect(capturedSimulation!.weights[0]).toBeCloseTo(200 / 335);
        expect(capturedSimulation!.weights[1]).toBeCloseTo(135 / 335);
        expect(capturedReturnPrices[0][0]).toBe(100);
        expect(capturedReturnPrices[1][0]).toBeCloseTo(111);
        expect(capturedReturnPrices[2][0]).toBeCloseTo(311);
    });

    it('uses the held portfolio value path for sample return statistics', async () => {
        const dates = Array.from({ length: 220 }, (_, index) =>
            new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10));
        const oppositeMoves = [
            { ...mockPortfolio[0], shares: 1, price: 100, history: dates.map((date, index) => ({ date, price: index === 219 ? 110 : 100 })) },
            { ...mockPortfolio[1], shares: 1, price: 100, history: dates.map((date, index) => ({ date, price: index === 219 ? 90 : 100 })) },
        ] as Portfolio;

        render(<MonteCarloSimulator portfolio={oppositeMoves} />);
        fireEvent.click(screen.getByText('Run simulation'));

        await waitFor(() => expect(capturedSimulation).not.toBeNull());
        expect(capturedReturnPrices[2]).toEqual(Array(220).fill(200));
    });
});
