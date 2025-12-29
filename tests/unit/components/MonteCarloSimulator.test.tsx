import { describe, it, expect, mock, afterEach } from 'bun:test';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { Portfolio, PortfolioItem } from '@/types';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock rechart components to avoid complexity
mock.module('recharts', () => ({
    AreaChart: () => <div>AreaChart</div>,
    Area: () => <div>Area</div>,
    XAxis: () => <div>XAxis</div>,
    YAxis: () => <div>YAxis</div>,
    CartesianGrid: () => <div>CartesianGrid</div>,
    Tooltip: () => <div>Tooltip</div>,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    LineChart: () => <div>LineChart</div>,
    Line: () => <div>Line</div>,
}));

// Mock Monte Carlo calculations
mock.module('@/lib/monte-carlo', () => ({
    calculateLogReturns: () => [],
    calculateCovarianceMatrix: () => [],
    getCholeskyDecomposition: () => [],
    generateMonteCarloPaths: () => [],
    calculateCone: () => ({ median: [], p05: [], p95: [] }),
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
            shares: 10, // Value = 1500
            weight: 0.5
        } as unknown as PortfolioItem,
        {
            ticker: 'MSFT',
            name: 'Microsoft',
            price: 300,
            daily_change: 2.0,
            history: [],
            shares: 5, // Value = 1500
            weight: 0.5
        } as unknown as PortfolioItem
    ];

    it('initializes investment with portfolio value when present', () => {
        // Total value = (150 * 10) + (300 * 5) = 1500 + 1500 = 3000
        render(<MonteCarloSimulator portfolio={mockPortfolio} />);

        const input = screen.getByDisplayValue('3000');
        expect(input).toBeInTheDocument();
    });

    it('initializes investment with 10000 when portfolio value is 0', () => {
        const emptyPortfolio: Portfolio = [];
        render(<MonteCarloSimulator portfolio={emptyPortfolio} />);

        const input = screen.getByDisplayValue('10000');
        expect(input).toBeInTheDocument();
    });

    it('initializes investment with 10000 when portfolio items have no shares', () => {
         const zeroSharesPortfolio: Portfolio = [
            {
                ticker: 'AAPL',
                price: 150,
                shares: 0,
                weight: 0
            } as unknown as PortfolioItem
         ];
        render(<MonteCarloSimulator portfolio={zeroSharesPortfolio} />);

        const input = screen.getByDisplayValue('10000');
        expect(input).toBeInTheDocument();
    });
});
