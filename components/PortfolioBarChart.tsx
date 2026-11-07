"use client";

import { percent } from "@/lib/format";
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
import { m as motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Portfolio } from "@/types";
import { TickIcon } from "./TickIcon";
import { HAIRLINE, LOSS, MUTED } from "@/lib/chart-colors";
import { CONCENTRATION_BANDS, lookThroughExposure } from "@/lib/math/portfolio-rollups";

interface PortfolioBarChartProps {
  portfolio: Portfolio;
}

// Chart series colors
const PALETTE = {
  emerald: { main: "#34d399", dark: "#059669" },
  blue: { main: "#60a5fa", dark: "#2563eb" },
  violet: { main: "#a78bfa", dark: "#7c3aed" },
  cyan: { main: "#22d3ee", dark: "#0891b2" },
  rose: { main: "#fb7185", dark: "#e11d48" },
  amber: { main: "#fcd34d", dark: "#d97706" },
  fuchsia: { main: "#e879f9", dark: "#c026d3" },
  sky: { main: "#38bdf8", dark: "#0284c7" },
  indigo: { main: "#818cf8", dark: "#4f46e5" },
  lime: { main: "#a3e635", dark: "#65a30d" },
  teal: { main: "#2dd4bf", dark: "#0d9488" },
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

const CONCENTRATION_COLORS = {
  UNDER_5: "#6ee7b7",
  FIVE_TO_10: "#fcd34d",
  TEN_TO_20: "#fdba74",
  ABOVE_20: "#fda4af",
};

const getConcentrationColor = (totalWeight: number) => {
  if (totalWeight > CONCENTRATION_BANDS.severe) return CONCENTRATION_COLORS.ABOVE_20;
  if (totalWeight > CONCENTRATION_BANDS.elevated) return CONCENTRATION_COLORS.TEN_TO_20;
  if (totalWeight > CONCENTRATION_BANDS.watch) return CONCENTRATION_COLORS.FIVE_TO_10;
  return CONCENTRATION_COLORS.UNDER_5;
};

const CustomYAxisTick = (props: any) => {
  const { x, y, payload, riskMap } = props;
  const { value: ticker } = payload;

  const assetType = props.assetTypeMap?.[ticker] || "STOCK";

  const totalWeight = riskMap?.[ticker] || 0;
  const isAboveTenPercent = totalWeight > CONCENTRATION_BANDS.elevated;
  const isAboveTwentyPercent = totalWeight > CONCENTRATION_BANDS.severe;

  return (
    <g transform={`translate(${x},${y})`}>
      {/* Layout inside the 150px axis, right to left: label ends at -8, logo at -124..-104, warning at -150..-130. */}
      <TickIcon ticker={ticker} x={-44} y={0} assetType={assetType} />

      {isAboveTwentyPercent && (
        <g transform="translate(-147, -7)">
          <circle
            cx={7}
            cy={7}
            r={10}
            fill={LOSS}
            fillOpacity={0.15}
          />
          <AlertTriangle size={14} color={LOSS} />
        </g>
      )}

      <text
        x={-10}
        y={4}
        textAnchor="end"
        fill={
          // Text uses theme tokens: the pastel bar fills are unreadable as text on the light canvas.
          isAboveTwentyPercent
            ? LOSS
            : isAboveTenPercent
              ? "var(--gold-deep)"
              : "var(--body-strong)"
        }
        fontSize={12}
        fontWeight={isAboveTenPercent ? "600" : "400"}
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
  const { chartData, sources, riskMap, maxWeight, assetTypeMap } = useMemo(() => {
    const { rows, sources } = lookThroughExposure(portfolio);
    const riskMap: Record<string, number> = {};
    const assetTypeMap: Record<string, string> = {};
    for (const row of rows) {
      riskMap[row.name] = row.totalWeight;
      assetTypeMap[row.name] = row.assetType;
    }
    // The axis always covers the concentration bands, with headroom past the top one.
    const maxWeight = Math.max(25, ...rows.map((row) => row.totalWeight));
    return { chartData: rows, sources, riskMap, maxWeight, assetTypeMap };
  }, [portfolio]);

  if (portfolio.length === 0) {
    return (
      <div className="w-full min-h-[200px] flex items-center justify-center text-muted glass-panel rounded-lg">
        No assets in portfolio
      </div>
    );
  }

  // Sized to the rows; the surrounding drawer scrolls, so no inner scroll box.
  const chartHeight = Math.max(220, chartData.length * 36 + 70);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full glass-panel p-4 rounded-lg flex flex-col border border-hairline bg-surface-card"
    >
      <div className="flex flex-col gap-1 mb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h3 className="text-lg font-bold text-ink tracking-tight sm:text-xl">
            Target Portfolio Look-Through
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: CONCENTRATION_COLORS.UNDER_5,
                  boxShadow: `0 0 8px ${CONCENTRATION_COLORS.UNDER_5}80`,
                }}
              />
              <span className="text-muted">Up to {CONCENTRATION_BANDS.watch}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: CONCENTRATION_COLORS.FIVE_TO_10,
                  boxShadow: `0 0 8px ${CONCENTRATION_COLORS.FIVE_TO_10}80`,
                }}
              />
              <span className="text-muted">{CONCENTRATION_BANDS.watch}% to {CONCENTRATION_BANDS.elevated}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: CONCENTRATION_COLORS.TEN_TO_20,
                  boxShadow: `0 0 8px ${CONCENTRATION_COLORS.TEN_TO_20}80`,
                }}
              />
              <span className="text-muted">{CONCENTRATION_BANDS.elevated}% to {CONCENTRATION_BANDS.severe}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: CONCENTRATION_COLORS.ABOVE_20,
                  boxShadow: `0 0 8px ${CONCENTRATION_COLORS.ABOVE_20}80`,
                }}
              />
              <span className="text-muted">Above {CONCENTRATION_BANDS.severe}%</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted font-light">
          Uses target weights and disclosed fund holdings. Incomplete
          fund data is grouped under the source ticker or Other.
        </p>
      </div>

      <div>
        <div style={{ height: chartHeight, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
              barSize={20}
            >
              <defs>
                <linearGradient id="gradDirectUnder5" x1="0" y1="0" x2="1" y2="0">
                  <stop
                    offset="0%"
                    stopColor={CONCENTRATION_COLORS.UNDER_5}
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="100%"
                    stopColor={CONCENTRATION_COLORS.UNDER_5}
                    stopOpacity={0.9}
                  />
                </linearGradient>
                <linearGradient id="gradDirectWarn" x1="0" y1="0" x2="1" y2="0">
                  <stop
                    offset="0%"
                    stopColor={CONCENTRATION_COLORS.FIVE_TO_10}
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="100%"
                    stopColor={CONCENTRATION_COLORS.FIVE_TO_10}
                    stopOpacity={0.9}
                  />
                </linearGradient>
                <linearGradient id="gradDirectHigh" x1="0" y1="0" x2="1" y2="0">
                  <stop
                    offset="0%"
                    stopColor={CONCENTRATION_COLORS.TEN_TO_20}
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="100%"
                    stopColor={CONCENTRATION_COLORS.TEN_TO_20}
                    stopOpacity={0.9}
                  />
                </linearGradient>
                <linearGradient id="gradDirectCrit" x1="0" y1="0" x2="1" y2="0">
                  <stop
                    offset="0%"
                    stopColor={CONCENTRATION_COLORS.ABOVE_20}
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="100%"
                    stopColor={CONCENTRATION_COLORS.ABOVE_20}
                    stopOpacity={0.9}
                  />
                </linearGradient>

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
                stroke={HAIRLINE}
              />

              <XAxis
                type="number"
                domain={[0, maxWeight]}
                stroke={MUTED}
                tickFormatter={(val) => percent(Number(val), 0)}
                tick={{ fill: MUTED, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                type="category"
                dataKey="name"
                width={150}
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
                cursor={{ fill: "var(--surface-soft)", fillOpacity: 0.5 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-surface-card ring-1 ring-hairline p-4 rounded-lg text-xs z-50 min-w-[220px]">
                        <div className="font-bold text-ink mb-0.5 text-base tracking-tight">
                          {d.name}
                        </div>
                        <div className="text-muted mb-3 font-medium">
                          {d.fullName}
                        </div>

                        <div className="flex justify-between gap-6 border-t border-hairline pt-3 mb-3">
                          <span className="text-muted font-medium">
                            Target Weight
                          </span>
                          <span
                            className="font-mono font-bold text-base"
                            style={{ color: getConcentrationColor(d.totalWeight) }}
                          >
                            {percent(d.totalWeight, 2)}
                          </span>
                        </div>

                        {d.totalWeight > CONCENTRATION_BANDS.elevated && (
                          <div className="flex items-start gap-2 mb-4 bg-surface-soft border border-hairline p-2.5 rounded-lg text-rose-200">
                            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                            <span className="leading-snug">
                              This holding represents more than{" "}
                              {d.totalWeight > CONCENTRATION_BANDS.severe ? CONCENTRATION_BANDS.severe : CONCENTRATION_BANDS.elevated}% of the
                              target allocation.
                            </span>
                          </div>
                        )}

                        <div className="flex flex-col gap-2 border-t border-hairline pt-3">
                          <span className="text-xs text-muted font-bold mb-1">
                            Source Breakdown
                          </span>
                          {[...payload]
                            .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
                            .map((entry, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between gap-4 items-center"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-neutral-300 font-medium">
                                    {entry.name}
                                  </span>
                                </div>
                                <span className="text-muted font-mono font-medium">
                                  {percent(Number(entry.value), 2)}
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

              <ReferenceArea
                x1={0}
                x2={CONCENTRATION_BANDS.watch}
                fill={CONCENTRATION_COLORS.UNDER_5}
                fillOpacity={0.03}
              />

              <ReferenceArea
                x1={CONCENTRATION_BANDS.watch}
                x2={CONCENTRATION_BANDS.elevated}
                fill={CONCENTRATION_COLORS.FIVE_TO_10}
                fillOpacity={0.03}
              />

              <ReferenceArea
                x1={CONCENTRATION_BANDS.elevated}
                x2={CONCENTRATION_BANDS.severe}
                fill={CONCENTRATION_COLORS.TEN_TO_20}
                fillOpacity={0.03}
              />

              <ReferenceArea
                x1={CONCENTRATION_BANDS.severe}
                fill={CONCENTRATION_COLORS.ABOVE_20}
                fillOpacity={0.03}
              />

              <ReferenceLine
                x={CONCENTRATION_BANDS.watch}
                stroke={CONCENTRATION_COLORS.FIVE_TO_10}
                strokeDasharray="2 4"
                strokeOpacity={0.3}
              />
              <ReferenceLine
                x={CONCENTRATION_BANDS.elevated}
                stroke={CONCENTRATION_COLORS.TEN_TO_20}
                strokeDasharray="2 4"
                strokeOpacity={0.4}
              />
              <ReferenceLine
                x={CONCENTRATION_BANDS.severe}
                stroke={CONCENTRATION_COLORS.ABOVE_20}
                strokeDasharray="2 4"
                strokeOpacity={0.5}
              />

              {sources.map((source, index) => {
                const isLast = index === sources.length - 1;
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
                        let fillId = "url(#gradDirectUnder5)";
                        if (entry.totalWeight > CONCENTRATION_BANDS.severe)
                          fillId = "url(#gradDirectCrit)";
                        else if (entry.totalWeight > CONCENTRATION_BANDS.elevated)
                          fillId = "url(#gradDirectHigh)";
                        else if (entry.totalWeight > CONCENTRATION_BANDS.watch)
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
