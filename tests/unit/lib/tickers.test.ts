import { describe, expect, test } from "bun:test";
import { parseTickers } from "@/lib/tickers";

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
