import { describe, it, expect, afterEach } from 'bun:test';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { Portfolio, PortfolioItem } from '@/types';
import * as matchers from '@testing-library/jest-dom/matchers';
import { mockModule } from '@/tests/helpers/mock-module';

expect.extend(matchers);

let capturedSimulation: { prices: number[]; weights: number[]; mode: string; blockDays?: number; seed?: number } | null = null;
let capturedModes: string[] = [];
let capturedReturnPrices: number[][] = [];
let breakCovariance = false;

const realMonteCarlo = { ...(await import('@/lib/monte-carlo')) };

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

// The share card renders next/image, which happy-dom cannot load.
await mockModule('@/components/PortfolioShareButton', () => ({
    PortfolioShareButton: () => <button type="button">Share</button>,
}));

// Capture the inputs and delegate to the real engine.
await mockModule('@/lib/monte-carlo', () => ({
    ...realMonteCarlo,
    calculateLogReturns: (prices: number[]) => {
        capturedReturnPrices.push(prices);
        return prices.slice(1).map((price, index) => Math.log(price / prices[index]));
    },
    calculateCovarianceMatrix: (returns: number[][]) =>
        returns.map((_, i) => returns.map((__, j) => breakCovariance ? (i === j ? -1 : 0) : (i === j ? 0.0002 : 0.0001))),
    simulatePaths: (mode: any, input: any) => {
        capturedSimulation = { prices: input.currentPrices, weights: input.weights, mode, blockDays: input.blockDays, seed: input.seed };
        capturedModes.push(mode);
        return realMonteCarlo.simulatePaths(mode, input);
    },
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
        capturedModes = [];
        capturedReturnPrices = [];
        breakCovariance = false;
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

    describe('return basis', () => {
        const dates = Array.from({ length: 220 }, (_, index) =>
            new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10));
        const flat = (extra?: (index: number) => object) =>
            dates.map((date, index) => ({ date, price: 100, ...(extra?.(index) ?? {}) }));

        it('refetches price-only stored history with adjusted closes and reports total return', async () => {
            let requestedUrl = '';
            globalThis.fetch = (async (input: RequestInfo | URL) => {
                requestedUrl = String(input);
                const series = Object.fromEntries(['AAPL', 'MSFT'].map((ticker) => [
                    ticker,
                    flat((index) => ({ adjPrice: 100 * Math.pow(1.0003, index) })),
                ]));
                return new Response(JSON.stringify({ series }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }) as unknown as typeof fetch;
            const priceOnly = mockPortfolio.slice(0, 2).map((item) => ({ ...item, shares: 1, price: 100, history: flat() })) as Portfolio;

            render(<MonteCarloSimulator portfolio={priceOnly} />);
            fireEvent.click(screen.getByText('Run simulation'));

            expect(await screen.findByText(/distributions reinvested/)).toBeInTheDocument();
            expect(requestedUrl).toContain('adjusted=1');
        });

        it('runs on stored price history and says so when the adjusted refetch fails', async () => {
            globalThis.fetch = (async () => new Response('{}', { status: 502 })) as unknown as typeof fetch;
            const priceOnly = mockPortfolio.slice(0, 2).map((item) => ({ ...item, shares: 1, price: 100, history: flat() })) as Portfolio;

            render(<MonteCarloSimulator portfolio={priceOnly} />);
            fireEvent.click(screen.getByText('Run simulation'));

            expect(await screen.findByText(/price returns only \(adjusted closes unavailable/)).toBeInTheDocument();
        });
    });

    describe('simulation modes', () => {
        const dates = Array.from({ length: 230 }, (_, index) =>
            new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10));
        // Deterministic bumpy history with both up and down days.
        const bumpy = (phase: number) => {
            let price = 100;
            return dates.map((date, index) => {
                price *= 1 + 0.02 * Math.sin(index * 1.7 + phase) + 0.0004;
                return { date, price, adjPrice: price };
            });
        };
        const portfolio = () => mockPortfolio.slice(0, 2).map((item, i) => ({
            ...item, shares: 1, price: 100, history: bumpy(i),
        })) as Portfolio;

        const runOnce = async () => {
            let fetches = 0;
            globalThis.fetch = (async () => {
                fetches++;
                return new Response('{}', { status: 502 });
            }) as unknown as typeof fetch;
            const view = render(<MonteCarloSimulator portfolio={portfolio()} />);
            fireEvent.click(screen.getByText('Run simulation'));
            await screen.findByText('Typical ending');
            return { view, fetchCount: () => fetches };
        };

        it('defaults to Resample and explains it in one line', () => {
            render(<MonteCarloSimulator portfolio={portfolio()} />);
            expect(screen.getByRole('tab', { name: /Resample/ })).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByText(/Real past days picked at random, with repeats/)).toBeInTheDocument();
        });

        it('shows the four callouts after a run', async () => {
            await runOnce();
            expect(capturedSimulation!.mode).toBe('resample');
            for (const label of ['Typical ending', 'Range', 'Chance of loss', 'Worst drop']) {
                expect(screen.getByText(label)).toBeInTheDocument();
            }
            expect(screen.getByText('8 in 10 paths finished between these')).toBeInTheDocument();
        });

        it('switches to Reshuffle without refetching history and keeps the seed base', async () => {
            const { fetchCount } = await runOnce();
            const before = fetchCount();
            const resampleSeed = capturedSimulation!.seed!;
            fireEvent.click(screen.getByRole('tab', { name: /Reshuffle/ }));
            expect(await screen.findByText('Every order ends at this value')).toBeInTheDocument();
            expect(screen.getByText('Halfway range')).toBeInTheDocument();
            expect(screen.getByText('Dipped below start')).toBeInTheDocument();
            expect(fetchCount()).toBe(before);
            // Stats run seed is the drawn seed + 1; mode offsets differ by 1000.
            expect(capturedSimulation!.mode).toBe('reshuffle');
            expect(capturedSimulation!.seed! - resampleSeed).toBe(1000);
        });

        it('shows a histogram with loss-colored bars for Randomize', async () => {
            const { view } = await runOnce();
            fireEvent.click(screen.getByRole('tab', { name: /Randomize/ }));
            expect(await screen.findByText(/paths ended$/)).toBeInTheDocument();
            const bars = view.container.querySelectorAll('rect[fill="var(--loss)"]');
            expect(bars.length).toBeGreaterThan(0);
        });

        it('compares all three in stacked panels', async () => {
            await runOnce();
            fireEvent.click(screen.getByText('Compare all three'));
            const section = await screen.findByLabelText('All three simulation types');
            await waitFor(() => expect(new Set(capturedModes)).toEqual(new Set(['resample', 'reshuffle', 'randomize'])));
            for (const name of ['Reshuffle', 'Resample', 'Randomize']) {
                expect(section.querySelector('h3')?.parentElement?.parentElement?.parentElement?.textContent).toContain(name);
            }
            expect(section.querySelectorAll('h3').length).toBe(3);
        });

        it('keeps Resample and Reshuffle when the covariance cannot be factored', async () => {
            breakCovariance = true;
            await runOnce();
            fireEvent.click(screen.getByRole('tab', { name: /Randomize/ }));
            expect(await screen.findByText(/Randomize is unavailable/)).toBeInTheDocument();
            fireEvent.click(screen.getByRole('tab', { name: /Reshuffle/ }));
            expect(await screen.findByText('Every order ends at this value')).toBeInTheDocument();
        });

        it('applies the Advanced block length on the next run', async () => {
            await runOnce();
            expect(screen.getByText('Paths behind the figures')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: '1 week' }));
            expect(screen.getByText(/settings changed since the last run/)).toBeInTheDocument();
            fireEvent.click(screen.getByText('Run again'));
            await waitFor(() => expect(capturedSimulation!.blockDays).toBe(5));
        });

        it('uses no em dashes in the rendered copy', async () => {
            const { view } = await runOnce();
            expect(view.container.textContent).not.toContain('\u2014');
        });
    });
});
