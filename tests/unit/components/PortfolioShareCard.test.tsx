import { describe, it, expect, mock, afterEach } from 'bun:test';
import { mockModule } from '@/tests/helpers/mock-module';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ShareCardProps } from '@/components/PortfolioShareCard';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock Next/Image
await mockModule('next/image', () => ({
    default: ({ alt }: any) => <img alt={alt} />
}));

// Import component
import { PortfolioShareCard } from '@/components/PortfolioShareCard';

describe('PortfolioShareCard', () => {
    afterEach(() => {
        cleanup();
    });

    const mockPortfolio = [
        { ticker: 'AAPL', name: 'Apple Inc', weight: 60, shares: 10, price: 150, currency: 'USD', quoteAsOf: new Date().toISOString(), value: 1500, logo: '/apple.png', allocation: { equities: 100, bonds: 0, cash: 0 }, sectors: { Technology: 1 } },
        { ticker: 'MSFT', name: 'Microsoft', weight: 40, shares: 5, price: 300, currency: 'USD', quoteAsOf: new Date().toISOString(), value: 1500, logo: '/msft.png', allocation: { equities: 100, bonds: 0, cash: 0 }, sectors: { Technology: 1 } }
    ];

    const mockMetrics = {
        totalValue: 3000,
        annualReturn: 0.155,
        yield: 2.1,
        projectedValue: 15000,
        totalInvested: 3000,
        dividends: 500,
        years: 10,
        scenario: 'Simple Growth',
        growthType: 'Simple' as const,
        percentageGrowth: 155,
        sharpeRatio: 1.8,
        volatility: 12.5,
        maxDrawdown: -10.2,
        beta: 1.1,
        expenseRatio: 0.05
    };

    const mockChartData = [
        { value: 1000, min: 900, max: 1100 },
        { value: 1100, min: 1000, max: 1200 }
    ];

    const defaultProps: ShareCardProps = {
        portfolio: mockPortfolio as any,
        metrics: mockMetrics,
        chartData: mockChartData
    };

    it('renders portfolio summary correctly', () => {
        render(<PortfolioShareCard {...defaultProps} />);

        // Check projected value with an explicit currency.
        expect(screen.getByText((content) => content.includes('USD') && content.includes('15,000'))).toBeInTheDocument();

        expect(screen.getByText((content) => content.includes('USD') && content.includes('500'))).toBeInTheDocument();

        // Check Return
        expect(screen.getByText((content) => content.includes('+155%'))).toBeInTheDocument();

        expect(screen.getByText('Illustrative Scenario')).toBeInTheDocument();
        expect(screen.getByText('PORTFOLIO VALUE (USD)')).toBeInTheDocument();
        expect(screen.getByText('Unavailable')).toBeInTheDocument();
    });

    it('renders top holdings list', () => {
        render(<PortfolioShareCard {...defaultProps} />);

        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('MSFT')).toBeInTheDocument();
        // Check weight formatting (60.0%)
        expect(screen.getByText((content) => content.includes('60.0%'))).toBeInTheDocument();
    });

    it('shows a weighted expense ratio only when every holding has a sourced valid value', () => {
        const sourced = [
            { ...mockPortfolio[0], metrics: { mer: 0.1, merSource: 'Yahoo Finance' } },
            { ...mockPortfolio[1], metrics: { mer: 0.2, merSource: 'StockAnalysis' } },
        ];
        const { rerender } = render(<PortfolioShareCard {...defaultProps} portfolio={sourced as any} />);
        expect(screen.getByText('0.14%')).toBeInTheDocument();

        rerender(<PortfolioShareCard {...defaultProps} portfolio={[sourced[0], mockPortfolio[1]] as any} />);
        expect(screen.getByText('N/A')).toBeInTheDocument();
        expect(screen.queryByText('0.14%')).toBeNull();
    });

    it('uses the projection base currency for mixed portfolio values', () => {
        const mixed = [
            { ...mockPortfolio[0], currency: 'USD' },
            { ...mockPortfolio[1], currency: 'CAD' },
        ];
        render(<PortfolioShareCard {...defaultProps} portfolio={mixed as any} currency="CAD" fxProvenance={{ usdCad: 1.4, date: "2026-09-25" }} />);
        expect(screen.getByText(/Bank of Canada 2026-09-25, 1.4 CAD\/USD. Future FX changes excluded/)).toBeInTheDocument();
        expect(screen.getByText('PORTFOLIO VALUE (CAD)')).toBeInTheDocument();
        expect(screen.getByText((content) => content.includes('CAD') && content.includes('15,000'))).toBeInTheDocument();
    });

    it('shows a modeled loss with a minus sign and loss styling', () => {
        render(<PortfolioShareCard {...defaultProps} metrics={{ ...mockMetrics, percentageGrowth: -20 }} />);
        const loss = screen.getByText('-20%');
        expect(loss).toHaveClass('text-rose-400');
    });

    it('does not claim contributions in a Monte Carlo snapshot', () => {
        render(<PortfolioShareCard {...defaultProps} metrics={{ ...mockMetrics, growthType: 'Monte Carlo', dividends: null }} />);
        expect(screen.getByText('Starting Balance')).toBeInTheDocument();
        expect(screen.getByText('No contributions modeled')).toBeInTheDocument();
        expect(screen.queryByText('Starting balance plus contributions')).toBeNull();
    });

    it('renders chart svg elements', () => {
         const { container } = render(<PortfolioShareCard {...defaultProps} />);
         const svg = container.querySelector('svg');
         expect(svg).toBeInTheDocument();

         const paths = container.querySelectorAll('path');
         expect(paths.length).toBeGreaterThan(0);
    });
});
