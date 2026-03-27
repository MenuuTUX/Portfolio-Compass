"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Activity,
  Scale,
  Trophy,
  Minus,
  Layers,
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
import { cn, formatCurrency } from "@/lib/utils";
import { getAssetIconUrl } from "@/lib/etf-providers";
import SectorPieChart, { COLORS } from "./SectorPieChart";

// Helper to format sector names
const formatSectorName = (name: string) => {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

interface ComparisonModalProps {
  baseAsset: ETF;
  isOpen: boolean;
  onClose: () => void;
}

// ----------------------------------------------------------------------
// Helper Components
// ----------------------------------------------------------------------

function MetricRow({
  label,
  valueA,
  valueB,
  formatter,
  better,
}: {
  label: string;
  valueA: number | undefined;
  valueB: number | undefined;
  formatter: (v: number) => string;
  better: "A" | "B" | "Equal" | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors px-4 rounded-lg">
      {/* Asset A Value */}
      <div
        className={cn(
          "text-sm font-mono text-right",
          better === "A" ? "text-amber-400 font-bold" : "text-neutral-400",
        )}
      >
        {valueA !== undefined ? formatter(valueA) : "--"}
      </div>

      {/* Label / Winner Indicator */}
      <div className="flex flex-col items-center justify-center min-w-[100px]">
        <span className="text-xs text-neutral-500 uppercase font-semibold tracking-wider text-center">
          {label}
        </span>
        {better && better !== "Equal" && (
          <div
            className={cn(
              "mt-1 flex items-center justify-center w-5 h-5 rounded-full",
              better === "A" ? "bg-amber-500/10" : "bg-blue-500/10",
            )}
          >
            <Trophy
              className={cn(
                "w-3 h-3",
                better === "A" ? "text-amber-500" : "text-blue-500",
              )}
            />
          </div>
        )}
        {better === "Equal" && (
          <Minus className="w-3 h-3 mt-1 text-neutral-600" />
        )}
      </div>

      {/* Asset B Value */}
      <div
        className={cn(
          "text-sm font-mono text-left",
          better === "B" ? "text-blue-400 font-bold" : "text-neutral-400",
        )}
      >
        {valueB !== undefined ? formatter(valueB) : "--"}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export default function ComparisonModal({
  baseAsset,
  isOpen,
  onClose,
}: ComparisonModalProps) {
  const [compareAsset, setCompareAsset] = useState<ETF | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ETF[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (!isOpen) {
      setCompareAsset(null);
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [isOpen]);

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
          `/api/etfs/search?query=${searchQuery}${typeFilter}`,
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
    setIsSyncing(true);
    try {
      // Need full details including history and holdings
      const res = await fetch(
        `/api/etfs/search?query=${asset.ticker}&full=true`,
      );
      if (res.ok) {
        const data = await res.json();
        const fullDetails = data.find(
          (item: ETF) => item.ticker === asset.ticker,
        );
        if (fullDetails) {
          setCompareAsset(fullDetails);
        } else {
          // Fallback if exact match not found in array (unlikely)
          setCompareAsset(asset);
        }
      }
    } catch (err) {
      console.error("Failed to fetch full asset details", err);
    } finally {
      setIsSyncing(false);
      setSearchQuery(""); // Clear search for clean view
    }
  };

  const handleRemoveComparison = () => {
    setCompareAsset(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  // ----------------------------------------------------------------------
  // Comparison Logic: Winners & Metrics
  // ----------------------------------------------------------------------

  const metrics = useMemo(() => {
    if (!compareAsset) return [];

    const isStock = baseAsset.assetType === "STOCK";
    const list: any[] = [];

    // Helper to determine winner
    // rule: 'high' (higher wins), 'low' (lower wins), 'none' (just display)
    const addMetric = (
      label: string,
      key: keyof ETF | string,
      rule: "high" | "low" | "none",
      formatter: (v: number) => string,
      deepKey?: string,
    ) => {
      // Access nested properties if needed (e.g. metrics.yield)
      let valA: any = baseAsset;
      let valB: any = compareAsset;

      if (deepKey) {
        valA = valA[key]?.[deepKey];
        valB = valB[key]?.[deepKey];
      } else {
        valA = valA[key];
        valB = valB[key];
      }

      // normalize to number or undefined
      const numA = typeof valA === "number" ? valA : undefined;
      const numB = typeof valB === "number" ? valB : undefined;

      let better: "A" | "B" | "Equal" | null = null;
      if (rule !== "none" && numA !== undefined && numB !== undefined) {
        if (numA === numB) better = "Equal";
        else if (rule === "high") better = numA > numB ? "A" : "B";
        else if (rule === "low") better = numA < numB ? "A" : "B";
      }

      list.push({ label, valueA: numA, valueB: numB, formatter, better });
    };

    // Common Metrics
    addMetric("Price", "price", "none", (v) => formatCurrency(v));
    addMetric(
      "Change",
      "changePercent",
      "high",
      (v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`,
    );
    addMetric(
      "Market Cap",
      "marketCap",
      "high",
      (v) => (v / 1e9).toFixed(2) + "B",
    );
    addMetric("Volume", "volume", "high", (v) => (v / 1e6).toFixed(2) + "M");

    if (isStock) {
      addMetric("PE Ratio", "peRatio", "low", (v) => v.toFixed(2));
      addMetric("Beta", "beta", "low", (v) => v.toFixed(2)); // Generally lower beta = less risk = "better" for stability
      addMetric("EPS", "eps", "high", (v) => formatCurrency(v));
      addMetric(
        "Revenue",
        "revenue",
        "high",
        (v) => (v / 1e9).toFixed(2) + "B",
      );
      addMetric(
        "Div Yield",
        "dividendYield",
        "high",
        (v) => `${v.toFixed(2)}%`,
      );
    } else {
      // ETF Specific
      addMetric(
        "Expense Ratio",
        "metrics",
        "low",
        (v) => `${v.toFixed(2)}%`,
        "mer",
      );
      addMetric("Yield", "metrics", "high", (v) => `${v.toFixed(2)}%`, "yield");
      addMetric("Holdings", "holdingsCount", "high", (v) =>
        Math.round(v).toLocaleString(),
      ); // More holdings = more diversification? Subjective but let's say high wins
    }

    return list;
  }, [baseAsset, compareAsset]);

  // ----------------------------------------------------------------------
  // Chart Data Preparation
  // ----------------------------------------------------------------------

  const chartData = useMemo(() => {
    if (!compareAsset || !baseAsset.history || !compareAsset.history) return [];

    // Filter to 1Y or max overlapping range
    const historyA = baseAsset.history.filter(
      (h) => !h.interval || h.interval === "1d" || h.interval === "1wk",
    );
    const historyB = compareAsset.history.filter(
      (h) => !h.interval || h.interval === "1d" || h.interval === "1wk",
    );

    if (historyA.length === 0 || historyB.length === 0) return [];

    // Sort by date
    const sortedA = [...historyA].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const sortedB = [...historyB].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

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
  }, [baseAsset, compareAsset]);

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
      />
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 m-auto w-full max-w-6xl h-[90vh] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl z-[70] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-4">
            <Scale className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Asset Comparison</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* Asset Headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 mb-8">
            {/* Asset A (Left) */}
            <div className="flex flex-col items-center p-4 bg-amber-900/10 border border-amber-500/20 rounded-xl">
              <div className="w-12 h-12 mb-3">
                {getAssetIconUrl(
                  baseAsset.ticker,
                  baseAsset.name,
                  baseAsset.assetType,
                ) && (
                  <img
                    src={
                      getAssetIconUrl(
                        baseAsset.ticker,
                        baseAsset.name,
                        baseAsset.assetType,
                      )!
                    }
                    alt="A"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              <div className="text-2xl font-bold text-white">
                {baseAsset.ticker}
              </div>
              <div className="text-sm text-neutral-400 text-center line-clamp-1">
                {baseAsset.name}
              </div>
              <div
                className={cn(
                  "mt-2 font-mono",
                  baseAsset.changePercent >= 0
                    ? "text-amber-400"
                    : "text-rose-400",
                )}
              >
                {baseAsset.changePercent >= 0 ? "+" : ""}
                {baseAsset.changePercent.toFixed(2)}%
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 font-bold text-neutral-500 text-xs">
                VS
              </div>
            </div>

            {/* Asset B (Right) or Search */}
            {compareAsset ? (
              <div className="relative flex flex-col items-center p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl group">
                <button
                  onClick={handleRemoveComparison}
                  className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove Asset"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="w-12 h-12 mb-3">
                  {getAssetIconUrl(
                    compareAsset.ticker,
                    compareAsset.name,
                    compareAsset.assetType,
                  ) && (
                    <img
                      src={
                        getAssetIconUrl(
                          compareAsset.ticker,
                          compareAsset.name,
                          compareAsset.assetType,
                        )!
                      }
                      alt="B"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <div className="text-2xl font-bold text-white">
                  {compareAsset.ticker}
                </div>
                <div className="text-sm text-neutral-400 text-center line-clamp-1">
                  {compareAsset.name}
                </div>
                <div
                  className={cn(
                    "mt-2 font-mono",
                    compareAsset.changePercent >= 0
                      ? "text-amber-400"
                      : "text-rose-400",
                  )}
                >
                  {compareAsset.changePercent >= 0 ? "+" : ""}
                  {compareAsset.changePercent.toFixed(2)}%
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 border border-dashed border-white/20 rounded-xl h-full min-h-[160px]">
                <div className="w-full max-w-xs relative">
                  <input
                    type="text"
                    placeholder="Search to compare..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                    autoFocus
                  />
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-neutral-500" />

                  {/* Search Results Dropdown */}
                  {searchQuery && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto z-20">
                      {isSearching ? (
                        <div className="p-4 text-center text-xs text-neutral-500">
                          Searching...
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((item) => (
                          <button
                            key={item.ticker}
                            onClick={() => handleSelectAsset(item)}
                            className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center justify-between group"
                          >
                            <div>
                              <div className="font-bold text-white text-sm">
                                {item.ticker}
                              </div>
                              <div className="text-xs text-neutral-400 truncate w-40">
                                {item.name}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-amber-400" />
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs text-neutral-500">
                          No matching assets found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-4 text-xs text-neutral-500">
                  Select a {baseAsset.assetType === "STOCK" ? "Stock" : "ETF"}{" "}
                  to compare
                </div>
              </div>
            )}
          </div>

          {/* Comparison Content */}
          {compareAsset && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* 1. Comparison Chart */}
              <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-white">
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
                            stopColor="#10b981"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
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
                          backgroundColor: "#171717",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                        }}
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
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#gradA)"
                        name="valueA"
                      />
                      <Area
                        type="monotone"
                        dataKey="valueB"
                        stroke="#3b82f6"
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

              {/* 2. Key Metrics Head-to-Head */}
              <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-2 mb-6">
                  <Activity className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-white">
                    Head-to-Head Metrics
                  </h3>
                </div>
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-4 px-4 pb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
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
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex flex-col items-center">
                      <h4 className="text-sm font-bold text-white mb-4">
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
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex flex-col items-center">
                      <h4 className="text-sm font-bold text-white mb-4">
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
