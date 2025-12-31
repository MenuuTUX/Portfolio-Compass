import { describe, it, expect, mock, beforeEach } from 'bun:test';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstitutionalPortfolios from '@/components/InstitutionalPortfolios';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock lucide-react icons
mock.module('lucide-react', () => ({
    Check: () => <div data-testid="icon-check" />,
    Plus: () => <div data-testid="icon-plus" />,
    Shield: () => <div data-testid="icon-shield" />,
    TrendingUp: () => <div data-testid="icon-trending-up" />,
    Scale: () => <div data-testid="icon-scale" />,
}));

describe('InstitutionalPortfolios', () => {
    const mockOnBatchAdd = mock(() => {});

    beforeEach(() => {
        mockOnBatchAdd.mockClear();
    });

    it('renders correctly with default Growth portfolio', () => {
        render(<InstitutionalPortfolios onBatchAdd={mockOnBatchAdd} />);
        expect(screen.getByText('Wealthsimple Portfolios')).toBeInTheDocument();
        expect(screen.getByText('Risk 8-10')).toBeInTheDocument();
    });

    it('displays added state', async () => {
        const user = userEvent.setup();
        render(<InstitutionalPortfolios onBatchAdd={mockOnBatchAdd} />);

        // Use getAllByText in case there are multiple "Copy This Portfolio" texts (e.g. tooltip or aria-label and text)
        // Or get by role button
        const buttons = screen.getAllByRole('button', { name: /Copy This Portfolio/i });
        const addButton = buttons[0];

        await user.click(addButton);

        await waitFor(() => {
            expect(screen.getByText('Added to Portfolio')).toBeInTheDocument();
        });
    });
});
