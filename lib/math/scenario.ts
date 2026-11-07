import { annualRateToMonthlyRate } from "@/lib/math/portfolio-returns";

interface ScenarioPoint {
  year: string;
  balance: number;
  invested: number;
  gain: number;
}

/** Largest starting balance or monthly contribution a projection accepts. */
export const MAX_SCENARIO_AMOUNT = 1e12;

/**
 * Beginning-of-month contributions; constant nominal annual total return.
 * Throws a RangeError when an amount is not finite or is above MAX_SCENARIO_AMOUNT,
 * so an absurd input cannot produce Infinity or NaN on screen.
 */
export function projectContributionScenario(
  initialBalance: number,
  monthlyContribution: number,
  years: number,
  annualReturn: number,
): ScenarioPoint[] {
  const amounts = [initialBalance, monthlyContribution];
  if (amounts.some((amount) => !Number.isFinite(amount) || Math.abs(amount) > MAX_SCENARIO_AMOUNT)) {
    throw new RangeError("Amount is too large");
  }
  if (
    !Number.isFinite(initialBalance) || initialBalance < 0 ||
    !Number.isFinite(monthlyContribution) || monthlyContribution < 0 ||
    !Number.isInteger(years) || years < 0 ||
    !Number.isFinite(annualReturn) || annualReturn <= -1
  ) return [];

  const monthlyRate = annualRateToMonthlyRate(annualReturn);
  let balance = initialBalance;
  let invested = initialBalance;
  const points: ScenarioPoint[] = [{
    year: "Y0", balance, invested, gain: 0,
  }];

  for (let month = 1; month <= years * 12; month++) {
    invested += monthlyContribution;
    balance = (balance + monthlyContribution) * (1 + monthlyRate);
    if (month % 12 === 0) {
      points.push({
        year: `Y${month / 12}`,
        balance,
        invested,
        gain: balance - invested,
      });
    }
  }
  return points;
}

/**
 * The yearly return that turns `initialBalance` plus a monthly contribution into
 * `ending` after `years`, using the same month-by-month rule as the projection
 * above. Null when no return between -90% and +1000% fits. With no contribution
 * this is the ordinary compound annual growth rate.
 */
export function impliedAnnualReturn(
  initialBalance: number,
  monthlyContribution: number,
  years: number,
  ending: number,
): number | null {
  if (![initialBalance, monthlyContribution, years, ending].every(Number.isFinite)) return null;
  if (initialBalance < 0 || monthlyContribution < 0 || years <= 0 || ending <= 0) return null;
  if (initialBalance === 0 && monthlyContribution === 0) return null;
  const endingAt = (annual: number) => {
    const rate = annualRateToMonthlyRate(annual);
    let balance = initialBalance;
    for (let month = 1; month <= years * 12; month++) balance = (balance + monthlyContribution) * (1 + rate);
    return balance;
  };
  let lo = -0.9;
  let hi = 10;
  if (endingAt(lo) > ending || endingAt(hi) < ending) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (endingAt(mid) < ending) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
