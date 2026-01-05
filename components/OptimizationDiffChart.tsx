"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { PortfolioItem } from "@/types";

interface OptimizationDiffChartProps {
  current: PortfolioItem[];
  proposed: PortfolioItem[];
}

export default function OptimizationDiffChart({
  current,
  proposed,
}: OptimizationDiffChartProps) {
  // Logic: Calculate delta shares for each ticker
  const data = React.useMemo(() => {
    const changes: { ticker: string; delta: number }[] = [];
    const processed = new Set<string>();

    // Process proposed (covers adds and modifications)
    proposed.forEach((pItem) => {
      processed.add(pItem.ticker);
      const cItem = current.find((c) => c.ticker === pItem.ticker);
      const currentShares = cItem ? cItem.shares : 0;
      const delta = pItem.shares - currentShares;
      if (delta !== 0) {
        changes.push({ ticker: pItem.ticker, delta });
      }
    });

    // Process removed items
    current.forEach((cItem) => {
      if (!processed.has(cItem.ticker)) {
        changes.push({ ticker: cItem.ticker, delta: -cItem.shares });
      }
    });

    return changes.sort((a, b) => b.delta - a.delta); // Sort by magnitude or positive first
  }, [current, proposed]);

  if (data.length === 0) return null;

  return (
    <div className="w-full h-[250px] glass-panel p-4 rounded-xl flex flex-col mb-4">
      <h3 className="text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">
        Proposed Changes (Shares)
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="ticker"
              tick={{ fill: "#a3a3a3", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  const isBuy = d.delta > 0;
                  return (
                    <div className="bg-stone-950/90 backdrop-blur-md border border-white/10 p-2 rounded-lg text-xs">
                      <span className="font-bold text-white">{d.ticker}: </span>
                      <span
                        className={isBuy ? "text-emerald-400" : "text-rose-400"}
                      >
                        {isBuy ? "+" : ""}
                        {d.delta.toFixed(2)} shares
                      </span>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine x={0} stroke="#525252" />
            <Bar dataKey="delta" radius={[2, 2, 2, 2]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.delta > 0 ? "#10b981" : "#f43f5e"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
