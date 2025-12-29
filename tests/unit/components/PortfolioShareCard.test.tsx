
import { describe, it, expect } from 'bun:test';
import { render } from '@testing-library/react';
import { PortfolioShareCard } from '../../../components/PortfolioShareCard';
import React from 'react';
import { Portfolio } from '@/types';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

describe('PortfolioShareCard', () => {
    const mockPortfolio: Portfolio = [
        { ticker: 'AAPL', name: 'Apple Inc.', price: 150, weight: 60, shares: 10, assetType: 'STOCK', history: [], metrics: { yield: 0.5 }, sectors: { 'Technology': 100 } },
        { ticker: 'MSFT', name: 'Microsoft Corp.', price: 300, weight: 40, shares: 5, assetType: 'STOCK', history: [], metrics: { yield: 0.8 }, sectors: { 'Technology': 100 } }
    ];

    const mockMetrics = {
        totalValue: 3000,
        annualReturn: 0.12,
        yield: 0.02,
        projectedValue: 15000,
        totalInvested: 3000,
        dividends: 500,
        years: 10,
        scenario: 'Simple Growth',
        growthType: 'Simple' as const,
        percentageGrowth: 400
    };

    const mockChartData = [
        { value: 3000 }, { value: 3500 }, { value: 4200 }, { value: 5000 }
    ];

    it('renders portfolio summary correctly', () => {
        const { getByText, getAllByText } = render(
            <PortfolioShareCard
                userName="Test User"
                portfolio={mockPortfolio}
                metrics={mockMetrics}
                chartData={mockChartData}
            />
        );

        expect(getByText("by Test User")).toBeInTheDocument();
        expect(getByText("My Growth Portfolio")).toBeInTheDocument();
        expect(getAllByText('12.00%')[0]).toBeInTheDocument(); // Proj. Return
        expect(getByText('$15,000.00')).toBeInTheDocument(); // Projected Value
    });

    it('renders top holdings list', () => {
        const { getAllByText } = render(
            <PortfolioShareCard
                portfolio={mockPortfolio}
                metrics={mockMetrics}
                chartData={mockChartData}
            />
        );

        expect(getAllByText('AAPL')[0]).toBeInTheDocument();
        expect(getAllByText('60.0%')[0]).toBeInTheDocument();
        expect(getAllByText('MSFT')[0]).toBeInTheDocument();
        expect(getAllByText('40.0%')[0]).toBeInTheDocument();
    });
});
