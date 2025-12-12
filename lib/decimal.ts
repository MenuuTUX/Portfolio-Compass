import Decimal from 'decimal.js';

// Configure Decimal.js
Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });

export { Decimal };
