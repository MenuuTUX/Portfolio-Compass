import { describe, it, expect, afterEach } from 'bun:test';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor, configure } from '@testing-library/react';
import { Portfolio, PortfolioItem } from '@/types';
import * as matchers from '@testing-library/jest-dom/matchers';
import { mockModule } from '@/tests/helpers/mock-module';
import { observationsPerYear } from '@/lib/math/history';

expect.extend(matchers);

let capturedSimulation: { prices: number[]; weights: number[]; mode: string; blockDays?: number; seed?: number } | null = null;
let capturedModes: string[] = [];
let capturedReturnPrices: number[][] = [];
let breakCovariance = false;
let capturedCalls: Array<{ mode: string; numDays: number; numPaths: number; stepDays?: number; returns: number[][]; contribution?: { amount: number; everyDays: number } }> = [];
let throwMode: string | null = null;

const realMonteCarlo = { ...(await import('@/lib/monte-carlo')) };
const realStats = { ...(await import('@/lib/math/stats')) };

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

await mockModule('@/lib/math/stats', () => ({
    ...realStats,
    calculateLogReturns: (prices: number[]) => {
        capturedReturnPrices.push(prices);
        return prices.slice(1).map((price, index) => Math.log(price / prices[index]));
    },
    calculateCovarianceMatrix: (returns: number[][]) =>
        returns.map((_, i) => returns.map((__, j) => breakCovariance ? (i === j ? -1 : 0) : (i === j ? 0.0002 : 0.0001))),
}));

// Capture the inputs and delegate to the real engine.
await mockModule('@/lib/monte-carlo', () => ({
    ...realMonteCarlo,
    simulatePaths: (mode: any, input: any) => {
        capturedSimulation = { prices: input.currentPrices, weights: input.weights, mode, blockDays: input.blockDays, seed: input.seed };
        capturedModes.push(mode);
        capturedCalls.push({ mode, numDays: input.numDays, numPaths: input.numPaths, stepDays: input.stepDays, returns: input.returns, contribution: input.contribution });
        if (mode === throwMode) throw new RangeError('boom');
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
        capturedCalls = [];
        throwMode = null;
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

        expect(await screen.findByText(/AAPL has only 0 daily returns; the simulator needs 200/)).toBeInTheDocument();
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

        expect(await screen.findByText(/AAPL has only 0 daily returns; the simulator needs 200/)).toBeInTheDocument();
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
        // The third series is the weighted portfolio index, which starts at 1.
        expect(capturedReturnPrices[2][0]).toBeCloseTo(1);
    });

    it('uses the weighted portfolio index for sample return statistics', async () => {
        // Previously this locked the share-count value path (200 flat). The displayed
        // drift and volatility now come from the weighted index the simulation uses.
        const dates = Array.from({ length: 220 }, (_, index) =>
            new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10));
        const oppositeMoves = [
            { ...mockPortfolio[0], shares: 1, price: 100, history: dates.map((date, index) => ({ date, price: index === 219 ? 110 : 100 })) },
            { ...mockPortfolio[1], shares: 1, price: 100, history: dates.map((date, index) => ({ date, price: index === 219 ? 90 : 100 })) },
        ] as Portfolio;

        render(<MonteCarloSimulator portfolio={oppositeMoves} />);
        fireEvent.click(screen.getByText('Run simulation'));

        await waitFor(() => expect(capturedSimulation).not.toBeNull());
        expect(capturedReturnPrices[2].length).toBe(220);
        capturedReturnPrices[2].forEach((value) => expect(value).toBeCloseTo(1, 9));
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

describe('MonteCarloSimulator review fixes', () => {
    // Simulations run several thousand paths per mode; allow more time than the default 1s.
    configure({ asyncUtilTimeout: 5000 });
    const originalFetch = globalThis.fetch;
    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        capturedSimulation = null;
        capturedModes = [];
        capturedReturnPrices = [];
        capturedCalls = [];
        throwMode = null;
        breakCovariance = false;
    });

    const dates = Array.from({ length: 230 }, (_, index) =>
        new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10));
    const holding = (ticker: string, history: any[], shares = 1, price = 100) => ({
        ticker,
        name: ticker,
        price,
        currency: 'USD',
        quoteAsOf: new Date().toISOString(),
        daily_change: 0,
        history,
        shares,
        weight: 0.5,
    }) as unknown as PortfolioItem;
    /** Deterministic bumpy series with both up and down days; `adjusted` adds dividend-adjusted closes. */
    const bumpy = (phase: number, adjusted = true, drift = 0.0004) => {
        let price = 100;
        return dates.map((date, index) => {
            price *= 1 + 0.02 * Math.sin(index * 1.7 + phase) + drift;
            return adjusted ? { date, price, adjPrice: price } : { date, price };
        });
    };
    const unavailableFetch = () => {
        globalThis.fetch = (async () => new Response('{}', { status: 502 })) as unknown as typeof fetch;
    };
    const runSimulation = () => fireEvent.click(screen.getByText('Run simulation'));
    const ppy = Math.max(1, Math.round(observationsPerYear(dates)));

    it('names the past-year assumption and warns when the past year drift is extreme', async () => {
        unavailableFetch();
        const growing = dates.map((date, index) => ({ date, price: 100 * Math.pow(1.003, index), adjPrice: 100 * Math.pow(1.003, index) }));
        render(<MonteCarloSimulator portfolio={[holding('AAPL', growing), holding('MSFT', growing)]} />);
        runSimulation();

        expect(await screen.findByText("Based on the past year's returns, repeated for 10 years.")).toBeInTheDocument();
        expect(screen.getByText(/weak guide to the long run/)).toBeInTheDocument();
    });

    it('applies a long-run return by rebasing the drift and names it', async () => {
        unavailableFetch();
        render(<MonteCarloSimulator portfolio={[holding('AAPL', bumpy(0)), holding('MSFT', bumpy(1))]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Long-run' }));
        runSimulation();

        expect(await screen.findByText(/Assumes a long-run return of 7% a year;/)).toBeInTheDocument();
        expect(document.body.textContent).toContain('Assumes a long-run return of 7% a year; volatility and correlations come from the past year.');
        const call = capturedCalls.find((c) => c.mode === 'resample')!;
        const weights = capturedSimulation!.weights;
        const portfolioDrift = call.returns.reduce((sum, row, i) => sum + weights[i] * (row.reduce((a, b) => a + b, 0) / row.length), 0) * ppy;
        expect(portfolioDrift).toBeCloseTo(Math.log(1.07), 6);
    });

    it('says returns exclude dividends next to the result when a holding lacks adjusted closes', async () => {
        unavailableFetch();
        render(<MonteCarloSimulator portfolio={[holding('AAPL', bumpy(0, false)), holding('MSFT', bumpy(1))]} />);
        runSimulation();

        expect(await screen.findByText('Returns exclude dividends because AAPL has no dividend-adjusted history.')).toBeInTheDocument();
    });

    it('explains a too-short history by ticker', async () => {
        unavailableFetch();
        const short = dates.slice(0, 200).map((date, index) => ({ date, price: 100 + index, adjPrice: 100 + index }));
        render(<MonteCarloSimulator portfolio={[holding('AAPL', short), holding('MSFT', bumpy(1))]} />);
        runSimulation();

        expect(await screen.findByText(/AAPL has only \d+ daily returns; the simulator needs 200\./)).toBeInTheDocument();
    });

    it('explains a gap in the price history by ticker', async () => {
        const gappy = bumpy(0).filter((_, index) => index < 100 || index >= 115);
        globalThis.fetch = (async () => new Response(JSON.stringify({ series: { AAPL: gappy } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })) as unknown as typeof fetch;
        render(<MonteCarloSimulator portfolio={[holding('AAPL', []), holding('MSFT', bumpy(1))]} />);
        runSimulation();

        expect(await screen.findByText(/AAPL has a gap of \d+ days in its price history\./)).toBeInTheDocument();
    });

    it('keeps a starting balance the user typed when live quotes re-sync', async () => {
        const portfolio = [holding('AAPL', []), holding('MSFT', [])];
        const { rerender } = render(<MonteCarloSimulator portfolio={portfolio} startingValue={3000} />);
        const input = screen.getByLabelText(/Starting balance/) as HTMLInputElement;
        fireEvent.change(input, { target: { value: '5000' } });

        rerender(<MonteCarloSimulator portfolio={portfolio} startingValue={101} />);
        expect((screen.getByLabelText(/Starting balance/) as HTMLInputElement).value).toBe('5000');

        fireEvent.click(screen.getByText('Use my portfolio value'));
        expect((screen.getByLabelText(/Starting balance/) as HTMLInputElement).value).toBe('101');
    });

    it('measures the displayed drift from the weighted index, not share counts', async () => {
        unavailableFetch();
        const flatDates = dates.slice(0, 220);
        const last = flatDates.map((date, index) => ({ date, price: index === 219 ? 110 : 100 }));
        const flat = flatDates.map((date) => ({ date, price: 100 }));
        // AAPL is 10% of the value, MSFT 90%: the index ends at 0.1 * 1.1 + 0.9 = 1.01.
        render(<MonteCarloSimulator portfolio={[
            { ...holding('AAPL', last, 1, 100) },
            { ...holding('MSFT', flat, 9, 100) },
        ]} />);
        runSimulation();

        await waitFor(() => expect(capturedReturnPrices.length).toBeGreaterThanOrEqual(3));
        expect(capturedReturnPrices[2][219]).toBeCloseTo(1.01, 9);
    });

    it('uses the observed periods per year for every mode and horizon', async () => {
        unavailableFetch();
        render(<MonteCarloSimulator portfolio={[holding('AAPL', bumpy(0)), holding('MSFT', bumpy(1))]} />);
        fireEvent.click(screen.getByText('Compare all three'));
        runSimulation();

        await waitFor(() => expect(new Set(capturedModes)).toEqual(new Set(['resample', 'reshuffle', 'randomize'])));
        expect(capturedCalls.length).toBeGreaterThan(0);
        for (const call of capturedCalls) expect(call.numDays).toBe(10 * ppy);
    });

    it('reports a failing mode on its own and keeps the other modes', async () => {
        unavailableFetch();
        throwMode = 'resample';
        render(<MonteCarloSimulator portfolio={[holding('AAPL', bumpy(0)), holding('MSFT', bumpy(1))]} />);
        fireEvent.click(screen.getByText('Compare all three'));
        runSimulation();

        expect(await screen.findByText('Resample could not run: boom.')).toBeInTheDocument();
        // Reshuffle and Randomize still finish after Resample fails.
        await waitFor(() => expect(screen.getAllByText(/^Typical /).length).toBe(2));
    });

    it('blames the covariance only for a covariance failure in Randomize', async () => {
        unavailableFetch();
        throwMode = 'randomize';
        render(<MonteCarloSimulator portfolio={[holding('AAPL', bumpy(0)), holding('MSFT', bumpy(1))]} />);
        runSimulation();
        expect(await screen.findByText('Typical ending')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: /Randomize/ }));

        expect(await screen.findByText('Randomize could not run: boom.')).toBeInTheDocument();
        expect(screen.queryByText(/Randomize is unavailable/)).toBeNull();
    });

    it('records the Randomize drawn run on the largest step that divides the horizon', async () => {
        unavailableFetch();
        render(<MonteCarloSimulator portfolio={[holding('AAPL', bumpy(0)), holding('MSFT', bumpy(1))]} />);
        fireEvent.click(screen.getByRole('tab', { name: /Randomize/ }));
        runSimulation();

        await waitFor(() => expect(capturedCalls.some((c) => c.mode === 'randomize')).toBe(true));
        const drawn = capturedCalls.find((c) => c.mode === 'randomize' && c.numPaths === 50)!;
        const expected = [45, 42, 36, 30, 28, 21, 14, 7, 6, 5, 4, 3, 2, 1].find((s) => (10 * ppy) % s === 0);
        expect(drawn.stepDays).toBe(expected);
    });

    it('removes a single-day price jump and says how many were ignored', async () => {
        unavailableFetch();
        const jumpy = bumpy(0).map((point, index) => (index >= 100
            ? { ...point, price: point.price * 10, adjPrice: point.adjPrice === undefined ? undefined : point.adjPrice * 10 }
            : point));
        render(<MonteCarloSimulator portfolio={[holding('AAPL', jumpy), holding('MSFT', bumpy(1))]} />);
        runSimulation();

        expect(await screen.findByText(/1 unusual price jump was ignored\./)).toBeInTheDocument();
    });

    it('asks for a balance above 0 when the typed starting balance is 0', async () => {
        render(<MonteCarloSimulator portfolio={[holding('AAPL', []), holding('MSFT', [])]} startingValue={3000} />);
        fireEvent.change(screen.getByLabelText(/Starting balance/), { target: { value: '0' } });
        runSimulation();

        expect(await screen.findByText('Enter a starting balance above 0 to run the simulation.')).toBeInTheDocument();
        expect(screen.queryByText(/Enter share counts/)).toBeNull();
    });

    it('says none of the paths lost money instead of showing 0%', async () => {
        unavailableFetch();
        const rising = dates.map((date, index) => ({ date, price: 100 * Math.pow(1.005, index), adjPrice: 100 * Math.pow(1.005, index) }));
        render(<MonteCarloSimulator portfolio={[holding('AAPL', rising), holding('MSFT', rising)]} />);
        runSimulation();

        expect(await screen.findByText('None of the 2,000 simulated paths ended below where they started')).toBeInTheDocument();
    });

    it('shows a today\'s-money view when inflation is set', async () => {
        unavailableFetch();
        render(<MonteCarloSimulator portfolio={[holding('AAPL', bumpy(0)), holding('MSFT', bumpy(1))]} inflationPercent={10} />);
        runSimulation();

        const toggle = await screen.findByRole('button', { name: "Show in today's money" });
        const before = document.querySelector('.text-4xl')?.textContent;
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText(/Values are in today's money/)).toBeInTheDocument();
        expect(document.querySelector('.text-4xl')?.textContent).not.toBe(before);
    });

    it('shares the paths that reach a goal', async () => {
        unavailableFetch();
        render(<MonteCarloSimulator portfolio={[holding('AAPL', bumpy(0)), holding('MSFT', bumpy(1))]} goalAmount={1_000_000_000} />);
        runSimulation();

        expect(await screen.findByText('None of the 2,000 simulated paths ended at or above this amount')).toBeInTheDocument();
    });

    it('includes a monthly contribution in every run and says so', async () => {
        unavailableFetch();
        render(<MonteCarloSimulator portfolio={[holding('AAPL', bumpy(0)), holding('MSFT', bumpy(1))]} monthlyContribution={500} />);
        runSimulation();

        expect(await screen.findByText(/Includes a contribution of .*500.* a month\./)).toBeInTheDocument();
        const runs = capturedCalls.filter((c) => c.mode === 'resample');
        expect(runs.length).toBe(2);
        for (const run of runs) {
            expect(run.contribution).toEqual({ amount: 500, everyDays: Math.round(ppy / 12) });
        }
    });
});
