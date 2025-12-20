import { describe, it, expect, mock, beforeAll, afterAll } from "bun:test";

// Mock environment variables
const originalEnv = process.env;

beforeAll(() => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
});

afterAll(() => {
    process.env = originalEnv;
});

// Mock Prisma
const mockPrisma = {
    etf: {
        findUnique: mock(),
    },
    portfolioItem: {
        upsert: mock(),
    },
};

mock.module("@/lib/db", () => ({
    default: mockPrisma,
}));

// Mock etf-sync
mock.module("@/lib/etf-sync", () => ({
    syncEtfDetails: mock(),
}));

describe("POST /api/portfolio Integration Sim", () => {
    it("should return 404 when sync fails", async () => {
        const { POST } = await import("@/app/api/portfolio/route");
        const { syncEtfDetails } = await import("@/lib/etf-sync");

        // Setup mocks: ETF missing, sync returns null
        mockPrisma.etf.findUnique.mockResolvedValue(null);
        (syncEtfDetails as any).mockResolvedValue(null);

        const req = new Request("http://localhost/api/portfolio", {
            method: "POST",
            body: JSON.stringify({ ticker: "INVALID" }),
        });

        const res = await POST(req);

        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toBe("Ticker not found on market");
        expect(mockPrisma.portfolioItem.upsert).not.toHaveBeenCalled();
    });

    it("should return 500 when database throws", async () => {
        const { POST } = await import("@/app/api/portfolio/route");
        const { syncEtfDetails } = await import("@/lib/etf-sync");

        // Setup mocks: ETF exists, but upsert fails
        mockPrisma.etf.findUnique.mockResolvedValue({
            ticker: "TEST",
            isDeepAnalysisLoaded: true
        });
        mockPrisma.portfolioItem.upsert.mockRejectedValue(new Error("DB Error"));

        const req = new Request("http://localhost/api/portfolio", {
            method: "POST",
            body: JSON.stringify({ ticker: "TEST" }),
        });

        const res = await POST(req);

        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe("Internal Server Error");
    });
});
