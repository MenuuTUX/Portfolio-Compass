"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Portfolio } from "@/types";
import { TickIcon } from "./TickIcon";

interface PortfolioBarChartProps {
  portfolio: Portfolio;
}

// Biopunk / Neon Aesthetic Palette (Lighter/Brighter)
const PALETTE = {
  emerald: { main: "#34d399", dark: "#059669" }, // Lighter Emerald
  blue: { main: "#60a5fa", dark: "#2563eb" }, // Lighter Blue
  violet: { main: "#a78bfa", dark: "#7c3aed" }, // Lighter Violet
  cyan: { main: "#22d3ee", dark: "#0891b2" }, // Lighter Cyan
  rose: { main: "#fb7185", dark: "#e11d48" }, // Lighter Rose
  amber: { main: "#fcd34d", dark: "#d97706" }, // Lighter Amber
  fuchsia: { main: "#e879f9", dark: "#c026d3" }, // Lighter Fuchsia
  sky: { main: "#38bdf8", dark: "#0284c7" }, // Lighter Sky
  indigo: { main: "#818cf8", dark: "#4f46e5" }, // Lighter Indigo
  lime: { main: "#a3e635", dark: "#65a30d" }, // Lighter Lime
  teal: { main: "#2dd4bf", dark: "#0d9488" }, // Lighter Teal
};

const SOURCE_COLORS = [
  PALETTE.blue,
  PALETTE.violet,
  PALETTE.cyan,
  PALETTE.fuchsia,
  PALETTE.indigo,
  PALETTE.sky,
  PALETTE.teal,
  PALETTE.lime,
];

// Risk Colors (Neon Pastel / Lighter)
const RISK_COLORS = {
  SAFE: "#6ee7b7", // Emerald-300
  WARN: "#fcd34d", // Amber-300
  HIGH: "#fdba74", // Orange-300
  CRIT: "#fda4af", // Rose-300
};

const getRiskColor = (totalWeight: number) => {
  if (totalWeight > 20) return RISK_COLORS.CRIT;
  if (totalWeight > 10) return RISK_COLORS.HIGH;
  if (totalWeight > 5) return RISK_COLORS.WARN;
  return RISK_COLORS.SAFE;
};

// Custom Y-Axis Tick Component
const CustomYAxisTick = (props: any) => {
  const { x, y, payload, riskMap } = props;
  const { value: ticker } = payload;

  const assetType = props.assetTypeMap?.[ticker] || "STOCK";

  const totalWeight = riskMap?.[ticker] || 0;
  const isHighRisk = totalWeight > 10;
  const isCriticalRisk = totalWeight > 20;

  return (
    <g transform={`translate(${x},${y})`}>
      <TickIcon ticker={ticker} x={0} y={0} assetType={assetType} />

      {isCriticalRisk && (
        <g transform="translate(-115, -9)">
          <circle
            cx={7}
            cy={7}
            r={10}
            fill={RISK_COLORS.CRIT}
            fillOpacity={0.2}
          />
          <AlertTriangle size={14} color={RISK_COLORS.CRIT} />
        </g>
      )}

      <text
        x={-10}
        y={4}
        textAnchor="end"
        fill={
          isCriticalRisk
            ? RISK_COLORS.CRIT
            : isHighRisk
              ? RISK_COLORS.HIGH
              : "#e5e5e5"
        }
        fontSize={12}
        fontWeight={isHighRisk ? "600" : "400"}
        className="font-mono tracking-tight"
      >
        {ticker}
      </text>
    </g>
  );
};

export default function PortfolioBarChart({
  portfolio,
}: PortfolioBarChartProps) {
  const { chartData, sources, riskMap, maxWeight, assetTypeMap } =
    useMemo(() => {
      const aggregatedData: {
        [holdingTicker: string]: {
          totalWeight: number;
          name: string;
          isCash: boolean;
          assetType: string;
          sources: { [source: string]: number };
        };
      } = {};

      const uniqueSources = new Set<string>();

      portfolio.forEach((item) => {
        const itemWeight = item.weight;
        const sourceName = item.ticker;

        if (item.holdings && item.holdings.length > 0) {
          uniqueSources.add(sourceName);
          let holdingsSumPercent = 0;

          item.holdings.forEach((h) => {
            const effectiveWeight = (itemWeight * h.weight) / 100;
            if (!aggregatedData[h.ticker]) {
              aggregatedData[h.ticker] = {
                totalWeight: 0,
                name: h.name,
                isCash: false,
                assetType: "STOCK", // Default to STOCK for look-through holdings
                sources: {},
              };
            }
            aggregatedData[h.ticker].totalWeight += effectiveWeight;
            aggregatedData[h.ticker].sources[sourceName] =
              (aggregatedData[h.ticker].sources[sourceName] || 0) +
              effectiveWeight;
            holdingsSumPercent += h.weight;
          });

          const residue = Math.max(0, 100 - holdingsSumPercent);
          if (residue > 1) {
            const effectiveResidue = (itemWeight * residue) / 100;
            const otherKey = "Other";
            if (!aggregatedData[otherKey]) {
              aggregatedData[otherKey] = {
                totalWeight: 0,
                name: "Other Assets",
                isCash: false,
                assetType: "STOCK",
                sources: {},
              };
            }
            aggregatedData[otherKey].totalWeight += effectiveResidue;
            aggregatedData[otherKey].sources[sourceName] =
              (aggregatedData[otherKey].sources[sourceName] || 0) +
              effectiveResidue;
          }
        } else {
          const holdingKey = item.ticker;
          const sourceKey = "Direct";
          uniqueSources.add(sourceKey);

          if (!aggregatedData[holdingKey]) {
            aggregatedData[holdingKey] = {
              totalWeight: 0,
              name: item.name,
              isCash: false,
              assetType: item.assetType || "STOCK", // Use actual asset type for direct holdings
              sources: {},
            };
          }
          aggregatedData[holdingKey].totalWeight += itemWeight;
          aggregatedData[holdingKey].sources[sourceKey] =
            (aggregatedData[holdingKey].sources[sourceKey] || 0) + itemWeight;
        }
      });

      const totalPortfolioAllocated = portfolio.reduce(
        (sum, item) => sum + item.weight,
        0,
      );
      const cashBuffer = Math.max(0, 100 - totalPortfolioAllocated);

      if (cashBuffer > 0.01) {
        uniqueSources.add("Direct");
        if (!aggregatedData["Cash"]) {
          aggregatedData["Cash"] = {
            totalWeight: 0,
            name: "Cash Buffer",
            isCash: true,
            assetType: "Cash",
            sources: {},
          };
        }
        aggregatedData["Cash"].totalWeight += cashBuffer;
        aggregatedData["Cash"].sources["Direct"] =
          (aggregatedData["Cash"].sources["Direct"] || 0) + cashBuffer;
      }

      let data = Object.entries(aggregatedData).map(([ticker, d]) => {
        const flat: any = {
          name: ticker,
          fullName: d.name,
          totalWeight: d.totalWeight,
          isCash: d.isCash,
          assetType: d.assetType,
        };
        Object.entries(d.sources).forEach(([src, w]) => {
          flat[src] = w;
        });
        return flat;
      });

      data.sort((a, b) => b.totalWeight - a.totalWeight);

      const MAX_ITEMS = 25;
      if (data.length > MAX_ITEMS) {
        data = data.slice(0, MAX_ITEMS);
      }

      const sourceList = Array.from(uniqueSources).sort((a, b) => {
        if (a === "Direct") return -1;
        if (b === "Direct") return 1;
        return a.localeCompare(b);
      });

      const rMap: Record<string, number> = {};
      const aMap: Record<string, string> = {}; // Asset Type Map
      let maxW = 0;
      data.forEach((d) => {
        rMap[d.name] = d.totalWeight;
        aMap[d.name] = d.assetType;
        if (d.totalWeight > maxW) maxW = d.totalWeight;
      });

      // Ensure X-Axis covers at least the zones (up to 25% to give buffer for 20% zone)
      if (maxW < 25) maxW = 25;

      return {
        chartData: data,
        sources: sourceList,
        riskMap: rMap,
        maxWeight: maxW,
        assetTypeMap: aMap,
      };
    }, [portfolio]);

  if (portfolio.length === 0) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center text-neutral-500 glass-panel rounded-xl">
        No assets in portfolio
      </div>
    );
  }

  const chartHeight = Math.max(450, chartData.length * 45); // Slightly taller rows

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full glass-panel p-6 rounded-xl flex flex-col border border-white/5 bg-gradient-to-br from-stone-950/50 to-stone-900/50"
    >
      <div className="flex flex-col gap-1 mb-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white tracking-tight">
            Portfolio Look-Through
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: RISK_COLORS.SAFE,
                  boxShadow: `0 0 8px ${RISK_COLORS.SAFE}80`,
                }}
              />
              <span className="text-neutral-400">Safe</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: RISK_COLORS.WARN,
                  boxShadow: `0 0 8px ${RISK_COLORS.WARN}80`,
                }}
              />
              <span className="text-neutral-400">Warning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: RISK_COLORS.CRIT,
                  boxShadow: `0 0 8px ${RISK_COLORS.CRIT}80`,
                }}
              />
              <span className="text-neutral-400">Critical</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-neutral-500 font-light">
          Breakdown of individual underlying holdings stacked by source.
        </p>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar pr-2">
        <div style={{ height: chartHeight, minHeight: 400, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 100, bottom: 20 }}
              barSize={20}
            >
              <defs>
                {/* Lighter Risk Gradients for Bars */}
                <linearGradient id="gradDirectSafe" x1="0" y1="0" x2="1" y2="0">
                  <stop
                    offset="0%"
                    stopColor={RISK_COLORS.SAFE}
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="100%"
                    stopColor={RISK_COLORS.SAFE}
                    stopOpacity={0.9}
                  />
                </linearGradient>
                <linearGradient id="gradDirectWarn" x1="0" y1="0" x2="1" y2="0">
                  <stop
                    offset="0%"
                    stopColor={RISK_COLORS.WARN}
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="100%"
                    stopColor={RISK_COLORS.WARN}
                    stopOpacity={0.9}
                  />
                </linearGradient>
                <linearGradient id="gradDirectHigh" x1="0" y1="0" x2="1" y2="0">
                  <stop
                    offset="0%"
                    stopColor={RISK_COLORS.HIGH}
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="100%"
                    stopColor={RISK_COLORS.HIGH}
                    stopOpacity={0.9}
                  />
                </linearGradient>
                <linearGradient id="gradDirectCrit" x1="0" y1="0" x2="1" y2="0">
                  <stop
                    offset="0%"
                    stopColor={RISK_COLORS.CRIT}
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="100%"
                    stopColor={RISK_COLORS.CRIT}
                    stopOpacity={0.9}
                  />
                </linearGradient>

                {/* Source Gradients (Lighter) */}
                {SOURCE_COLORS.map((color, idx) => (
                  <linearGradient
                    key={`gradSource${idx}`}
                    id={`gradSource${idx}`}
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <stop
                      offset="0%"
                      stopColor={color.main}
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="100%"
                      stopColor={color.main}
                      stopOpacity={0.9}
                    />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid
                strokeDasharray="4 4"
                horizontal={false}
                stroke="#ffffff"
                strokeOpacity={0.03}
              />

              <XAxis
                type="number"
                domain={[0, maxWeight]}
                stroke="#525252"
                tickFormatter={(val) => `${Number(val).toFixed(0)}%`}
                tick={{ fill: "#737373", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                type="category"
                dataKey="name"
                width={120}
                stroke="transparent"
                tick={
                  <CustomYAxisTick
                    riskMap={riskMap}
                    assetTypeMap={assetTypeMap}
                  />
                }
                interval={0}
              />

              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-stone-950/95 backdrop-blur-xl border border-white/10 p-4 rounded-xl text-xs shadow-2xl z-50 min-w-[220px]">
                        <div className="font-bold text-white mb-0.5 text-base tracking-tight">
                          {d.name}
                        </div>
                        <div className="text-neutral-500 mb-3 font-medium">
                          {d.fullName}
                        </div>

                        <div className="flex justify-between gap-6 border-t border-white/5 pt-3 mb-3">
                          <span className="text-neutral-400 font-medium">
                            Total Weight
                          </span>
                          <span
                            className="font-mono font-bold text-base"
                            style={{ color: getRiskColor(d.totalWeight) }}
                          >
                            {d.totalWeight.toFixed(2)}%
                          </span>
                        </div>

                        {d.totalWeight > 10 && (
                          <div className="flex items-start gap-2 mb-4 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg text-rose-200">
                            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                            <span className="leading-snug">
                              Concentration exceeds recommended limit (
                              {d.totalWeight > 20 ? "20%" : "10%"}).
                            </span>
                          </div>
                        )}

                        <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                          <span className="text-[10px] uppercase tracking-wider text-neutral-600 font-bold mb-1">
                            Source Breakdown
                          </span>
                          {[...payload]
                            .sort(
                              (a: any, b: any) =>
                                (b.value || 0) - (a.value || 0),
                            )
                            .map((entry: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex justify-between gap-4 items-center"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-1.5 h-1.5 rounded-full shadow-sm"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-neutral-300 font-medium">
                                    {entry.name}
                                  </span>
                                </div>
                                <span className="text-neutral-400 font-mono font-medium">
                                  {Number(entry.value).toFixed(2)}%
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{
                  paddingBottom: "20px",
                  fontSize: "11px",
                  opacity: 0.8,
                }}
                iconType="circle"
                iconSize={8}
              />

              {/* Concentration Areas (Background Zones) */}
              {/* Safe Zone: 0-5% */}
              <ReferenceArea
                x1={0}
                x2={5}
                fill={RISK_COLORS.SAFE}
                fillOpacity={0.03}
              />

              {/* Warning Zone: 5-10% */}
              <ReferenceArea
                x1={5}
                x2={10}
                fill={RISK_COLORS.WARN}
                fillOpacity={0.03}
              />

              {/* High Risk Zone: 10-20% */}
              <ReferenceArea
                x1={10}
                x2={20}
                fill={RISK_COLORS.HIGH}
                fillOpacity={0.03}
              />

              {/* Critical Zone: 20%+ */}
              <ReferenceArea
                x1={20}
                fill={RISK_COLORS.CRIT}
                fillOpacity={0.03}
              />

              {/* Divider Lines (Optional, subtle) */}
              <ReferenceLine
                x={5}
                stroke={RISK_COLORS.WARN}
                strokeDasharray="2 4"
                strokeOpacity={0.3}
              />
              <ReferenceLine
                x={10}
                stroke={RISK_COLORS.HIGH}
                strokeDasharray="2 4"
                strokeOpacity={0.4}
              />
              <ReferenceLine
                x={20}
                stroke={RISK_COLORS.CRIT}
                strokeDasharray="2 4"
                strokeOpacity={0.5}
              />

              {sources.map((source, index) => {
                const isLast = index === sources.length - 1;
                // Rounder bars: [0, 6, 6, 0]
                const radius: [number, number, number, number] = isLast
                  ? [0, 6, 6, 0]
                  : [0, 0, 0, 0];

                if (source === "Direct") {
                  return (
                    <Bar
                      key={source}
                      dataKey={source}
                      stackId="a"
                      radius={radius}
                    >
                      {chartData.map((entry, i) => {
                        let fillId = "url(#gradDirectSafe)";
                        if (entry.totalWeight > 20)
                          fillId = "url(#gradDirectCrit)";
                        else if (entry.totalWeight > 10)
                          fillId = "url(#gradDirectHigh)";
                        else if (entry.totalWeight > 5)
                          fillId = "url(#gradDirectWarn)";

                        return (
                          <Cell
                            key={`cell-${i}`}
                            fill={fillId}
                            strokeWidth={0}
                          />
                        );
                      })}
                    </Bar>
                  );
                }

                const colorIdx = index % SOURCE_COLORS.length;

                return (
                  <Bar
                    key={source}
                    dataKey={source}
                    stackId="a"
                    fill={`url(#gradSource${colorIdx})`}
                    radius={radius}
                    strokeWidth={0}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
