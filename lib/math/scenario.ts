import { annualRateToMonthlyRate } from "@/lib/math/portfolio-returns";

export interface ScenarioPoint {
  year: string;
  balance: number;
  invested: number;
  gain: number;
}

/** Beginning-of-month contributions; constant nominal annual total return. */
export function projectContributionScenario(
  initialBalance: number,
  monthlyContribution: number,
  years: number,
  annualReturn: number,
): ScenarioPoint[] {
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
