import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(value)
}

export function formatPercentage(value: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)
}

export interface RiskMetric {
  stdDev: number;
  label: string;
  color: string;      // Text color class (e.g. text-rose-500)
  bgColor: string;    // Background color class (e.g. bg-rose-500/10)
  borderColor: string; // Border color class (e.g. border-rose-500/20)
}

export function calculateRiskMetric(history: { date: string; price: number }[]): RiskMetric {
  if (!history || history.length < 2) {
    return {
      stdDev: 0,
      label: "Unknown",
      color: "text-neutral-400",
      bgColor: "bg-neutral-500/10",
      borderColor: "border-neutral-500/20"
    };
  }

  // 1. Calculate daily percent changes
  const changes: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].price;
    const curr = history[i].price;
    if (prev !== 0) {
      changes.push((curr - prev) / prev);
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

  // 2. Calculate Standard Deviation of Daily Returns
  const mean = changes.reduce((sum, val) => sum + val, 0) / changes.length;
  const variance = changes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / changes.length;
  const dailyStdDev = Math.sqrt(variance);

  // 3. Annualize Volatility
  // Annualized Volatility = Daily Std Dev * sqrt(252 trading days)
  const annualizedVolatility = dailyStdDev * Math.sqrt(252);
  const volatilityPercent = annualizedVolatility * 100;

  // 4. Categorize Risk (Based on Annualized Volatility)
  // Low: < 15%
  // Medium: 15% - 25%
  // High: 25% - 35%
  // Very High: > 35%

  let label = "";
  let color = "";
  let bgColor = "";
  let borderColor = "";

  if (volatilityPercent > 35) {
    label = "Very High Risk";
    color = "text-rose-500";
    bgColor = "bg-rose-500/10";
    borderColor = "border-rose-500/20";
  } else if (volatilityPercent > 25) {
    label = "High Risk";
    color = "text-orange-500";
    bgColor = "bg-orange-500/10";
    borderColor = "border-orange-500/20";
  } else if (volatilityPercent > 15) {
    label = "Medium Risk";
    color = "text-yellow-400";
    bgColor = "bg-yellow-400/10";
    borderColor = "border-yellow-400/20";
  } else {
    label = "Low Risk";
    color = "text-emerald-500";
    bgColor = "bg-emerald-500/10";
    borderColor = "border-emerald-500/20";
  }

  // Return the annualized volatility as the stdDev value
  return { stdDev: annualizedVolatility, label, color, bgColor, borderColor };
}
