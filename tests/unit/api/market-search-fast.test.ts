import { describe, expect, it, mock } from "bun:test";
import { mockModule } from "@/tests/helpers/mock-module";

const getFastQuotes = mock(async () => new Map());
const getFastHistory = mock(async () => new Map());
const getFastDividendHistories = mock(async () => new Map());
const searchFastSymbols = mock(async () => []);
const quoteToAsset = mock((quote: Record<string, unknown>, history: unknown[] = []) => ({
  ...quote,
  history,
}));

await mockModule("@/lib/fast-market", () => ({
  getFastQuotes,
  getFastHistory,
  getFastDividendHistories,
  searchFastSymbols,
  quoteToAsset,
}));

await mockModule("next/server", () => ({
  NextRequest: class {
    nextUrl: URL;
    constructor(url: string) { this.nextUrl = new URL(url); }
  },
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: HeadersInit }) => ({
      _data: data,
      status: init?.status ?? 200,
      headers: new Headers(init?.headers),
    }),
  },
}));

const { GET } = await import("../../../app/api/market/search/route");
const { NextRequest } = await import("next/server");

describe("fast market search", () => {
  it("resolves exact tickers without waiting for autocomplete, history, or profiles", async () => {
    getFastQuotes.mockResolvedValue(new Map([
      ["AAPL", {
        ticker: "AAPL",
        name: "Apple Inc.",
        price: 100,
        changePercent: 1,
        assetType: "STOCK",
      }],
    ]));

    const response: any = await GET(new NextRequest(
      "http://localhost/api/market/search?query=AAPL&history=false&profiles=false",
    ));

    expect(response.status).toBe(200);
    expect(response._data[0].ticker).toBe("AAPL");
    expect(searchFastSymbols).not.toHaveBeenCalled();
    expect(getFastQuotes).toHaveBeenCalledWith(["AAPL"], { includeProfiles: false });
    expect(getFastHistory).not.toHaveBeenCalled();
  });
});
