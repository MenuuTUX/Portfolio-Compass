import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import * as ResizeObserverModule from 'happy-dom/lib/resize-observer/ResizeObserver';

// Mock ResizeObserver for Recharts
global.ResizeObserver = ResizeObserverModule.default;

// Mock Recharts ResponsiveContainer to render children immediately
mock.module('recharts', () => {
    return {
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div className="recharts-responsive-container">{children}</div>,
        PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
        Pie: ({ children, data }: { children: React.ReactNode, data: any[] }) => <div data-testid="pie-component">{children}</div>,
        Cell: () => <div data-testid="pie-cell" />,
        Tooltip: () => <div data-testid="tooltip" />,
        BarChart: ({ children, data }: { children: React.ReactNode, data: any[] }) => (
            <div data-testid="bar-chart">
                 {/* Render logic to verify data passing */}
                 {data.map((d: any, i: number) => (
                    <div key={i} data-testid="bar-chart-item">{d.name}: {d.weight}</div>
                 ))}
                 {children}
            </div>
        ),
        Bar: () => <div data-testid="bar" />,
        XAxis: () => <div data-testid="x-axis" />,
        YAxis: () => <div data-testid="y-axis" />,
        CartesianGrid: () => <div data-testid="grid" />,
        ReferenceLine: () => <div data-testid="ref-line" />,
        Sector: () => <div data-testid="sector" />
    };
});

// Import components after mocks
import SectorPieChart from '../../../components/SectorPieChart';
import PortfolioBarChart from '../../../components/PortfolioBarChart';

describe('Visualization Components', () => {

    describe('SectorPieChart', () => {
        it('renders with data', () => {
            const data = [
                { name: 'Technology', value: 50 },
                { name: 'Healthcare', value: 50 }
            ];

            render(<SectorPieChart data={data} />);

            const chart = screen.getByTestId('pie-chart');
            expect(chart).toBeTruthy();

            // Check for Cells (mocked)
            const cells = screen.getAllByTestId('pie-cell');
            expect(cells.length).toBe(2);

            // Verify table for accessibility
            const table = screen.getByRole('table');
            expect(table).toBeTruthy();
            expect(screen.getByText('Technology')).toBeTruthy();
        });

        it('renders empty state', () => {
             render(<SectorPieChart data={[]} />);
             expect(screen.getByText('No sector data available')).toBeTruthy();
        });
    });

    describe('PortfolioBarChart', () => {
        it('renders with portfolio items', () => {
            const portfolio = [
                {
                    ticker: 'AAPL',
                    weight: 50,
                    price: 150,
                    shares: 10,
                    changePercent: 1.5,
                    history: [],
                    metrics: { mer: 0, yield: 0 },
                    allocation: { equities: 100, bonds: 0, cash: 0 }
                },
                {
                    ticker: 'GOOGL',
                    weight: 40,
                    price: 2800,
                    shares: 5,
                    changePercent: -0.5,
                    history: [],
                    metrics: { mer: 0, yield: 0 },
                    allocation: { equities: 100, bonds: 0, cash: 0 }
                }
            ];

            render(<PortfolioBarChart portfolio={portfolio} />);

            expect(screen.getByText('Portfolio Allocation (Equity vs Cash)')).toBeTruthy();
            expect(screen.getByTestId('bar-chart')).toBeTruthy();

            // Verify items
            expect(screen.getByText('AAPL: 50')).toBeTruthy();
            expect(screen.getByText('GOOGL: 40')).toBeTruthy();

            // Check for Cash Buffer (100 - 90 = 10)
            expect(screen.getByText('Cash Buffer: 10')).toBeTruthy();
        });

        it('renders empty state', () => {
             render(<PortfolioBarChart portfolio={[]} />);
             expect(screen.getByText('No assets in portfolio')).toBeTruthy();
        });
    });
});
