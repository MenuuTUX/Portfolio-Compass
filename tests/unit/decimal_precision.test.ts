import { describe, it, expect } from 'bun:test';
import { Decimal } from '../../lib/decimal';

describe('Decimal Precision Logic', () => {
  it('correctly handles floating point arithmetic (0.1 + 0.2 = 0.3)', () => {
    const a = new Decimal(0.1);
    const b = new Decimal(0.2);
    const result = a.plus(b);

    // Standard float math: 0.1 + 0.2 = 0.30000000000000004
    // Decimal math: 0.3
    expect(result.toNumber()).toBe(0.3);
    expect(result.toString()).toBe('0.3');
  });

  it('performs Banker\'s Rounding (Round Half Even)', () => {
    // 2.5 -> 2 (Round Half Even, rounds to nearest even integer)
    // 3.5 -> 4

    // Decimal.js default is ROUND_HALF_UP unless configured.
    // In lib/decimal.ts, we set ROUND_HALF_EVEN.

    // Test 2.5 rounds to 2
    expect(new Decimal(2.5).toDecimalPlaces(0).toNumber()).toBe(2);

    // Test 3.5 rounds to 4
    expect(new Decimal(3.5).toDecimalPlaces(0).toNumber()).toBe(4);

    // Test 2.55 to 1 decimal place -> 2.6 (5 is odd?) No, 5 is the digit being rounded.
    // 2.55 -> round to 1 dec place.
    // digit at 1st dec place is 5. Next is 5.
    // Round Half Even checks the digit *to the left* of the 5.
    // Wait, standard rounding:
    // 2.5 -> round to integer. Digit to round is 2. Drop 5. 2 is even, so keep 2.
    // 3.5 -> round to integer. Digit to round is 3. Drop 5. 3 is odd, so round up to 4.

    // Let's verify our configuration
    expect(new Decimal(1.25).toDecimalPlaces(1).toNumber()).toBe(1.2); // 2 is even
    expect(new Decimal(1.35).toDecimalPlaces(1).toNumber()).toBe(1.4); // 3 is odd
  });

  it('handles multiplication precision', () => {
    // 19.99 * 100 = 1999
    // JS: 19.99 * 100 = 1998.9999999999998
    const price = new Decimal(19.99);
    const qty = new Decimal(100);
    expect(price.times(qty).toNumber()).toBe(1999);
  });
});
