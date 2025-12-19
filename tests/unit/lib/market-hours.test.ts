// tests/unit/lib/market-hours.test.ts
import { describe, it, expect } from 'bun:test';
import { isMarketOpen } from '../../../lib/market-hours';

describe('Market Hours Utility', () => {
  // Helper to create a date in NY time
  const createNYDate = (isoString: string) => {
    // We create a date that corresponds to the given ISO string interpreted as NY time.
    // However, JS Date constructor parses ISO as UTC if 'Z' is present, or local if not.
    // To be precise, we should construct the date such that when converted to NY time, it matches our expectation.
    // But since `isMarketOpen` converts whatever Date it receives to NY time,
    // we can pass a UTC date that EQUALS the NY time we want to test.

    // For example, if we want to test 2025-01-06 09:30 NY time:
    // That is UTC-5 (EST) or UTC-4 (EDT). Jan is EST (UTC-5).
    // So 09:30 NY is 14:30 UTC.
    // Easier way: let's rely on the input string to be fully qualified with offset if possible,
    // or just construct it carefully.

    // Let's use specific offsets for testing to ensure we are testing the timezone logic.
    // Jan = EST = -05:00
    // Jul = EDT = -04:00
    return new Date(isoString);
  };

  it('should return true during trading hours on a regular weekday (Winter/EST)', () => {
    // Jan 6 2025 is a Monday. 10:00 AM NY time.
    // 10:00 AM EST = 15:00 UTC
    const date = new Date('2025-01-06T15:00:00Z');
    expect(isMarketOpen(date)).toBe(true);
  });

  it('should return true during trading hours on a regular weekday (Summer/EDT)', () => {
    // Jul 7 2025 is a Monday. 10:00 AM NY time.
    // 10:00 AM EDT = 14:00 UTC
    const date = new Date('2025-07-07T14:00:00Z');
    expect(isMarketOpen(date)).toBe(true);
  });

  it('should return false before market open (09:29 AM)', () => {
    // Jan 6 2025 (Mon). 09:29 AM EST = 14:29 UTC
    const date = new Date('2025-01-06T14:29:00Z');
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should return true exactly at market open (09:30 AM)', () => {
    // Jan 6 2025 (Mon). 09:30 AM EST = 14:30 UTC
    const date = new Date('2025-01-06T14:30:00Z');
    expect(isMarketOpen(date)).toBe(true);
  });

  it('should return true just before market close (15:59 PM)', () => {
    // Jan 6 2025 (Mon). 15:59 EST = 20:59 UTC
    const date = new Date('2025-01-06T20:59:00Z');
    expect(isMarketOpen(date)).toBe(true);
  });

  it('should return false exactly at market close (16:00 PM)', () => {
    // Jan 6 2025 (Mon). 16:00 EST = 21:00 UTC
    const date = new Date('2025-01-06T21:00:00Z');
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should return false on weekends (Saturday)', () => {
    // Jan 4 2025 is a Saturday. 10:00 AM EST.
    const date = new Date('2025-01-04T15:00:00Z');
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should return false on weekends (Sunday)', () => {
    // Jan 5 2025 is a Sunday. 10:00 AM EST.
    const date = new Date('2025-01-05T15:00:00Z');
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should return false on holidays (Christmas 2025)', () => {
    // Dec 25 2025 is a Thursday.
    const date = new Date('2025-12-25T15:00:00Z'); // 10:00 AM EST
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should return false on holidays (Good Friday 2026)', () => {
    // Apr 3 2026 is a Friday.
    const date = new Date('2026-04-03T14:00:00Z'); // 10:00 AM EDT (April is usually EDT)
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should handle timezone conversion correctly regardless of local time', () => {
    // This test ensures we are not using the server's local time (which might be UTC or anything else)
    // We simulate a time that is "Open" in NY (e.g. 10AM EST) but "Closed" if interpreted as UTC (3PM UTC is fine, but say late night)

    // Let's take 09:30 AM EST = 14:30 UTC.
    // If the server was running in UTC, `new Date('...Z').getHours()` would be 14.
    // 14 is between 9 and 16, so checking UTC hours by mistake would ALSO return true.

    // Let's find a time where NY is Open, but UTC is Closed.
    // 15:00 NY (3 PM) = 20:00 UTC (8 PM).
    // NY is OPEN. UTC is CLOSED (20 > 16).
    // Correct logic should return TRUE.
    const dateOpenNY_ClosedUTC = new Date('2025-01-06T20:00:00Z'); // Mon Jan 6
    expect(isMarketOpen(dateOpenNY_ClosedUTC)).toBe(true);

    // Let's find a time where NY is Closed, but UTC is Open.
    // 08:00 NY (8 AM) = 13:00 UTC (1 PM).
    // NY is CLOSED. UTC is OPEN.
    // Correct logic should return FALSE.
    const dateClosedNY_OpenUTC = new Date('2025-01-06T13:00:00Z');
    expect(isMarketOpen(dateClosedNY_OpenUTC)).toBe(false);
  });

  it('should check current time if no date provided', () => {
    // We can't deterministicly test "now" without mocking,
    // but we can ensure it doesn't crash.
    const result = isMarketOpen();
    expect(typeof result).toBe('boolean');
  });
});
