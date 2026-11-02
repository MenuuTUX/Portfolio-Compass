// TFSA contribution room and a contribution projection.
//
// Limits and rules are from the Canada Revenue Agency:
// https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributing/before.html
// The limit is set each January 1, indexed to inflation and rounded to the
// nearest $500. 2015 was a one-off $10,000. Update TFSA_LIMITS when the CRA
// announces a new year.

export const TFSA_LIMITS: Readonly<Record<number, number>> = {
  2009: 5000, 2010: 5000, 2011: 5000, 2012: 5000,
  2013: 5500, 2014: 5500,
  2015: 10000,
  2016: 5500, 2017: 5500, 2018: 5500,
  2019: 6000, 2020: 6000, 2021: 6000, 2022: 6000,
  2023: 6500,
  2024: 7000, 2025: 7000, 2026: 7000,
};

export const TFSA_FIRST_YEAR = 2009;
export const TFSA_LATEST_YEAR = Math.max(...Object.keys(TFSA_LIMITS).map(Number));

/** CRA tax on an excess amount, per month it stays in the account. */
export const OVER_CONTRIBUTION_RATE_PER_MONTH = 0.01;

/**
 * Total room created from the year someone turned 18 (or 2009, if later)
 * through `throughYear`, before any contributions or withdrawals. Years after
 * the latest announced limit are not counted.
 */
export function cumulativeRoom(yearTurned18: number, throughYear: number): number {
  if (!Number.isInteger(yearTurned18) || !Number.isInteger(throughYear)) {
    throw new RangeError("Years must be whole numbers.");
  }
  const from = Math.max(yearTurned18, TFSA_FIRST_YEAR);
  const to = Math.min(throughYear, TFSA_LATEST_YEAR);
  let total = 0;
  for (let y = from; y <= to; y++) total += TFSA_LIMITS[y];
  return total;
}

export interface RoomInput {
  yearTurned18: number;
  /** The calendar year to calculate for. */
  year: number;
  /** Everything put in across all your TFSAs through the end of last year. */
  contributedBefore: number;
  /** Everything taken out through the end of last year. Withdrawals come back as room on January 1 of the following year. */
  withdrawnBefore: number;
  /** Put in so far this year. */
  contributedThisYear?: number;
}

/**
 * Room left to contribute now, following the CRA formula: this year's limit
 * plus unused room from earlier years plus earlier withdrawals, minus this
 * year's contributions. A negative result is an over-contribution.
 */
export function availableRoom(input: RoomInput): number {
  for (const [name, v] of Object.entries({
    contributedBefore: input.contributedBefore,
    withdrawnBefore: input.withdrawnBefore,
    contributedThisYear: input.contributedThisYear ?? 0,
  })) {
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`${name} must be zero or more.`);
  }
  return (
    cumulativeRoom(input.yearTurned18, input.year) -
    input.contributedBefore +
    input.withdrawnBefore -
    (input.contributedThisYear ?? 0)
  );
}

/** Tax on an excess left in the account for `months` months, at 1% a month. */
export function overContributionTax(excess: number, months: number): number {
  if (!(excess >= 0) || !(months >= 0)) throw new RangeError("Excess and months must be zero or more.");
  return excess * OVER_CONTRIBUTION_RATE_PER_MONTH * months;
}

export interface ProjectionPoint {
  year: number;
  contributed: number;
  balance: number;
}

/**
 * Month-by-month growth of a fixed monthly contribution at a constant assumed
 * annual return. Contributions go in at the start of each month. This is
 * arithmetic on an assumption, not a forecast.
 */
export function projectContributions({
  monthly,
  years,
  annualReturn,
  startBalance = 0,
}: {
  monthly: number;
  years: number;
  annualReturn: number;
  startBalance?: number;
}): ProjectionPoint[] {
  if (!(monthly >= 0) || !(startBalance >= 0)) throw new RangeError("Amounts must be zero or more.");
  if (!Number.isInteger(years) || years < 1 || years > 80) throw new RangeError("Years must be a whole number from 1 to 80.");
  if (!(annualReturn > -1)) throw new RangeError("Annual return must be above -100%.");
  const monthlyRate = (1 + annualReturn) ** (1 / 12) - 1;
  const out: ProjectionPoint[] = [];
  let balance = startBalance;
  let contributed = startBalance;
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      balance = (balance + monthly) * (1 + monthlyRate);
      contributed += monthly;
    }
    out.push({ year: y, contributed, balance });
  }
  return out;
}
