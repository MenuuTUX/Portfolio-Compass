import { describe, expect, it } from "bun:test";
import { convertPriceHistoryToCad } from "@/lib/math/fx-history";

describe("convertPriceHistoryToCad", () => {
  it("uses the latest prior observation and carries it across omitted holidays", () => {
    const converted = convertPriceHistoryToCad(
      [
        { date: "2026-09-18", price: 100 },
        { date: "2026-09-21", price: 101 },
        { date: "2026-09-22", price: 102 },
      ],
      "USD",
      [
        { date: "2026-09-21", usdCad: 1.4 },
        { date: "2026-09-18", usdCad: 1.3 },
      ],
    );
    expect(converted?.map(({ date }) => date)).toEqual([
      "2026-09-18", "2026-09-21", "2026-09-22",
    ]);
    expect(converted?.[0].price).toBeCloseTo(130);
    expect(converted?.[1].price).toBeCloseTo(141.4);
    expect(converted?.[2].price).toBeCloseTo(142.8);
  });

  it("never uses a future observation and fails when no prior rate exists", () => {
    expect(convertPriceHistoryToCad(
      [{ date: "2026-09-18", price: 100 }],
      "USD",
      [{ date: "2026-09-21", usdCad: 1.4 }],
    )).toBeNull();
  });

  it("rejects impossible date-only points and FX carry older than seven days", () => {
    expect(convertPriceHistoryToCad(
      [{ date: "2026-02-30", price: 100 }],
      "USD",
      [{ date: "2026-02-28", usdCad: 1.4 }],
    )).toBeNull();
    expect(convertPriceHistoryToCad(
      [{ date: "2026-09-18", price: 100 }],
      "USD",
      [{ date: "2026-09-10", usdCad: 1.4 }],
    )).toBeNull();
    expect(convertPriceHistoryToCad(
      [{ date: "2026-09-18", price: 100 }],
      "USD",
      [{ date: "2026-09-11", usdCad: 1.4 }],
    )?.[0].price).toBeCloseTo(140);
  });

  it("fails closed on invalid rates, prices, and unsupported currencies", () => {
    const point = [{ date: "2026-09-18", price: 100 }];
    expect(convertPriceHistoryToCad(point, "USD", [
      { date: "2026-09-18", usdCad: 0 },
    ])).toBeNull();
    expect(convertPriceHistoryToCad(
      [{ date: "2026-09-18", price: 0 }], "CAD", [],
    )).toBeNull();
    expect(convertPriceHistoryToCad(point, "EUR", [])).toBeNull();
  });

  it("copies valid CAD prices without requiring FX observations", () => {
    const points = [{ date: "2026-09-18", price: 100 }];
    expect(convertPriceHistoryToCad(points, "CAD", [])).toEqual(points);
  });
});
