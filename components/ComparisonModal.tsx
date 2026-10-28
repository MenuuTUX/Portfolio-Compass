"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  ChevronRight,
  TrendingUp,
  Activity,
  Scale,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ETF } from "@/types";
import { cn, formatCurrency, formatSectorName } from "@/lib/utils";
import { getAssetIconUrl } from "@/lib/etf-providers";
import SectorPieChart from "./SectorPieChart";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { describeYieldProvenance, getSourcedYield, isUnverifiedProviderYield } from "@/lib/yield-provenance";
import { describeExpenseRatioProvenance, getSourcedExpenseRatio } from "@/lib/fee-provenance";

interface ComparisonModalProps {
  baseAsset: ETF;
  isOpen: boolean;
  onClose: () => void;
}

interface ComparisonMetric {
  label: string;
  valueA: number | null | undefined;
  valueB: number | null | undefined;
  titleA?: string;
  titleB?: string;
  formatter: (value: number, side: "A" | "B") => string;
}

// Helper Components

function MetricRow({
  label,
  valueA,
  valueB,
  titleA,
  titleB,
  formatter,
}: {
  label: string;
  valueA: number | null | undefined;
  valueB: number | null | undefined;
  titleA?: string;
  titleB?: string;
  formatter: (v: number, side: "A" | "B") => string;
}) {
  const peak = Math.max(Math.abs(valueA ?? 0), Math.abs(valueB ?? 0));
  const share = (v: number | null | undefined) =>
    v != null && peak > 0 ? Math.max(0.04, Math.abs(v) / peak) : 0;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3 border-b border-hairline last:border-0 hover:bg-surface-soft transition-colors duration-75 px-4">
      {/* Asset A Value */}
      <div className="text-sm font-mono text-right text-body-strong" title={titleA}>
        {valueA != null ? formatter(valueA, "A") : "N/A"}
        <motion.div
          aria-hidden="true"
          className="mt-1 ml-auto h-0.5 w-full origin-right rounded-full bg-compass/60"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: share(valueA) }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="flex flex-col items-center justify-center min-w-[100px]">
        <span className="text-xs text-muted text-center">
          {label}
        </span>
      </div>

      <div className="text-sm font-mono text-left text-body-strong" title={titleB}>
        {valueB != null ? formatter(valueB, "B") : "N/A"}
        <motion.div
          aria-hidden="true"
          className="mt-1 h-0.5 w-full origin-left rounded-full bg-body-strong/50"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: share(valueB) }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

// Main Component

export default function ComparisonModal({
  baseAsset,
  isOpen,
  onClose,
}: ComparisonModalProps) {
  const [compareAsset, setCompareAsset] = useState<ETF | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ETF[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [comparisonSeries, setComparisonSeries] = useState<
    Record<string, { date: string; price: number }[]>
  >({});
  const dialogRef = useDialogA11y<HTMLDivElement>(isOpen, onClose);

  // Reset state when modal opens
  useEffect(() => {
    if (!isOpen) {
      setCompareAsset(null);
      setSearchQuery("");
      setSearchResults([]);
      setComparisonSeries({});
    }
  }, [isOpen]);

  // Fetch aligned 1Y history for both assets from the fast market endpoint
  // (one round trip, no DB sync involved)
  useEffect(() => {
    if (!compareAsset || !isOpen) return;
    let cancelled = false;
    const tickers = `${baseAsset.ticker.toUpperCase()},${compareAsset.ticker.toUpperCase()}`;

    fetch(`/api/market/chart?tickers=${encodeURIComponent(tickers)}&range=1Y`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.series) setComparisonSeries(data.series);
      })
      .catch((err) => console.error("Comparison chart fetch failed:", err));

    return () => {
      cancelled = true;
    };
  }, [compareAsset, baseAsset.ticker, isOpen]);

  // Search Logic
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const typeFilter = baseAsset.assetType
          ? `&type=${baseAsset.assetType}`
          : "";
        const res = await fetch(
          `/api/market/search?query=${encodeURIComponent(searchQuery)}${typeFilter}`,
        );
        if (res.ok) {
          const data = await res.json();
          // Filter out the base asset
          setSearchResults(
            data.filter((item: ETF) => item.ticker !== baseAsset.ticker),
          );
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, baseAsset.assetType, baseAsset.ticker]);

  const handleSelectAsset = async (asset: ETF) => {
    // Show the selection immediately; live quote metrics merge in right after
    setCompareAsset(asset);
    try {
      const res = await fetch(
        `/api/market/snapshot?tickers=${asset.ticker}&history=false`,
      );
      if (res.ok) {
        const data = await res.json();
        const snap = Array.isArray(data)
          ? data.find(
              (item: ETF) => item.ticker === asset.ticker.toUpperCase(),
            )
          : null;
        if (snap) {
          // Merge live quote data over the search result without letting
          // placeholder fields clobber existing DB-backed values
          setCompareAsset({
            ...asset,
            ...snap,
            metrics: { ...asset.metrics, ...snap.metrics },
            sectors:
              asset.sectors && Object.keys(asset.sectors).length > 0
                ? asset.sectors
                : snap.sectors,
            allocation: asset.allocation ?? snap.allocation,
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch live quote for comparison:", err);
    } finally {
      setSearchQuery(""); // Clear search for clean view
    }
  };

  const handleRemoveComparison = () => {
    setCompareAsset(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const metrics = useMemo(() => {
    if (!compareAsset) return [];

    const isStock = baseAsset.assetType === "STOCK";
    const list: ComparisonMetric[] = [];

    const addMetric = (
      label: string,
      getValue: (asset: ETF) => number | null | undefined,
      formatter: (v: number, side: "A" | "B") => string,
      getProvenance?: (asset: ETF) => string | undefined,
    ) => {
      list.push({
        label,
        valueA: getValue(baseAsset),
        valueB: getValue(compareAsset),
        titleA: getProvenance?.(baseAsset),
        titleB: getProvenance?.(compareAsset),
        formatter,
      });
    };

    addMetric("Price", (asset) => asset.price, (v, side) =>
      formatCurrency(v, side === "A" ? baseAsset.currency : compareAsset.currency));
    addMetric(
      "Change",
      (asset) => asset.changePercent,
      (v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`,
    );
    addMetric(
      "Market Cap",
      (asset) => asset.marketCap,
      (v) => (v / 1e9).toFixed(2) + "B",
    );
    addMetric(
      "Volume",
      (asset) => asset.volume,
      (v) => (v / 1e6).toFixed(2) + "M",
    );

    if (isStock) {
      addMetric("PE Ratio", (asset) => asset.peRatio, (v) => v.toFixed(2));
      addMetric("Beta", (asset) => asset.beta, (v) => v.toFixed(2));
      addMetric("EPS", (asset) => asset.eps, (v, side) =>
        formatCurrency(v, side === "A" ? baseAsset.currency : compareAsset.currency));
      addMetric(
        "Revenue",
        (asset) => asset.revenue,
        (v) => (v / 1e9).toFixed(2) + "B",
      );
      addMetric(
        isUnverifiedProviderYield(baseAsset.metrics?.yieldSource) ||
          isUnverifiedProviderYield(compareAsset.metrics?.yieldSource)
          ? "Yahoo yield unavailable · unverified"
          : "Div Yield",
        (asset) => getSourcedYield(asset.metrics, asset.dividendYield),
        (v) => `${v.toFixed(2)}%`,
        (asset) => describeYieldProvenance(asset.metrics?.yieldSource, asset.metrics?.yieldRetrievedAt, asset.metrics?.yieldSourceField, asset.metrics?.yieldInputUnit, asset.metrics?.yieldNormalization, asset.metrics?.yieldMeasurementDate),
      );
    } else {
      addMetric(
        "Provider-reported expense ratio",
        (asset) => getSourcedExpenseRatio(asset.metrics),
        (v) => `${v.toFixed(2)}%`,
        (asset) => describeExpenseRatioProvenance(asset.metrics),
      );
      addMetric(
        isUnverifiedProviderYield(baseAsset.metrics?.yieldSource) ||
          isUnverifiedProviderYield(compareAsset.metrics?.yieldSource)
          ? "Yahoo yield unavailable · unverified"
          : "Yield",
        (asset) => getSourcedYield(asset.metrics, asset.dividendYield),
        (v) => `${v.toFixed(2)}%`,
        (asset) => describeYieldProvenance(asset.metrics?.yieldSource, asset.metrics?.yieldRetrievedAt, asset.metrics?.yieldSourceField, asset.metrics?.yieldInputUnit, asset.metrics?.yieldNormalization, asset.metrics?.yieldMeasurementDate),
      );
      addMetric("Holdings", (asset) => asset.holdingsCount, (v) =>
        Math.round(v).toLocaleString(),
      );
    }

    return list;
  }, [baseAsset, compareAsset]);

  // Chart Data Preparation

  const chartData = useMemo(() => {
    if (!compareAsset) return [];

    // Both series come pre-sorted at daily granularity from the fast
    // market endpoint, so alignment is straightforward
    const sortedA = comparisonSeries[baseAsset.ticker.toUpperCase()] || [];
    const sortedB = comparisonSeries[compareAsset.ticker.toUpperCase()] || [];

    if (sortedA.length === 0 || sortedB.length === 0) return [];

    // Find common start date
    const startA = new Date(sortedA[0].date).getTime();
    const startB = new Date(sortedB[0].date).getTime();
    const commonStart = Math.max(startA, startB);

    // Filter to common range
    const filteredA = sortedA.filter(
      (h) => new Date(h.date).getTime() >= commonStart,
    );
    const filteredB = sortedB.filter(
      (h) => new Date(h.date).getTime() >= commonStart,
    );

    if (filteredA.length === 0 || filteredB.length === 0) return [];

    // Normalize to percentage change from start
    const basePriceA = filteredA[0].price;
    const basePriceB = filteredB[0]?.price || 1; // Fallback

    // Map by date for alignment
    // We'll drive the chart x-axis by Asset A's dates and lookup B
    // (Assuming daily data, this is roughly fine for visualization)
    const dataPoints = filteredA
      .map((ptA) => {
        const dateStr = ptA.date;
        const dateObj = new Date(dateStr);

        // Find closest date in B (within 3 days tolerance)
        const ptB = filteredB.find(
          (p) =>
            Math.abs(new Date(p.date).getTime() - dateObj.getTime()) <
            3 * 24 * 60 * 60 * 1000,
        );

        if (!ptB) return null;

        return {
          date: dateStr,
          valueA: ((ptA.price - basePriceA) / basePriceA) * 100,
          valueB: ((ptB.price - basePriceB) / basePriceB) * 100,
          originalA: ptA.price,
          originalB: ptB.price,
        };
      })
      .filter((p) => p !== null);

    return dataPoints;
  }, [baseAsset, compareAsset, comparisonSeries]);

  // Render

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[60]"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comparison-modal-title"
        key="modal"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 m-auto w-full max-w-6xl h-[90dvh] bg-surface-card ring-1 ring-hairline rounded-2xl shadow-2xl z-[70] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
          <div className="flex items-center gap-4">
            <Scale className="w-5 h-5 text-muted" aria-hidden="true" />
            <h2 id="comparison-modal-title" className="text-base font-semibold text-ink">Asset Comparison</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close comparison"
            className="w-11 h-11 flex items-center justify-center hover:bg-surface-soft rounded-xl transition-colors duration-75"
          >
            <X className="w-5 h-5 text-body-strong" aria-hidden="true" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* Asset Headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 mb-8">
            {/* Asset A (Left) */}
            <div className="flex flex-col items-center p-4 bg-surface-soft rounded-2xl">
              <div className="w-12 h-12 mb-3">
                {getAssetIconUrl(
                  baseAsset.ticker,
                  baseAsset.name,
                  baseAsset.assetType,
                ) && (
                  <Image
                    src={
                      getAssetIconUrl(
                        baseAsset.ticker,
                        baseAsset.name,
                        baseAsset.assetType,
                      )!
                    }
                    alt="A"
                    width={48}
                    height={48}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              <div className="text-xl font-bold text-ink">
                {baseAsset.ticker}
              </div>
              <div className="text-xs text-muted text-center line-clamp-1">
                {baseAsset.name}
              </div>
              <div
                className={cn(
                  "mt-2 text-sm font-mono",
                  baseAsset.changePercent >= 0
                    ? "text-emerald-400"
                    : "text-rose-400",
                )}
              >
                {baseAsset.changePercent >= 0 ? "+" : ""}
                {baseAsset.changePercent.toFixed(2)}%
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-surface-soft flex items-center justify-center font-bold text-muted text-xs">
                VS
              </div>
            </div>

            {/* Asset B (Right) or Search */}
            {compareAsset ? (
              <div className="relative flex flex-col items-center p-4 bg-surface-soft rounded-2xl group">
                <button
                  onClick={handleRemoveComparison}
                  className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center hover:bg-hairline-strong text-body-strong rounded-xl transition-colors duration-75"
                  title="Remove asset"
                  aria-label="Remove asset"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
                <div className="w-12 h-12 mb-3">
                  {getAssetIconUrl(
                    compareAsset.ticker,
                    compareAsset.name,
                    compareAsset.assetType,
                  ) && (
                    <Image
                      src={
                        getAssetIconUrl(
                          compareAsset.ticker,
                          compareAsset.name,
                          compareAsset.assetType,
                        )!
                      }
                      alt="B"
                      width={48}
                      height={48}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <div className="text-xl font-bold text-ink">
                  {compareAsset.ticker}
                </div>
                <div className="text-xs text-muted text-center line-clamp-1">
                  {compareAsset.name}
                </div>
                <div
                  className={cn(
                    "mt-2 text-sm font-mono",
                    compareAsset.changePercent >= 0
                      ? "text-emerald-400"
                      : "text-rose-400",
                  )}
                >
                  {compareAsset.changePercent >= 0 ? "+" : ""}
                  {compareAsset.changePercent.toFixed(2)}%
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 border border-dashed border-hairline-strong rounded-2xl h-full min-h-[160px]">
                <div className="w-full max-w-xs relative">
                  <input
                    type="text"
                    aria-label="Search for an asset to compare"
                    placeholder="Search to compare..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 bg-surface-card ring-1 ring-hairline rounded-lg px-4 text-ink text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-compass"
                    autoFocus
                  />
                  <Search className="absolute right-3 top-3.5 w-4 h-4 text-muted" />

                  {/* Search Results Dropdown */}
                  {searchQuery && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface-card ring-1 ring-hairline-strong shadow-2xl rounded-lg overflow-hidden max-h-60 overflow-y-auto z-20">
                      {isSearching ? (
                        <div className="p-4 text-center text-xs text-muted">
                          Searching...
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((item) => (
                          <button
                            key={item.ticker}
                            onClick={() => handleSelectAsset(item)}
                            className="w-full text-left px-4 py-3 min-h-11 hover:bg-surface-soft transition-colors duration-75 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-ink text-sm">
                                {item.ticker}
                              </div>
                              <div className="text-xs text-muted truncate w-40">
                                {item.name}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-soft" />
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs text-muted">
                          No matching assets found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-4 text-xs text-muted">
                  Select a {baseAsset.assetType === "STOCK" ? "Stock" : "ETF"}{" "}
                  to compare
                </div>
              </div>
            )}
          </div>

          {/* Comparison Content */}
          {compareAsset && (
            <div className="space-y-4">
              {/* 1. Comparison Chart */}
              <div className="bg-surface-soft rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-muted" aria-hidden="true" />
                  <h3 className="text-base font-semibold text-ink">
                    Performance Comparison (Normalized)
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="#6dc382"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#6dc382"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="#8a8a8a"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#8a8a8a"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.08)"
                        vertical={false}
                      />
                      <XAxis dataKey="date" hide />
                      <YAxis
                        tickFormatter={(v) => `${v.toFixed(0)}%`}
                        orientation="right"
                        tick={{ fill: "#737373", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--surface-card)",
                          border: "1px solid var(--hairline)",
                          borderRadius: "8px",
                          color: "var(--ink)",
                        }}
                        itemStyle={{ color: "var(--ink)" }}
                        formatter={(val: any, name: any) => [
                          `${Number(val).toFixed(2)}%`,
                          name === "valueA"
                            ? baseAsset.ticker
                            : compareAsset.ticker,
                        ]}
                        labelFormatter={(l) => new Date(l).toLocaleDateString()}
                      />
                      <Area
                        type="monotone"
                        dataKey="valueA"
                        stroke="#6dc382"
                        strokeWidth={2}
                        fill="url(#gradA)"
                        name="valueA"
                      />
                      <Area
                        type="monotone"
                        dataKey="valueB"
                        stroke="#8a8a8a"
                        strokeWidth={2}
                        fill="url(#gradB)"
                        name="valueB"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  {/* SR Only Table for Chart */}
                  <table className="sr-only">
                    <caption>Performance Comparison Chart</caption>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>{baseAsset.ticker} Return</th>
                        <th>{compareAsset.ticker} Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((d, i) => (
                        <tr key={i}>
                          <td>{d.date}</td>
                          <td>{d.valueA.toFixed(2)}%</td>
                          <td>{d.valueB.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Key metrics */}
              <div className="bg-surface-soft rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-muted" aria-hidden="true" />
                  <h3 className="text-base font-semibold text-ink">
                    Side-by-Side Metrics
                  </h3>
                </div>
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-4 px-4 pb-2 text-xs font-medium text-muted">
                    <div className="text-right">{baseAsset.ticker}</div>
                    <div className="text-center">Metric</div>
                    <div className="text-left">{compareAsset.ticker}</div>
                  </div>
                  {metrics.map((m, i) => (
                    <MetricRow key={i} {...m} />
                  ))}
                </div>
              </div>

              {/* 3. Holdings & Sectors (ETF Only) */}
              {baseAsset.assetType === "ETF" &&
                compareAsset.assetType === "ETF" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Asset A Sector */}
                    <div className="bg-surface-soft rounded-2xl p-6 flex flex-col items-center">
                      <h4 className="text-sm font-bold text-ink mb-4">
                        {baseAsset.ticker} Allocation
                      </h4>
                      <div className="w-full h-[200px] flex justify-center">
                        <SectorPieChart
                          data={
                            baseAsset.sectors
                              ? Object.entries(baseAsset.sectors)
                                  .map(([k, v]) => ({
                                    name: formatSectorName(k),
                                    value: v * 100,
                                  }))
                                  .sort((a, b) => b.value - a.value)
                              : []
                          }
                        />
                      </div>
                    </div>
                    {/* Asset B Sector */}
                    <div className="bg-surface-soft rounded-2xl p-6 flex flex-col items-center">
                      <h4 className="text-sm font-bold text-ink mb-4">
                        {compareAsset.ticker} Allocation
                      </h4>
                      <div className="w-full h-[200px] flex justify-center">
                        <SectorPieChart
                          data={
                            compareAsset.sectors
                              ? Object.entries(compareAsset.sectors)
                                  .map(([k, v]) => ({
                                    name: formatSectorName(k),
                                    value: v * 100,
                                  }))
                                  .sort((a, b) => b.value - a.value)
                              : []
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
