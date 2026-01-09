import { describe, it, expect, mock, afterEach } from 'bun:test';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ShareCardProps } from '@/components/PortfolioShareCard';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock Next/Image
mock.module('next/image', () => ({
    default: ({ alt }: any) => <img alt={alt} />
}));

// Import component
import { PortfolioShareCard } from '@/components/PortfolioShareCard';

describe('PortfolioShareCard', () => {
    afterEach(() => {
        cleanup();
    });

    const mockPortfolio = [
        { ticker: 'AAPL', name: 'Apple Inc', weight: 60, shares: 10, price: 150, value: 1500, logo: '/apple.png', allocation: { equities: 100, bonds: 0, cash: 0 }, sectors: { Technology: 1 } },
        { ticker: 'MSFT', name: 'Microsoft', weight: 40, shares: 5, price: 300, value: 1500, logo: '/msft.png', allocation: { equities: 100, bonds: 0, cash: 0 }, sectors: { Technology: 1 } }
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

        // Check Projected Value ($15,000)
        expect(screen.getByText((content) => content.includes('$15,000'))).toBeInTheDocument();

        // Check Dividends ($500)
        expect(screen.getByText((content) => content.includes('$500'))).toBeInTheDocument();

        // Check Return
        expect(screen.getByText((content) => content.includes('+155%'))).toBeInTheDocument();

        // Check "Professional Analysis" badge
        expect(screen.getByText('Professional Analysis')).toBeInTheDocument();
    });

    it('renders top holdings list', () => {
        render(<PortfolioShareCard {...defaultProps} />);

        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('MSFT')).toBeInTheDocument();
        // Check weight formatting (60.0%)
        expect(screen.getByText((content) => content.includes('60.0%'))).toBeInTheDocument();
    });

    it('renders chart svg elements', () => {
         const { container } = render(<PortfolioShareCard {...defaultProps} />);
         const svg = container.querySelector('svg');
         expect(svg).toBeInTheDocument();

         const paths = container.querySelectorAll('path');
         expect(paths.length).toBeGreaterThan(0);
    });
});
