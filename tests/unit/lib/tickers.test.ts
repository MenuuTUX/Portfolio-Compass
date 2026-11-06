import { describe, expect, test } from "bun:test";
import { parseTickers, toYahooSymbol } from "@/lib/tickers";

describe("parseTickers", () => {
  test("keeps valid symbols and drops junk", () => {
    expect(parseTickers([" VOO ", "BRK.B", "^GSPC", "CAD=X", "a b", "", "x".repeat(40), "<script>"], 10)).toEqual([
      "VOO",
      "BRK.B",
      "^GSPC",
      "CAD=X",
    ]);
  });

  test("caps the result", () => {
    expect(parseTickers(["A", "B", "C"], 2)).toEqual(["A", "B"]);
  });
});

describe("toYahooSymbol", () => {
  test("uses Yahoo's dash for share classes", () => {
    expect(toYahooSymbol("brk.b")).toBe("BRK-B");
    expect(toYahooSymbol("BF.B")).toBe("BF-B");
    expect(toYahooSymbol("BRK-B")).toBe("BRK-B");
  });

  test("leaves exchange suffixes and other symbols alone", () => {
    for (const t of ["XIC.TO", "ABC.V", "VOD.L", "AAPL", "^GSPC", "CAD=X", "BTC-USD"]) {
      expect(toYahooSymbol(t)).toBe(t);
    }
  });
});
