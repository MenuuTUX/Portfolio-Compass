import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Decimal } from "./decimal";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const safeDecimal = (val: any) => {
  if (Decimal.isDecimal(val)) return val.toNumber();
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function formatCurrency(value: number | Decimal, currency?: string) {
  const val = Decimal.isDecimal(value) ? value.toNumber() : value;
  if (!currency || !/^[A-Z]{3}$/.test(currency)) {
    const amount = new Intl.NumberFormat("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
    return `${amount} ${currency ?? "(currency unavailable)"}`;
  }
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(val);
}

/** "financial_services" -> "Financial Services" */
export function formatSectorName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatPercentage(value: number | Decimal) {
  const val = Decimal.isDecimal(value) ? value.toNumber() : value;
  return new Intl.NumberFormat("en-CA", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val / 100);
}

export async function fetchWithUserAgent(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ...options?.headers,
    },
  });
}

export interface RiskMetric {
  stdDev: number; // Keep result as number for UI/logic consumption
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function calculateRiskMetric(
  history: { date: string; price: number | Decimal }[],
): RiskMetric {
  if (!history || history.length < 2) {
    return {
      stdDev: 0,
      label: "Unknown",
      color: "text-neutral-400",
      bgColor: "bg-neutral-500/10",
      borderColor: "border-neutral-500/20",
    };
  }

  // Daily percent changes, in Decimal to avoid float drift
  const changes: Decimal[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = new Decimal(history[i - 1].price);
    const curr = new Decimal(history[i].price);
    if (!prev.isZero()) {
      changes.push(curr.minus(prev).dividedBy(prev));
    }
  }

  if (changes.length === 0) {
    return {
      stdDev: 0,
      label: "Unknown",
      color: "text-neutral-400",
      bgColor: "bg-neutral-500/10",
      borderColor: "border-neutral-500/20",
    };
  }

  // Standard deviation
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

  const stdDevVal = stdDev.toNumber();
  const stdDevPercentVal = stdDevPercent.toNumber();

  return {
    stdDev: stdDevVal,
    label: `${stdDevPercentVal.toFixed(2)}% period variability`,
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
    borderColor: "border-sky-400/20",
  };
}
