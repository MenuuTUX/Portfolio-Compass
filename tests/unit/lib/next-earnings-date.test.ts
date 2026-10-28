import { describe, expect, it } from "bun:test";
import { nextEarningsDate } from "@/lib/fast-market";

const NOW = Date.UTC(2026, 9, 28, 20, 0, 0); // 2026-10-28 20:00 UTC
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("nextEarningsDate", () => {
  it("returns the upcoming date", () => {
    expect(nextEarningsDate({ earningsTimestamp: day("2026-11-02") }, NOW)).toBe("2026-11-02");
  });

  it("drops a last-reported date once the next one is unscheduled", () => {
    expect(nextEarningsDate({ earningsTimestamp: day("2026-10-27") }, NOW)).toBeUndefined();
  });

  it("prefers the scheduled window over a stale earningsTimestamp", () => {
    expect(
      nextEarningsDate(
        {
          earningsTimestamp: day("2026-08-08"),
          earningsTimestampStart: day("2026-11-07"),
          earningsTimestampEnd: day("2026-11-07"),
        },
        NOW,
      ),
    ).toBe("2026-11-07");
  });

  it("keeps a report that is due later today", () => {
    expect(nextEarningsDate({ earningsTimestamp: day("2026-10-28") }, NOW)).toBe("2026-10-28");
  });

  it("returns nothing when no usable dates exist", () => {
    expect(nextEarningsDate({}, NOW)).toBeUndefined();
  });
});
