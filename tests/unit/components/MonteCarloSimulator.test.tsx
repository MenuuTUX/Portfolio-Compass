import { describe, it, expect, mock, afterEach } from 'bun:test';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { Portfolio, PortfolioItem } from '@/types';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock rechart components to avoid rendering issues in test env
mock.module('recharts', () => ({
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
mock.module('@/lib/monte-carlo', () => ({
    calculateLogReturns: () => [],
    calculateCovarianceMatrix: () => [],
    getCholeskyDecomposition: () => [],
    generateMonteCarloPaths: () => [],
    calculateCone: () => ({
        median: [],
        p05: [],
        p95: [],
        dates: []
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

    it('renders correctly with initial state', () => {
        render(<MonteCarloSimulator portfolio={mockPortfolio} />);

        // Check for header
        expect(screen.getByText('Monte Carlo Simulation')).toBeInTheDocument();

        // Check for inputs
        expect(screen.getByText('Investment')).toBeInTheDocument();
        const input = screen.getByDisplayValue('3000'); // 150*10 + 300*5
        expect(input).toBeInTheDocument();

        // Check for action button
        expect(screen.getByText('Run Simulation')).toBeInTheDocument();
    });
});
