import { describe, it, expect, mock, afterEach } from 'bun:test';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { Portfolio, PortfolioItem } from '@/types';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock rechart components to verify props
mock.module('recharts', () => ({
    AreaChart: ({ data, children }: any) => <div data-testid="AreaChart" data-chart-data={JSON.stringify(data)}>{children}</div>,
    Area: ({ dataKey }: any) => <div data-testid="Area" data-datakey={dataKey} />,
    XAxis: () => <div data-testid="XAxis" />,
    YAxis: () => <div data-testid="YAxis" />,
    CartesianGrid: () => <div data-testid="CartesianGrid" />,
    Tooltip: () => <div data-testid="Tooltip" />,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    LineChart: ({ data, children }: any) => <div data-testid="LineChart" data-chart-data={JSON.stringify(data)}>{children}</div>,
    Line: ({ dataKey }: any) => <div data-testid="Line" data-datakey={dataKey} />,
}));

// Mock Monte Carlo calculations
mock.module('@/lib/monte-carlo', () => ({
    calculateLogReturns: () => [],
    calculateCovarianceMatrix: () => [],
    getCholeskyDecomposition: () => [],
    generateMonteCarloPaths: () => [],
    calculateCone: () => ({
        median: [1000, 1100, 1200],
        p05: [900, 950, 1000],
        p95: [1100, 1250, 1400],
        dates: [0, 1, 2]
    }),
}));

// Mock Decimal
mock.module('decimal.js', () => ({
    Decimal: class {
        constructor(val: any) { }
        toNumber() { return 0; }
    }
}));

// Import component after mocks
import MonteCarloSimulator from '@/components/simulation/MonteCarloSimulator';

describe('MonteCarloSimulator', () => {
    afterEach(() => {
        cleanup();
    });

    const mockPortfolio: Portfolio = [
        {
            ticker: 'AAPL',
            name: 'Apple Inc.',
            price: 150,
            daily_change: 1.5,
            history: [],
            shares: 10,
            weight: 0.5
        } as unknown as PortfolioItem,
        {
            ticker: 'MSFT',
            name: 'Microsoft',
            price: 300,
            daily_change: 2.0,
            history: [],
            shares: 5,
            weight: 0.5
        } as unknown as PortfolioItem
    ];

    it('initializes investment with portfolio value when present', () => {
        render(<MonteCarloSimulator portfolio={mockPortfolio} />);
        const input = screen.getByDisplayValue('3000'); // 150*10 + 300*5
        expect(input).toBeInTheDocument();
    });

    it('passes correct data to the chart', async () => {
        render(<MonteCarloSimulator portfolio={mockPortfolio} />);

        // Wait for simulation/rendering if necessary (though our mocks are synchronous)
        const chart = screen.getByTestId('AreaChart');
        expect(chart).toBeInTheDocument();

        // Parse the data passed to AreaChart
        const dataAttr = chart.getAttribute('data-chart-data');
        expect(dataAttr).toBeTruthy();

        const data = JSON.parse(dataAttr!);
        // Check if data matches the structure returned by calculateCone mock
        // dates: [0, 1, 2], median: [1000, 1100, 1200], etc.
        // The component likely transforms this into an array of objects for Recharts
        expect(data).toHaveLength(3);
        expect(data[0]).toHaveProperty('median', 1000);
        expect(data[0]).toHaveProperty('p05', 900);
        expect(data[0]).toHaveProperty('p95', 1100);
    });

    it('renders simulation lines', () => {
        render(<MonteCarloSimulator portfolio={mockPortfolio} />);

        // Check for specific Areas/Lines
        const areas = screen.getAllByTestId('Area');
        // We expect at least one Area for the cone (usually range)
        expect(areas.length).toBeGreaterThan(0);

        const lines = screen.getAllByTestId('Line');
        // We expect a line for the median
        const medianLine = lines.find(l => l.getAttribute('data-datakey') === 'median');
        expect(medianLine).toBeTruthy();
    });
});
