import { describe, it, expect, mock, beforeEach } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import AssetProfileCard from "@/components/AssetProfileCard";
import React from 'react';

// Mock global fetch
const mockFetch = mock();
global.fetch = mockFetch;

describe("AssetProfileCard", () => {
    beforeEach(() => {
        mockFetch.mockClear();
    });

    it("renders loading skeleton initially", () => {
        // Return a pending promise so it stays in loading state
        mockFetch.mockImplementation(() => new Promise(() => {}));
        const { container } = render(<AssetProfileCard ticker="AAPL" />);
        // Look for skeleton elements
        expect(container.getElementsByClassName("animate-pulse").length).toBeGreaterThan(0);
    });

    it("renders profile data correctly for stock", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                sector: "Technology",
                industry: "Consumer Electronics",
                description: "Apple Inc. designs...",
                analyst: {
                    summary: "Strong Buy",
                    consensus: "Buy",
                    targetPrice: 200,
                    targetUpside: 15
                }
            })
        });

        render(<AssetProfileCard ticker="AAPL" assetType="STOCK" />);

        await waitFor(() => {
            expect(screen.getByText("STOCK")).toBeTruthy();
            expect(screen.getByText("Technology")).toBeTruthy();
            expect(screen.getByText("Consumer Electronics")).toBeTruthy();
            expect(screen.getByText("Apple Inc. designs...")).toBeTruthy();
            expect(screen.getByText("Analyst Summary")).toBeTruthy();
        });
    });

    it("renders profile data correctly for ETF", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                sector: "Equity",
                industry: "N/A",
                description: "ETF description...",
            })
        });

        render(<AssetProfileCard ticker="SPY" assetType="ETF" />);

        await waitFor(() => {
            expect(screen.getByText("ETF")).toBeTruthy();
            expect(screen.getByText("Equity")).toBeTruthy();
            expect(screen.getByText("ETF description...")).toBeTruthy();
            // Analyst summary should NOT be present
            expect(screen.queryByText("Analyst Summary")).toBeNull();
        });
    });

    it("handles error state", async () => {
         mockFetch.mockResolvedValue({
            ok: false,
        });

        render(<AssetProfileCard ticker="FAIL" />);

        await waitFor(() => {
             expect(screen.getByText("Unable to load profile")).toBeTruthy();
        });
    });
});
