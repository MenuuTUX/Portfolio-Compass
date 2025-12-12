import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Decimal } from "./decimal"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | Decimal) {
  const val = typeof value === 'number' ? value : value.toNumber();
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(val)
}

export function formatPercentage(value: number | Decimal) {
  const val = typeof value === 'number' ? value : value.toNumber();
  return new Intl.NumberFormat('en-CA', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val / 100)
}

export interface RiskMetric {
  stdDev: number; // Keep result as number for UI/logic consumption
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function calculateRiskMetric(history: { date: string; price: number | Decimal }[]): RiskMetric {
  if (!history || history.length < 2) {
    return {
      stdDev: 0,
      label: "Unknown",
      color: "text-neutral-400",
      bgColor: "bg-neutral-500/10",
      borderColor: "border-neutral-500/20"
    };
  }

  // 1. Calculate daily percent changes using Decimal for precision in calc
  const changes: Decimal[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = new Decimal(history[i - 1].price);
    const curr = new Decimal(history[i].price);
    if (!prev.isZero()) {
      // (curr - prev) / prev
      changes.push(curr.minus(prev).dividedBy(prev));
    }
  }

  if (changes.length === 0) {
    return {
      stdDev: 0,
      label: "Unknown",
      color: "text-neutral-400",
      bgColor: "bg-neutral-500/10",
      borderColor: "border-neutral-500/20"
    };
  }

  // 2. Calculate Standard Deviation
  const count = new Decimal(changes.length);
  const sum = changes.reduce((acc, val) => acc.plus(val), new Decimal(0));
  const mean = sum.dividedBy(count);

  const sumSquaredDiffs = changes.reduce((acc, val) => {
    const diff = val.minus(mean);
    return acc.plus(diff.pow(2));
  }, new Decimal(0));

  const variance = sumSquaredDiffs.dividedBy(count);
  const stdDev = variance.sqrt();
  const stdDevPercent = stdDev.times(100);

  // Convert to number for comparison and return
  const stdDevVal = stdDev.toNumber();
  const stdDevPercentVal = stdDevPercent.toNumber();

  // 3. Categorize Risk
  let label = "";
  let color = "";
  let bgColor = "";
  let borderColor = "";

  if (stdDevPercentVal > 2.5) {
    label = "Very High Risk";
    color = "text-rose-500";
    bgColor = "bg-rose-500/10";
    borderColor = "border-rose-500/20";
  } else if (stdDevPercentVal > 1.5) {
    label = "Risky";
    color = "text-orange-500";
    bgColor = "bg-orange-500/10";
    borderColor = "border-orange-500/20";
  } else if (stdDevPercentVal > 1.0) {
    label = "Neutral";
    color = "text-yellow-400";
    bgColor = "bg-yellow-400/10";
    borderColor = "border-yellow-400/20";
  } else if (stdDevPercentVal > 0.5) {
    label = "Safe";
    color = "text-emerald-500";
    bgColor = "bg-emerald-500/10";
    borderColor = "border-emerald-500/20";
  } else {
    label = "Very Safe";
    color = "text-blue-500";
    bgColor = "bg-blue-500/10";
    borderColor = "border-blue-500/20";
  }

  return { stdDev: stdDevVal, label, color, bgColor, borderColor };
}
