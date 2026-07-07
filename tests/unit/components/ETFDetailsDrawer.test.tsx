import { describe, it, expect, mock, afterEach, beforeEach } from 'bun:test';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { ETF } from '@/types';
import * as matchers from '@testing-library/jest-dom/matchers';
import { mockModule } from '@/tests/helpers/mock-module';

expect.extend(matchers);

// Mock recharts to avoid ResponsiveContainer sizing issues in happy-dom
await mockModule('recharts', () => ({
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    AreaChart: () => <div data-testid="area-chart" />,
    Area: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
}));

// next/image resolves remote loader URLs, which happy-dom cannot parse
await mockModule('next/image', () => ({
    default: ({ alt }: any) => <img alt={alt} />,
}));

const { default: ETFDetailsDrawer } = await import('@/components/ETFDetailsDrawer');

// A microcap with no history and no fundamentals — the shape that used to
// render an all-"n/a" metrics wall, an "Unknown" risk badge, and a broken
// empty chart (e.g. NCRA)
const sparseAsset: ETF = {
    ticker: 'NCRA',
    name: 'Nocera, Inc.',
    price: 0.07,
    changePercent: 0,
    assetType: 'STOCK',
    history: [],
    metrics: { mer: 0, yield: 0 },
    allocation: { equities: 0, bonds: 0, cash: 0 },
};

const richStock: ETF = {
    ...sparseAsset,
    ticker: 'AAPL',
    name: 'Apple Inc.',
    price: 150,
    marketCap: 3e12,
    peRatio: 30,
    volume: 50e6,
};

describe('ETFDetailsDrawer sparse-data handling', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        // Drawer fetches fresh data on open; fail fast so isLoading resolves
        global.fetch = mock(() =>
            Promise.reject(new Error('offline test')),
        ) as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        cleanup();
    });

    it('shows a friendly empty state instead of a broken chart when history is missing', async () => {
        render(<ETFDetailsDrawer etf={sparseAsset} onClose={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText('No price history available')).toBeInTheDocument();
        });
    });

    it('shows a single notice instead of a wall of n/a when all metrics are missing', async () => {
        render(<ETFDetailsDrawer etf={sparseAsset} onClose={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText('No detailed metrics available')).toBeInTheDocument();
        });
        expect(screen.queryByText('n/a')).not.toBeInTheDocument();
    });

    it('hides the risk badge when history is too thin to compute risk', async () => {
        render(<ETFDetailsDrawer etf={sparseAsset} onClose={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText('No price history available')).toBeInTheDocument();
        });
        expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
    });

    it('renders available metrics and drops missing ones', async () => {
        render(<ETFDetailsDrawer etf={richStock} onClose={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText('Market Cap')).toBeInTheDocument();
        });
        expect(screen.getByText('3.00T')).toBeInTheDocument();
        expect(screen.getByText('PE Ratio')).toBeInTheDocument();
        // Missing fundamentals should not render as n/a cards
        expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
        expect(screen.queryByText('n/a')).not.toBeInTheDocument();
    });
});
