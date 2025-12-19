import { describe, it, expect } from 'bun:test';
import { isMarketOpen } from '@/lib/market-hours';

describe('isMarketOpen', () => {
  it('should return true during market hours on a regular weekday', () => {
    // Wednesday, Jan 15, 2025 (Regular day) at 10:00 AM ET
    const date = new Date('2025-01-15T10:00:00-05:00'); 
    expect(isMarketOpen(date)).toBe(true);
  });

  it('should return false before market open (9:29 AM)', () => {
    const date = new Date('2025-01-15T09:29:00-05:00');
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should return false after market close (4:00 PM)', () => {
    // 16:00 is close
    const date = new Date('2025-01-15T16:00:00-05:00');
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should return false on weekends (Saturday)', () => {
    // Saturday, Jan 18, 2025
    const date = new Date('2025-01-18T10:00:00-05:00');
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should return false on weekends (Sunday)', () => {
    // Sunday, Jan 19, 2025
    const date = new Date('2025-01-19T10:00:00-05:00');
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should return false on holidays (New Year)', () => {
    // Wednesday, Jan 1, 2025
    const date = new Date('2025-01-01T10:00:00-05:00');
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should return false on holidays (Independence Day 2025)', () => {
    // Friday, July 4, 2025
    const date = new Date('2025-07-04T10:00:00-04:00'); // EDT
    expect(isMarketOpen(date)).toBe(false);
  });

  it('should handle timezone conversion correctly (Open at 10 AM ET is 7 AM PT)', () => {
    // 7 AM PT is 10 AM ET
    // 2025-01-15 T07:00:00-08:00
    const date = new Date('2025-01-15T07:00:00-08:00');
    expect(isMarketOpen(date)).toBe(true);
  });

  it('should handle timezone conversion correctly (Closed at 6 AM PT is 9 AM ET)', () => {
    // 6 AM PT is 9 AM ET (Closed)
    const date = new Date('2025-01-15T06:00:00-08:00');
    expect(isMarketOpen(date)).toBe(false);
  });
});
