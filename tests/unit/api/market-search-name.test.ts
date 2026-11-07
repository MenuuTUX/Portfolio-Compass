import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";
import { mockModule } from "@/tests/helpers/mock-module";
import type { FastQuote } from "@/lib/fast-market";

const getFastQuotes = mock(async (): Promise<Map<string, FastQuote>> => new Map());
const getFastHistory = mock(async () => new Map());
const getFastDividendHistories = mock(async () => new Map());
const searchFastSymbols = mock(async (): Promise<string[]> => []);
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

const { GET } = await import("../../../app/api/market/search/route");

const quote = (ticker: string, name: string) => ({
  ticker, name, price: 100, changePercent: 0, assetType: "STOCK" as const,
}) as FastQuote;

const search = async (query: string) => {
  const res = await GET(new NextRequest(
    `http://localhost/api/market/search?query=${encodeURIComponent(query)}&history=false&profiles=false`,
  ));
  return { status: res.status, body: (await res.json()) as Array<{ ticker: string }> };
};

beforeEach(() => {
  getFastQuotes.mockReset();
  searchFastSymbols.mockReset();
  getFastQuotes.mockResolvedValue(new Map());
  searchFastSymbols.mockResolvedValue([]);
});

describe("market search by company name", () => {
  it("resolves exact tickers without waiting for autocomplete, history, or profiles", async () => {
    getFastQuotes.mockResolvedValue(new Map([["AAPL", quote("AAPL", "Apple Inc.")]]));

    const res = await search("AAPL");

    expect(res.status).toBe(200);
    expect(res.body[0].ticker).toBe("AAPL");
    expect(searchFastSymbols).not.toHaveBeenCalled();
    expect(getFastQuotes).toHaveBeenCalledWith(["AAPL"], { includeProfiles: false });
    expect(getFastHistory).not.toHaveBeenCalled();
  });

  it("goes straight to name search for words too long to be a US ticker", async () => {
    searchFastSymbols.mockResolvedValue(["MSFT"]);
    getFastQuotes.mockResolvedValue(new Map([["MSFT", quote("MSFT", "Microsoft")]]));

    const res = await search("microsoft");

    expect(searchFastSymbols).toHaveBeenCalledWith("microsoft", undefined, 20);
    expect(res.body.map((a) => a.ticker)).toEqual(["MSFT"]);
  });

  it("falls back to name search when a ticker-shaped word is not a ticker", async () => {
    getFastQuotes
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([["AAPL", quote("AAPL", "Apple")]]));
    searchFastSymbols.mockResolvedValue(["AAPL"]);

    const res = await search("apple");

    expect(searchFastSymbols).toHaveBeenCalledTimes(1);
    expect(res.body.map((a) => a.ticker)).toEqual(["AAPL"]);
  });

  it("does not run name search when the exact ticker resolves", async () => {
    getFastQuotes.mockResolvedValue(new Map([["META", quote("META", "Meta Platforms")]]));
    await search("meta");
    expect(searchFastSymbols).not.toHaveBeenCalled();
  });

  it("looks up the Yahoo spelling of share-class tickers", async () => {
    getFastQuotes.mockResolvedValue(new Map([["BRK-B", quote("BRK-B", "Berkshire Hathaway")]]));
    const res = await search("brk.b");
    expect((getFastQuotes.mock.calls[0] as unknown[])[0]).toEqual(["BRK-B"]);
    expect(res.body.map((a) => a.ticker)).toEqual(["BRK-B"]);
  });
});
