import { describe, expect, it } from "bun:test";
import { mapChartResult } from "@/lib/lab/yahoo-bars";
import { fromCompact, isAcceptedThrough, lastCompletedSession, toCompact } from "@/lib/lab/bar-types";
import recorded from "@/tests/fixtures/yahoo-chart-daily.json";

const FETCHED_AT = "2026-10-29T00:00:00.000Z";

describe("mapChartResult", () => {
  const aapl = mapChartResult("AAPL", recorded.AAPL, FETCHED_AT);

  it("keeps Yahoo's split-adjusted close continuous across the 2020 4:1 split", () => {
    const before = aapl.bars.find((b) => b.date === "2020-08-28")!;
    const after = aapl.bars.find((b) => b.date === "2020-08-31")!;
    // An unadjusted series would show roughly 499 then 129.
    expect(after.close / before.close).toBeGreaterThan(0.9);
    expect(after.close / before.close).toBeLessThan(1.15);
    expect(aapl.splits).toEqual([{ date: "2020-08-31", numerator: 4, denominator: 1 }]);
  });

  it("returns the dividend on its ex-date and a lower adjClose before it", () => {
    expect(aapl.dividends).toEqual([{ date: "2020-08-07", amount: 0.205 }]);
    const exDate = aapl.bars.findIndex((b) => b.date === "2020-08-07");
    const prior = aapl.bars[exDate - 1];
    const on = aapl.bars[exDate];
    expect(prior.adjClose / prior.close).toBeLessThan(on.adjClose / on.close);
  });

  it("labels each bar with the exchange's trading date, not the UTC date", () => {
    const bhp = mapChartResult("BHP.AX", recorded["BHP.AX"], FETCHED_AT);
    // Yahoo stamps Sydney sessions at 23:00 UTC on the previous day.
    expect(bhp.bars[0].date).toBe("2024-01-08");
    expect(bhp.bars.every((b) => ![0, 6].includes(new Date(`${b.date}T00:00:00Z`).getUTCDay()))).toBe(true);
  });

  it("reports the listing currency so mixed-currency universes can be converted", () => {
    expect(aapl.currency).toBe("USD");
    const xic = mapChartResult("XIC.TO", recorded["XIC.TO"], FETCHED_AT);
    expect(xic.currency).toBe("CAD");
    expect(xic.dividends[0]).toEqual({ date: "2024-06-25", amount: 0.266 });
  });

  it("drops rows with a missing price instead of turning them into zeros", () => {
    const series = mapChartResult("GAP", {
      meta: { currency: "USD", gmtoffset: -14400 },
      quotes: [
        { date: "2024-03-04T13:30:00Z", open: 10, close: 10, adjclose: 10 },
        { date: "2024-03-05T13:30:00Z", open: null, close: null, adjclose: null },
        { date: "2024-03-06T13:30:00Z", open: 10, close: 11, adjclose: 11 },
      ],
    }, FETCHED_AT);
    expect(series.bars.map((b) => b.date)).toEqual(["2024-03-04", "2024-03-06"]);
    expect(series.bars.every((b) => b.close > 0)).toBe(true);
  });

  it("keeps the later row when Yahoo repeats a session", () => {
    const series = mapChartResult("DUP", {
      meta: { currency: "USD", gmtoffset: -14400 },
      quotes: [
        { date: "2024-03-04T13:30:00Z", open: 10, close: 10, adjclose: 10 },
        { date: "2024-03-04T19:59:00Z", open: 10, close: 10.5, adjclose: 10.5 },
      ],
    }, FETCHED_AT);
    expect(series.bars).toHaveLength(1);
    expect(series.bars[0].close).toBe(10.5);
  });

  it("stamps the data source", () => {
    expect(aapl.source).toEqual({
      provider: "Yahoo Finance",
      adjustment: "close: split-adjusted; adjClose: split- and dividend-adjusted",
      fetchedAt: FETCHED_AT,
    });
  });
});

describe("compact series", () => {
  const aapl = mapChartResult("AAPL", recorded.AAPL, FETCHED_AT);

  it("round-trips bars and events, with prices kept to 8 significant digits", () => {
    const back = fromCompact(toCompact(aapl, "2020-09-02"));
    expect(back.bars.map((b) => b.date)).toEqual(aapl.bars.map((b) => b.date));
    back.bars.forEach((b, i) => {
      expect(Math.abs(b.adjClose / aapl.bars[i].adjClose - 1)).toBeLessThan(1e-7);
      expect(Math.abs(b.open / aapl.bars[i].open - 1)).toBeLessThan(1e-7);
    });
    expect(back.dividends).toEqual(aapl.dividends);
    expect(back.splits).toEqual(aapl.splits);
    expect(back.currency).toBe("USD");
  });

  it("slices to the requested window, events included", () => {
    const sliced = fromCompact(toCompact(aapl, "2020-09-02"), "2020-08-10", "2020-08-31");
    expect(sliced.bars[0].date).toBe("2020-08-10");
    expect(sliced.bars.at(-1)!.date).toBe("2020-08-31");
    expect(sliced.dividends).toEqual([]);
    expect(sliced.splits).toHaveLength(1);
  });
});

describe("lastCompletedSession", () => {
  const at = (iso: string) => lastCompletedSession(new Date(iso));

  it("waits until 18:00 New York time, in summer and winter", () => {
    // EDT is UTC-4: 18:00 is 22:00 UTC.
    expect(at("2026-07-15T21:59:00Z")).toBe("2026-07-14");
    expect(at("2026-07-15T22:00:00Z")).toBe("2026-07-15");
    // EST is UTC-5: 18:00 is 23:00 UTC.
    expect(at("2026-01-14T22:30:00Z")).toBe("2026-01-13");
    expect(at("2026-01-14T23:00:00Z")).toBe("2026-01-14");
  });

  it("uses the New York date, not the UTC date, late in the evening", () => {
    // 02:00 UTC on Thursday is still Wednesday 22:00 in New York.
    expect(at("2026-07-16T02:00:00Z")).toBe("2026-07-15");
  });

  it("skips weekends back to Friday", () => {
    expect(at("2026-10-31T15:00:00Z")).toBe("2026-10-30");
    expect(at("2026-11-02T10:00:00Z")).toBe("2026-10-30");
  });
});

describe("isAcceptedThrough", () => {
  const now = new Date("2026-11-02T23:30:00Z"); // Monday evening in New York
  it("accepts the current and previous session only", () => {
    expect(isAcceptedThrough("2026-11-02", now)).toBe(true);
    expect(isAcceptedThrough("2026-10-30", now)).toBe(true);
    expect(isAcceptedThrough("2026-10-29", now)).toBe(false);
    expect(isAcceptedThrough("2026-11-03", now)).toBe(false);
    expect(isAcceptedThrough("", now)).toBe(false);
  });
});
