"use client";

import { useMemo } from "react";
import {
  ArrowUpDown,
  Filter,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Coins,
  Building2,
  Percent,
  CircleDollarSign,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "./ui/HelpTip";

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
      className={cn(
        "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all",
        active
          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_-4px_rgba(16,185,129,0.5)]"
          : "bg-surface-card border-hairline text-neutral-400 hover:text-ink hover:border-hairline-strong",
      )}
    >
      {children}
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  tip,
  children,
}: {
  icon: React.ElementType;
  title: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5 text-neutral-500" />
        {tip ? (
          <HelpTip term={tip} showIcon underline className="text-neutral-400">
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
}: MarketFiltersProps) {
  const isStock = assetType === "STOCK";

  const sortOptions = useMemo(() => {
    const base: { key: SortKey; label: string }[] = [
      { key: "relevance", label: "Default" },
      { key: "name", label: "Name A to Z" },
      { key: "change_desc", label: "Top gainers" },
      { key: "change_asc", label: "Top losers" },
      { key: "price_desc", label: "Price: high" },
      { key: "price_asc", label: "Price: low" },
      { key: "yield_desc", label: "Highest yield" },
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
        { key: "mer_asc", label: "Lowest fees" },
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
    <aside
      className={cn(
        "w-full lg:w-64 shrink-0 rounded-2xl border border-hairline bg-surface-card/80 backdrop-blur-md p-5 space-y-6 h-fit lg:sticky lg:top-20",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-ink font-bold text-sm">
            <Filter className="w-4 h-4 text-emerald-400" />
            Sort & Filter
          </div>
          <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
            Narrow {isStock ? "stocks" : "ETFs"} to what matches your goals.
          </p>
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-emerald-400 transition-colors"
            title="Clear all filters"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {resultCount !== undefined && (
        <div className="text-[11px] text-neutral-400 bg-black/20 rounded-lg px-3 py-2 border border-hairline">
          Showing{" "}
          <span className="text-ink font-semibold font-mono">{resultCount}</span>{" "}
          {resultCount === 1 ? "result" : "results"}
          {activeFilterCount > 0 && (
            <span className="text-emerald-400/80">
              {" "}
              · {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Sort */}
      <Section icon={ArrowUpDown} title="Sort by">
        {sortOptions.map((opt) => (
          <Chip
            key={opt.key}
            active={value.sort === opt.key}
            onClick={() => set("sort", opt.key)}
          >
            {opt.label}
          </Chip>
        ))}
      </Section>

      {/* Today's move */}
      <Section icon={TrendingUp} title="Today's move" tip="Change Percent">
        <Chip
          active={value.performance === "all"}
          onClick={() => set("performance", "all")}
        >
          All
        </Chip>
        <Chip
          active={value.performance === "gainers"}
          onClick={() => set("performance", "gainers")}
        >
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Up today
          </span>
        </Chip>
        <Chip
          active={value.performance === "losers"}
          onClick={() => set("performance", "losers")}
        >
          <span className="inline-flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> Down today
          </span>
        </Chip>
        <Chip
          active={value.performance === "flat"}
          onClick={() => set("performance", "flat")}
        >
          Flat (±0.5%)
        </Chip>
      </Section>

      {/* Dividends */}
      <Section icon={Coins} title="Dividends" tip="Dividend Yield">
        <Chip
          active={value.yieldFilter === "all"}
          onClick={() => set("yieldFilter", "all")}
        >
          Any
        </Chip>
        <Chip
          active={value.yieldFilter === "any"}
          onClick={() => set("yieldFilter", "any")}
        >
          Pays dividend
        </Chip>
        <Chip
          active={value.yieldFilter === "high"}
          onClick={() => set("yieldFilter", "high")}
        >
          High yield (3%+)
        </Chip>
        <Chip
          active={value.yieldFilter === "none"}
          onClick={() => set("yieldFilter", "none")}
        >
          No dividend
        </Chip>
      </Section>

      {/* Size */}
      <Section
        icon={Building2}
        title={isStock ? "Company size" : "Fund size"}
        tip="Market Cap"
      >
        <Chip active={value.size === "all"} onClick={() => set("size", "all")}>
          Any size
        </Chip>
        <Chip
          active={value.size === "mega"}
          onClick={() => set("size", "mega")}
        >
          Mega ($200B+)
        </Chip>
        <Chip
          active={value.size === "large"}
          onClick={() => set("size", "large")}
        >
          Large ($10B to $200B)
        </Chip>
        <Chip active={value.size === "mid"} onClick={() => set("size", "mid")}>
          Mid ($2B to $10B)
        </Chip>
        <Chip
          active={value.size === "small"}
          onClick={() => set("size", "small")}
        >
          Small (&lt;$2B)
        </Chip>
      </Section>

      {/* Stock valuation */}
      {isStock && (
        <Section icon={Percent} title="Valuation" tip="PE Ratio">
          <Chip active={value.pe === "all"} onClick={() => set("pe", "all")}>
            Any P/E
          </Chip>
          <Chip
            active={value.pe === "value"}
            onClick={() => set("pe", "value")}
          >
            Value (P/E &lt; 20)
          </Chip>
          <Chip
            active={value.pe === "growth"}
            onClick={() => set("pe", "growth")}
          >
            Growth (P/E ≥ 20)
          </Chip>
          <Chip active={value.pe === "none"} onClick={() => set("pe", "none")}>
            No P/E data
          </Chip>
        </Section>
      )}

      {/* ETF fees */}
      {!isStock && (
        <Section icon={CircleDollarSign} title="Fees" tip="Expense Ratio">
          <Chip active={value.mer === "all"} onClick={() => set("mer", "all")}>
            Any fee
          </Chip>
          <Chip
            active={value.mer === "ultra_low"}
            onClick={() => set("mer", "ultra_low")}
          >
            Ultra-low (&lt;0.10%)
          </Chip>
          <Chip
            active={value.mer === "low"}
            onClick={() => set("mer", "low")}
          >
            Low (&lt;0.25%)
          </Chip>
          <Chip active={value.mer === "any"} onClick={() => set("mer", "any")}>
            Has fee data
          </Chip>
        </Section>
      )}

      <div className="pt-2 border-t border-hairline">
        <div className="flex items-start gap-2 text-[10px] text-neutral-500 leading-relaxed">
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500/70" />
          <p>
            Hover any dotted label (like{" "}
            <HelpTip term="PE Ratio" showIcon={false} className="text-neutral-400">
              P/E
            </HelpTip>
            ) for a plain-English explanation.
          </p>
        </div>
      </div>
    </aside>
  );
}

// Pure helpers used by ComparisonEngine to filter/sort lists

function assetYield(etf: {
  metrics?: { yield?: number };
  dividendYield?: number;
}): number {
  const y = etf.metrics?.yield || etf.dividendYield || 0;
  return Number(y) || 0;
}

function assetMer(etf: { metrics?: { mer?: number } }): number | null {
  const m = etf.metrics?.mer;
  if (m == null || !Number.isFinite(m)) return null;
  return m;
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
    metrics?: { yield?: number; mer?: number };
    dividendYield?: number;
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
    if (filters.yieldFilter === "any" && y <= 0) return false;
    if (filters.yieldFilter === "high" && y < 3) return false;
    if (filters.yieldFilter === "none" && y > 0) return false;

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

    // Treat a zero or missing MER as unavailable fee data.
    if (filters.mer !== "all") {
      const mer = assetMer(item);
      const hasFee = mer != null && mer > 0;
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
      sorted.sort((a, b) => assetYield(b) - assetYield(a));
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
