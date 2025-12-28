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
        Treemap: ({ data }: { data: any[] }) => (
            <div data-testid="treemap">
                {data.map((d: any, i: number) => (
                    <div key={i} data-testid="treemap-node">{d.name}</div>
                ))}
            </div>
        ),
        Sector: () => <div data-testid="sector" />
    };
});

// Import components after mocks
import SectorPieChart from '../../../components/SectorPieChart';
import PortfolioTreemap from '../../../components/PortfolioTreemap';

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

    describe('PortfolioTreemap', () => {
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
                    weight: 50,
                    price: 2800,
                    shares: 5,
                    changePercent: -0.5,
                    history: [],
                    metrics: { mer: 0, yield: 0 },
                    allocation: { equities: 100, bonds: 0, cash: 0 }
                }
            ];

            render(<PortfolioTreemap portfolio={portfolio} />);

            // Due to our mock, the Treemap renders a wrapper with nodes
            // But verify the container is there
            expect(screen.getByText('Portfolio Weight Allocation')).toBeTruthy();
            expect(screen.getByTestId('treemap')).toBeTruthy();
        });

        it('renders empty state', () => {
             render(<PortfolioTreemap portfolio={[]} />);
             expect(screen.getByText('No assets in portfolio')).toBeTruthy();
        });
    });
});
