
import { describe, it, expect, mock, beforeAll, afterEach } from "bun:test";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import StockInfoCard from "@/components/StockInfoCard";
import React from "react";

// Mock fetch globally
const originalFetch = global.fetch;

describe("StockInfoCard", () => {
    afterEach(() => {
        cleanup();
        global.fetch = originalFetch;
    });

    it("renders loading skeleton initially", () => {
        // Mock fetch to delay
        global.fetch = mock(() => new Promise(() => {}));

        render(<StockInfoCard ticker="AAPL" />);
        const errorText = screen.queryByText("Unable to load profile");
        expect(errorText).toBeNull();
    });

    it("renders stock info after successful fetch", async () => {
        const mockData = {
            sector: "Technology",
            industry: "Consumer Electronics",
            description: "Apple Inc. designs, manufactures, and markets smartphones...",
            analyst: {
                summary: "Strong Buy",
                consensus: "Buy",
                targetPrice: 200.50,
                targetUpside: 15.2
            }
        };

        global.fetch = mock(() =>
            Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 }))
        );

        render(<StockInfoCard ticker="AAPL" />);

        await waitFor(() => {
            expect(screen.getByText("STOCK")).toBeDefined();
            expect(screen.getByText("Technology")).toBeDefined();
            expect(screen.getByText(/Apple Inc/)).toBeDefined();
            // The summary is quoted in the UI
            expect(screen.getByText(/"Strong Buy"/)).toBeDefined();
            // Consensus badge
            expect(screen.getAllByText("Buy")).toBeDefined();
            expect(screen.getByText("$200.50")).toBeDefined();
        });
    });

    it("renders error state on fetch failure", async () => {
        global.fetch = mock(() =>
            Promise.resolve(new Response("Internal Server Error", { status: 500 }))
        );

        render(<StockInfoCard ticker="FAIL" />);

        await waitFor(() => {
            expect(screen.getByText("Unable to load profile")).toBeDefined();
            expect(screen.getByText("Failed to fetch asset profile")).toBeDefined();
        });
    });
});
