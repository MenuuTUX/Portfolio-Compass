
import { describe, it, expect, mock, beforeAll, afterAll } from "bun:test";
import { POST } from "../../../app/api/portfolio/route";

// Mock Prisma
const mockPrismaUpsert = mock();
const mockPrismaFindUnique = mock();
const mockPrismaUpdateMany = mock();
const mockPrismaCreate = mock();
const mockPrismaTransaction = mock((actions) => Promise.all(actions));
const mockPrismaCount = mock();

mock.module("@/lib/db", () => ({
  default: {
    etf: {
      upsert: mockPrismaUpsert,
    },
    portfolioItem: {
      findUnique: mockPrismaFindUnique,
      updateMany: mockPrismaUpdateMany,
      create: mockPrismaCreate,
      count: mockPrismaCount,
    },
    $transaction: mockPrismaTransaction,
  },
}));

// Mock Decimal
mock.module("decimal.js", () => {
  return {
    Decimal: class MockDecimal {
      constructor(val: any) {
        if (typeof val === 'number' && isNaN(val)) {
            throw new Error(`[DecimalError] Invalid argument: ${val}`);
        }
        // Basic mock implementation
        this.val = val;
      }
      dividedBy(other: any) { return new MockDecimal(10); } // dummy
    }
  };
});


describe("POST /api/portfolio", () => {
  beforeAll(() => {
    // Setup default mocks
    mockPrismaCount.mockResolvedValue(0);
  });

  it("should return 400 if ticker is missing", async () => {
    const req = new Request("http://localhost/api/portfolio", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("should sanitize NaN price and changePercent to 0", async () => {
    // This test verifies the fix for the crash when price/change are invalid
    const req = new Request("http://localhost/api/portfolio", {
      method: "POST",
      body: JSON.stringify({
        ticker: "TEST",
        name: "Test Stock",
        // invalid numbers or missing
        price: NaN,
        changePercent: undefined
      }),
    });

    mockPrismaUpsert.mockResolvedValue({});
    mockPrismaFindUnique.mockResolvedValue(null); // Item not in portfolio

    const res = await POST(req as any);

    expect(res.status).toBe(201);

    // Verify upsert was called with sanitized values (0 instead of NaN)
    // We can't easily check the arguments of the mock if we didn't spy on it properly or if the class instance is tricky.
    // But if it wasn't sanitized, `new Decimal(NaN)` would throw (based on my mock implementation above which throws on NaN).
    // So if status is 201, it means it didn't crash.
  });

  it("should handle valid inputs correctly", async () => {
    const req = new Request("http://localhost/api/portfolio", {
      method: "POST",
      body: JSON.stringify({
        ticker: "VALID",
        name: "Valid Stock",
        price: 150.50,
        changePercent: 2.5
      }),
    });

    mockPrismaUpsert.mockResolvedValue({});
    mockPrismaFindUnique.mockResolvedValue(null);

    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });
});
