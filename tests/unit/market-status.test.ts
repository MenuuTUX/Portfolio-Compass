
import { describe, it, expect, setSystemTime } from "bun:test";
import { getMarketStatus } from "../../lib/market-status";

describe("getMarketStatus", () => {
    // Helper to mock date. Bun's setSystemTime handles this (like jest.useFakeTimers + setSystemTime)
    // Actually, `bun:test` `setSystemTime` sets the system time.

    // Note: getMarketStatus uses `new Date()` internally.

    // 2024-03-22 is a Friday (Regular Trading Day)
    // 2024-03-23 is a Saturday (Weekend)
    // 2024-03-29 is Good Friday (Holiday)

    it("should be OPEN on a regular trading day during market hours (Friday 10:00 AM ET)", () => {
        // 10 AM ET is 14:00 UTC (during standard time) or 14:00 UTC (during daylight saving? March 22 is EDT, so UTC-4)
        // 10:00 AM EDT = 14:00 UTC.
        const date = new Date("2024-03-22T14:00:00Z");
        setSystemTime(date);
        expect(getMarketStatus()).toBe("OPEN");
    });

    it("should be CLOSED on a regular trading day before market hours (Friday 09:00 AM ET)", () => {
        // 09:00 AM EDT = 13:00 UTC
        const date = new Date("2024-03-22T13:00:00Z");
        setSystemTime(date);
        expect(getMarketStatus()).toBe("CLOSED");
    });

    it("should be CLOSED on a regular trading day after market hours (Friday 04:30 PM ET)", () => {
        // 16:30 PM EDT = 20:30 UTC
        const date = new Date("2024-03-22T20:30:00Z");
        setSystemTime(date);
        expect(getMarketStatus()).toBe("CLOSED");
    });

    it("should be CLOSED on a Saturday", () => {
        // Saturday at 12:00 PM EDT
        const date = new Date("2024-03-23T16:00:00Z");
        setSystemTime(date);
        expect(getMarketStatus()).toBe("CLOSED");
    });

    it("should be CLOSED on a Sunday", () => {
        // Sunday at 12:00 PM EDT
        const date = new Date("2024-03-24T16:00:00Z");
        setSystemTime(date);
        expect(getMarketStatus()).toBe("CLOSED");
    });

    it("should be CLOSED on a Holiday (Good Friday)", () => {
        // Good Friday 2024 is March 29
        // 12:00 PM EDT
        const date = new Date("2024-03-29T16:00:00Z");
        setSystemTime(date);
        expect(getMarketStatus()).toBe("CLOSED");
    });

    it("should be CLOSED on New Year's Day (2025)", () => {
        const date = new Date("2025-01-01T15:00:00Z"); // 10 AM EST
        setSystemTime(date);
        expect(getMarketStatus()).toBe("CLOSED");
    });
});
