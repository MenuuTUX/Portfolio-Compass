"use client";

import { useId, useMemo, useState } from "react";
import {
  ChevronDown,
  RotateCcw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "./ui/HelpTip";
import { getSourcedYield, isUnverifiedProviderYield } from "@/lib/yield-provenance";
import { getSourcedExpenseRatio } from "@/lib/fee-provenance";

export type SortKey =
  | "relevance"
  | "name"
  | "price_asc"
  | "price_desc"
  | "change_desc"
  | "change_asc"
  | "yield_desc"
  | "mcap_desc"
  | "pe_asc"
  | "mer_asc"
  | "industry_asc"
  | "sector_asc";

export type PerformanceFilter = "all" | "gainers" | "losers" | "flat";
export type YieldFilter = "all" | "any" | "high" | "none";
export type SizeFilter = "all" | "mega" | "large" | "mid" | "small";
export type PeFilter = "all" | "value" | "growth" | "none";
export type MerFilter = "all" | "ultra_low" | "low" | "any";

export interface MarketFilterState {
  sort: SortKey;
  performance: PerformanceFilter;
  yieldFilter: YieldFilter;
  size: SizeFilter;
  pe: PeFilter;
  mer: MerFilter;
}

export const DEFAULT_MARKET_FILTERS: MarketFilterState = {
  sort: "relevance",
  performance: "all",
  yieldFilter: "all",
  size: "all",
  pe: "all",
  mer: "all",
};

interface MarketFiltersProps {
  assetType: "STOCK" | "ETF";
  value: MarketFilterState;
  onChange: (next: MarketFilterState) => void;
  resultCount?: number;
  className?: string;
  /** Always-open body with no toggle; the parent controls visibility. */
  embedded?: boolean;
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3 py-1.5 max-lg:min-h-11 text-xs font-medium transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass",
        active
          ? "bg-surface-soft text-ink ring-1 ring-hairline-strong"
          : "text-muted ring-1 ring-hairline hover:bg-surface-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  tip,
  children,
}: {
  title: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted">
        {tip ? (
          <HelpTip term={tip} showIcon={false} underline className="text-muted">
            {title}
          </HelpTip>
        ) : (
          <span>{title}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function MarketFilters({
  assetType,
  value,
  onChange,
  resultCount,
  className,
  embedded = false,
}: MarketFiltersProps) {
  const isStock = assetType === "STOCK";
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const sortOptions = useMemo(() => {
    const base: { key: SortKey; label: string }[] = [
      { key: "relevance", label: "Default" },
      { key: "name", label: "Name A to Z" },
      { key: "change_desc", label: "Top gainers" },
      { key: "change_asc", label: "Top losers" },
      { key: "price_desc", label: "Price: high" },
      { key: "price_asc", label: "Price: low" },
      { key: "yield_desc", label: "Highest sourced yield" },
    ];
    if (isStock) {
      base.push(
        { key: "mcap_desc", label: "Largest companies" },
        { key: "pe_asc", label: "Lowest P/E" },
        { key: "industry_asc", label: "Industry A to Z" },
        { key: "sector_asc", label: "Sector A to Z" },
      );
    } else {
      base.push(
        { key: "mcap_desc", label: "Largest funds" },
        { key: "mer_asc", label: "Lowest reported expense ratio" },
        // ETF sector/industry fields map to Yahoo fund category
        { key: "industry_asc", label: "Category A to Z" },
      );
    }
    return base;
  }, [isStock]);

  const set = <K extends keyof MarketFilterState>(
    key: K,
    val: MarketFilterState[K],
  ) => onChange({ ...value, [key]: val });

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (value.performance !== "all") n++;
    if (value.yieldFilter !== "all") n++;
    if (value.size !== "all") n++;
    if (value.pe !== "all") n++;
    if (value.mer !== "all") n++;
    if (value.sort !== "relevance") n++;
    return n;
  }, [value]);

  const reset = () => onChange({ ...DEFAULT_MARKET_FILTERS });

  return (
    <aside className={cn("w-full", className)} aria-label="Sort and filter">
      <div className="flex items-center justify-between gap-2 px-4 min-h-11">
        {embedded ? (
          <span className="flex items-center gap-2 min-h-11 text-sm font-bold text-ink">
            Sort & filter
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-body-strong">
                {activeFilterCount}
              </span>
            )}
          </span>
        ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex items-center gap-2 min-h-11 text-sm font-bold text-ink lg:pointer-events-none lg:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass rounded-lg"
        >
          Sort & filter
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-body-strong">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted lg:hidden transition-transform duration-75",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        )}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 min-h-11 px-2 text-xs font-medium text-muted hover:text-ink transition-colors duration-75"
            title="Clear all filters"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            Reset
          </button>
        )}
      </div>

      <div
        id={panelId}
        className={cn(
          "px-4 pb-4 space-y-4",
          embedded || open ? "block" : "hidden lg:block",
        )}
      >
        {resultCount !== undefined && (
          <p className="text-xs text-muted" aria-live="polite">
            <span className="text-ink font-medium font-mono">{resultCount}</span>{" "}
            {resultCount === 1 ? "result" : "results"}
          </p>
        )}

        <div className="space-y-2">
          <label htmlFor={`${panelId}-sort`} className="block text-xs font-medium text-muted">
            Sort by
          </label>
          <select
            id={`${panelId}-sort`}
            value={value.sort}
            onChange={(e) => set("sort", e.target.value as SortKey)}
            className="w-full h-11 lg:h-9 rounded-lg bg-surface-soft px-3 text-xs text-ink ring-1 ring-hairline focus-visible:outline-2 focus-visible:outline-compass"
          >
            {sortOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <Section title="Today's move" tip="Change Percent">
          <Chip active={value.performance === "all"} onClick={() => set("performance", "all")}>
            All
          </Chip>
          <Chip active={value.performance === "gainers"} onClick={() => set("performance", "gainers")}>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3" aria-hidden="true" /> Up today
            </span>
          </Chip>
          <Chip active={value.performance === "losers"} onClick={() => set("performance", "losers")}>
            <span className="inline-flex items-center gap-1">
              <TrendingDown className="w-3 h-3" aria-hidden="true" /> Down today
            </span>
          </Chip>
          <Chip active={value.performance === "flat"} onClick={() => set("performance", "flat")}>
            Flat (±0.5%)
          </Chip>
        </Section>

        <Section title="Dividends" tip="Dividend Yield">
          <Chip active={value.yieldFilter === "all"} onClick={() => set("yieldFilter", "all")}>
            Any
          </Chip>
          <Chip active={value.yieldFilter === "any"} onClick={() => set("yieldFilter", "any")}>
            Pays dividend (sourced)
          </Chip>
          <Chip active={value.yieldFilter === "high"} onClick={() => set("yieldFilter", "high")}>
            High sourced yield (3%+)
          </Chip>
          <Chip active={value.yieldFilter === "none"} onClick={() => set("yieldFilter", "none")}>
            Sourced zero yield
          </Chip>
        </Section>

        <Section title={isStock ? "Company size" : "Fund size"} tip="Market Cap">
          <Chip active={value.size === "all"} onClick={() => set("size", "all")}>
            Any size
          </Chip>
          <Chip active={value.size === "mega"} onClick={() => set("size", "mega")}>
            Mega ($200B+)
          </Chip>
          <Chip active={value.size === "large"} onClick={() => set("size", "large")}>
            Large ($10B to $200B)
          </Chip>
          <Chip active={value.size === "mid"} onClick={() => set("size", "mid")}>
            Mid ($2B to $10B)
          </Chip>
          <Chip active={value.size === "small"} onClick={() => set("size", "small")}>
            Small (&lt;$2B)
          </Chip>
        </Section>

        {isStock && (
          <Section title="Valuation" tip="PE Ratio">
            <Chip active={value.pe === "all"} onClick={() => set("pe", "all")}>
              Any P/E
            </Chip>
            <Chip active={value.pe === "value"} onClick={() => set("pe", "value")}>
              Value (P/E &lt; 20)
            </Chip>
            <Chip active={value.pe === "growth"} onClick={() => set("pe", "growth")}>
              Growth (P/E ≥ 20)
            </Chip>
            <Chip active={value.pe === "none"} onClick={() => set("pe", "none")}>
              No P/E data
            </Chip>
          </Section>
        )}

        {!isStock && (
          <Section title="Fees">
            <Chip active={value.mer === "all"} onClick={() => set("mer", "all")}>
              Any fee
            </Chip>
            <Chip active={value.mer === "ultra_low"} onClick={() => set("mer", "ultra_low")}>
              Under 0.10%
            </Chip>
            <Chip active={value.mer === "low"} onClick={() => set("mer", "low")}>
              Under 0.25%
            </Chip>
            <Chip active={value.mer === "any"} onClick={() => set("mer", "any")}>
              Has fee data
            </Chip>
          </Section>
        )}

        <p className="text-xs text-muted-soft leading-relaxed">
          Hover any dotted label (like{" "}
          <HelpTip term="PE Ratio" showIcon={false} className="text-muted">
            P/E
          </HelpTip>
          ) for a plain-English explanation.
        </p>
      </div>
    </aside>
  );
}

// Pure helpers used by ComparisonEngine to filter/sort lists

function assetYield(etf: {
  metrics?: { yield?: number | null; yieldSource?: string | null };
  dividendYield?: number | null;
}): number | null {
  if (isUnverifiedProviderYield(etf.metrics?.yieldSource)) return null;
  return getSourcedYield(etf.metrics, etf.dividendYield);
}

function assetMer(etf: { metrics?: { mer?: number | null; merSource?: string | null } }): number | null {
  return getSourcedExpenseRatio(etf.metrics);
}

function sizeBucket(mcap?: number): SizeFilter | "unknown" {
  if (mcap == null || !(mcap > 0)) return "unknown";
  if (mcap >= 200e9) return "mega";
  if (mcap >= 10e9) return "large";
  if (mcap >= 2e9) return "mid";
  return "small";
}

export function applyMarketFilters<
  T extends {
    ticker: string;
    name: string;
    price: number;
    changePercent: number;
    marketCap?: number;
    peRatio?: number;
    metrics?: { yield?: number | null; yieldSource?: string | null; mer?: number | null; merSource?: string | null };
    dividendYield?: number | null;
    industry?: string;
    sector?: string;
  },
>(items: T[], filters: MarketFilterState): T[] {
  let list = items.filter((item) => {
    // Performance
    if (filters.performance === "gainers" && !(item.changePercent > 0.5))
      return false;
    if (filters.performance === "losers" && !(item.changePercent < -0.5))
      return false;
    if (
      filters.performance === "flat" &&
      Math.abs(item.changePercent) > 0.5
    )
      return false;

    // Yield
    const y = assetYield(item);
    if (filters.yieldFilter !== "all" && y == null) return false;
    if (filters.yieldFilter === "any" && y! <= 0) return false;
    if (filters.yieldFilter === "high" && y! < 3) return false;
    if (filters.yieldFilter === "none" && y! > 0) return false;

    // Size
    if (filters.size !== "all") {
      const bucket = sizeBucket(item.marketCap);
      if (bucket !== filters.size) return false;
    }

    // P/E (stocks)
    if (filters.pe !== "all") {
      const pe = item.peRatio;
      if (filters.pe === "none") {
        if (pe != null && pe > 0) return false;
      } else if (filters.pe === "value") {
        if (pe == null || pe <= 0 || pe >= 20) return false;
      } else if (filters.pe === "growth") {
        if (pe == null || pe < 20) return false;
      }
    }

    // Require a sourced, finite, nonnegative expense ratio.
    if (filters.mer !== "all") {
      const mer = assetMer(item);
      const hasFee = mer != null;
      if (filters.mer === "any") {
        if (!hasFee) return false;
      } else if (filters.mer === "ultra_low") {
        if (!hasFee || mer! >= 0.1) return false;
      } else if (filters.mer === "low") {
        if (!hasFee || mer! >= 0.25) return false;
      }
    }

    return true;
  });

  const sorted = [...list];
  switch (filters.sort) {
    case "name":
      sorted.sort((a, b) => a.ticker.localeCompare(b.ticker));
      break;
    case "price_asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price_desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "change_desc":
      sorted.sort((a, b) => b.changePercent - a.changePercent);
      break;
    case "change_asc":
      sorted.sort((a, b) => a.changePercent - b.changePercent);
      break;
    case "yield_desc":
      sorted.sort((a, b) => {
        const ya = assetYield(a);
        const yb = assetYield(b);
        return ya == null ? (yb == null ? 0 : 1) : yb == null ? -1 : yb - ya;
      });
      break;
    case "mcap_desc":
      sorted.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
      break;
    case "pe_asc":
      sorted.sort((a, b) => {
        const pa = a.peRatio != null && a.peRatio > 0 ? a.peRatio : Infinity;
        const pb = b.peRatio != null && b.peRatio > 0 ? b.peRatio : Infinity;
        return pa - pb;
      });
      break;
    case "mer_asc":
      sorted.sort((a, b) => {
        const ma = assetMer(a) ?? Infinity;
        const mb = assetMer(b) ?? Infinity;
        return ma - mb;
      });
      break;
    case "industry_asc":
      sorted.sort((a, b) => {
        const ia = (a.industry || "").trim() || "\uffff";
        const ib = (b.industry || "").trim() || "\uffff";
        const c = ia.localeCompare(ib, undefined, { sensitivity: "base" });
        return c !== 0 ? c : a.ticker.localeCompare(b.ticker);
      });
      break;
    case "sector_asc":
      sorted.sort((a, b) => {
        const sa = (a.sector || a.industry || "").trim() || "\uffff";
        const sb = (b.sector || b.industry || "").trim() || "\uffff";
        const c = sa.localeCompare(sb, undefined, { sensitivity: "base" });
        return c !== 0 ? c : a.ticker.localeCompare(b.ticker);
      });
      break;
    case "relevance":
    default:
      // keep incoming order (recent / search relevance)
      break;
  }

  return sorted;
}
