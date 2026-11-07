import { describe, expect, it } from "bun:test";
import type { PortfolioItem } from "@/types";
import { alignPriceHistories, selectReturnBasis } from "@/lib/math/history";
import { buildPortfolioIndexWithBasis } from "@/lib/portfolio-history";
import { estimateAnnualCovariance } from "@/lib/math/covariance";
import { convertPriceHistoryToCad } from "@/lib/math/fx-history";
import { pickHistory } from "@/hooks/usePortfolio";

type Point = { date: string; price: number; adjPrice?: number };

const DAYS = 400;
const day = (i: number) => new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString();

/** Ex-dividend days and the dividend as a fraction of price: 1.5% a quarter. */
const EX_DAYS = [91, 182, 273, 364];
const DIVIDEND = 0.015;
const exFactor = (i: number) => Math.pow(1 - DIVIDEND, EX_DAYS.filter((d) => d > i).length);

/**
 * A fund whose quoted price stays flat while it pays 1.5% each quarter, so
 * price return is about 0% and total return about 6%. Yahoo's adjusted close
 * is the close scaled down by every dividend paid after that day.
 */
function incomeFund(adjusted: boolean, drop: number[] = []): Point[] {
  return Array.from({ length: DAYS }, (_, i) => {
    const price = 100 * (1 + 0.0003 * Math.sin(i));
    const point: Point = { date: day(i), price };
    if (adjusted && !drop.includes(i)) point.adjPrice = price * exFactor(i);
    return point;
  });
}

/** Same price path as incomeFund but with no distributions, so adj equals price. */
function growthFund(adjusted: boolean): Point[] {
  return Array.from({ length: DAYS }, (_, i) => {
    const price = 50 * Math.pow(1.04, i / 365);
    return adjusted ? { date: day(i), price, adjPrice: price } : { date: day(i), price };
  });
}

const item = (ticker: string, history: Point[], weight = 50): PortfolioItem =>
  ({
    ticker, name: ticker, price: history.at(-1)!.price, currency: "USD", changePercent: 0,
    history, metrics: { mer: 0, yield: 0 }, allocation: { equities: 100, bonds: 0, cash: 0 },
    weight, shares: 10, quoteAsOf: new Date().toISOString(),
  }) as unknown as PortfolioItem;

describe("selectReturnBasis", () => {
  it("is total only when every holding has adjusted closes", () => {
    expect(selectReturnBasis([incomeFund(true), growthFund(true)])).toBe("total");
    expect(selectReturnBasis([incomeFund(true), growthFund(false)])).toBe("price");
    expect(selectReturnBasis([])).toBe("price");
  });

  it("tolerates one missing adjusted close but not a mostly missing series", () => {
    expect(selectReturnBasis([incomeFund(true, [DAYS - 1])])).toBe("total");
    expect(selectReturnBasis([incomeFund(true, Array.from({ length: 100 }, (_, i) => i))])).toBe("price");
  });
});

describe("alignPriceHistories", () => {
  it("rebases total-return series to the true first price and grows them by the adjusted ratio", () => {
    const aligned = alignPriceHistories([item("INC", incomeFund(true)), item("GRO", growthFund(true))])!;
    expect(aligned.basis).toBe("total");
    expect(aligned.prices[0][0]).toBeCloseTo(incomeFund(true)[0].price, 8);
    const plain = incomeFund(false);
    // Four 1.5% dividends are reinvested on top of the (near flat) price move.
    expect(aligned.prices[0].at(-1)! / aligned.prices[0][0]).toBeCloseTo(
      (plain.at(-1)!.price / plain[0].price) / Math.pow(1 - DIVIDEND, 4), 8,
    );
  });

  it("drops a date missing an adjusted close for every holding instead of zeroing it", () => {
    const aligned = alignPriceHistories([item("INC", incomeFund(true, [10])), item("GRO", growthFund(true))])!;
    expect(aligned.basis).toBe("total");
    expect(aligned.dates).toHaveLength(DAYS - 1);
    expect(aligned.dates).not.toContain(day(10).slice(0, 10));
    expect(aligned.prices.flat().every((p) => p > 0)).toBe(true);
  });

  it("uses price for every holding when one has no adjusted closes", () => {
    const aligned = alignPriceHistories([item("INC", incomeFund(true)), item("GRO", growthFund(false))])!;
    expect(aligned.basis).toBe("price");
    expect(aligned.prices[0][5]).toBe(incomeFund(true)[5].price);
  });
});

describe("a fund with a known dividend", () => {
  it("has a higher total return than price return in the portfolio index", () => {
    const total = buildPortfolioIndexWithBasis([item("INC", incomeFund(true), 100)]);
    const price = buildPortfolioIndexWithBasis([item("INC", incomeFund(false), 100)]);
    expect(total.basis).toBe("total");
    expect(price.basis).toBe("price");
    expect(price.points.at(-1)!.v).toBeCloseTo(100, 0);
    expect(total.points.at(-1)!.v).toBeGreaterThan(price.points.at(-1)!.v + 5);
  });

  it("labels the index price when only one holding lacks adjusted closes", () => {
    const mixed = buildPortfolioIndexWithBasis([item("INC", incomeFund(true)), item("GRO", growthFund(false))]);
    expect(mixed.basis).toBe("price");
    expect(mixed.points.every((p) => p.v > 0)).toBe(true);
  });

  it("reports the basis of the covariance estimate", () => {
    const pair = (adjusted: boolean) => [item("INC", incomeFund(adjusted)), item("GRO", growthFund(adjusted))];
    const total = estimateAnnualCovariance(pair(true));
    const price = estimateAnnualCovariance(pair(false));
    expect(total.basis).toBe("total");
    expect(price.basis).toBe("price");
    expect(total.source).toBe("history");
  });
});

describe("convertPriceHistoryToCad with adjusted closes", () => {
  const rates = [{ date: "2026-09-18", usdCad: 1.3 }];

  it("converts adjPrice with the same rate as price", () => {
    const out = convertPriceHistoryToCad([{ date: "2026-09-18", price: 100, adjPrice: 90 }], "USD", rates)!;
    expect(out[0].price).toBeCloseTo(130);
    expect(out[0].adjPrice).toBeCloseTo(117);
  });

  it("leaves adjPrice absent when the point had none, and rejects an unusable one", () => {
    expect("adjPrice" in convertPriceHistoryToCad([{ date: "2026-09-18", price: 100 }], "USD", rates)![0]).toBe(false);
    expect(convertPriceHistoryToCad([{ date: "2026-09-18", price: 100, adjPrice: 0 }], "USD", rates)).toBeNull();
    expect(convertPriceHistoryToCad([{ date: "2026-09-18", price: 100, adjPrice: 0 }], "CAD", [])).toBeNull();
  });
});

describe("pickHistory", () => {
  const plain = [{ date: "2026-01-01", price: 1 }, { date: "2026-01-02", price: 1 }];
  const adjusted = [{ date: "2025-01-01", price: 1, adjPrice: 1 }, { date: "2025-01-02", price: 1, adjPrice: 1 }, { date: "2025-01-03", price: 1, adjPrice: 1 }];

  it("keeps stored history unless the details carry adjusted closes it lacks", () => {
    expect(pickHistory(plain, adjusted)).toBe(adjusted);
    expect(pickHistory(adjusted, plain)).toBe(adjusted);
    expect(pickHistory(plain, plain)).toBe(plain);
    expect(pickHistory([], adjusted)).toBe(adjusted);
  });
});
