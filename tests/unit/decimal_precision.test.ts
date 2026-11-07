import { describe, it, expect } from 'bun:test';
import { Decimal } from '../../lib/decimal';

describe('lib/decimal configuration', () => {
  it("rounds exact ties to the even neighbour (banker's rounding)", () => {
    expect(new Decimal(2.5).toDecimalPlaces(0).toNumber()).toBe(2);
    expect(new Decimal(3.5).toDecimalPlaces(0).toNumber()).toBe(4);
    expect(new Decimal(1.25).toDecimalPlaces(1).toNumber()).toBe(1.2);
    expect(new Decimal(1.35).toDecimalPlaces(1).toNumber()).toBe(1.4);
  });
});
