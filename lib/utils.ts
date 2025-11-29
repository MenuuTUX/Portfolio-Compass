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

  // 2. Calculate Standard Deviation
  const mean = changes.reduce((sum, val) => sum + val, 0) / changes.length;
  const variance = changes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / changes.length;
  const stdDev = Math.sqrt(variance);
  const stdDevPercent = stdDev * 100;

  // 3. Categorize Risk
  let label = "";
  let color = "";
  let bgColor = "";
  let borderColor = "";

  if (stdDevPercent > 2.5) {
    label = "Very High Risk";
    color = "text-rose-500";
    bgColor = "bg-rose-500/10";
    borderColor = "border-rose-500/20";
  } else if (stdDevPercent > 1.5) {
    label = "Risky";
    color = "text-orange-500";
    bgColor = "bg-orange-500/10";
    borderColor = "border-orange-500/20";
  } else if (stdDevPercent > 1.0) {
    label = "Neutral";
    color = "text-yellow-400";
    bgColor = "bg-yellow-400/10";
    borderColor = "border-yellow-400/20";
  } else if (stdDevPercent > 0.5) {
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

  return { stdDev, label, color, bgColor, borderColor };
}
