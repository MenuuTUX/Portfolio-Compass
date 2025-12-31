import { Decimal } from 'decimal.js';

/**
 * Safely converts a value to a string format accepted by Prisma Decimal fields.
 * Handles Decimal.js objects, numbers, strings, and null/undefined.
 * Converts NaN and Infinity to "0".
 *
 * @param value The value to convert
 * @returns A string representation of the decimal, or null if input is null/undefined
 */
export function toPrismaDecimal(value: Decimal | number | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle Decimal.js objects
  if (Decimal.isDecimal(value)) {
    if (value.isNaN() || !value.isFinite()) {
      return "0";
    }
    return value.toString();
  }

  // Handle numbers
  if (typeof value === 'number') {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return "0";
    }
    return value.toString();
  }

  // Handle strings
  if (typeof value === 'string') {
    // Basic check for NaN/Infinity strings
    if (value === 'NaN' || value === 'Infinity' || value === '-Infinity') {
      return "0";
    }
    // Attempt to parse to ensure it's a valid number, fall back to "0" if invalid
    // We use Decimal for parsing to be consistent
    try {
        const d = new Decimal(value);
        if (d.isNaN() || !d.isFinite()) {
            return "0";
        }
        return d.toString();
    } catch {
        return "0";
    }
  }

  return "0";
}

/**
 * Same as toPrismaDecimal but returns "0" instead of null.
 * Useful for required fields.
 */
export function toPrismaDecimalRequired(value: Decimal | number | string | null | undefined): string {
    const result = toPrismaDecimal(value);
    return result === null ? "0" : result;
}
