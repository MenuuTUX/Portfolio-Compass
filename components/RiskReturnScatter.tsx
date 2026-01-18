"use client";

import React, { useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Label,
} from "recharts";
import { PortfolioItem } from "@/types";
import { Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RiskReturnScatterProps {
  items: PortfolioItem[];
}

export default function RiskReturnScatter({ items }: RiskReturnScatterProps) {
  const [showInfo, setShowInfo] = useState(false);

  const data = items.map((item) => {
    // Determine risk (Beta). Default to 1 (Market) if missing.
    const beta = item.beta ?? 1.0;

    // Determine return (Yield + 5Y Dividend Growth).
    const yieldVal = item.metrics?.yield ?? 0;
    const growthVal = item.dividendGrowth5Y ?? 0;
    const totalReturn = yieldVal + growthVal;

    return {
      ticker: item.ticker,
      name: item.name,
      x: beta, // Risk
      y: totalReturn, // Return
      z: item.weight, // Weight (Bubble size)
      fill: beta > 1.2 ? "#f43f5e" : beta < 0.8 ? "#10b981" : "#f59e0b", // Rose (High), Emerald (Low), Amber (Medium)
    };
  });

  return (
    <div className="w-full h-full min-h-[400px] glass-panel p-4 rounded-xl flex flex-col relative group">
      <div className="flex justify-between items-start mb-4 z-10">
        <div>
          <h3 className="text-sm font-medium text-neutral-200">
            Portfolio Efficiency
          </h3>
          <p className="text-xs text-neutral-500">
            Risk (Beta) vs Expected Return
          </p>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          aria-label="What does this mean?"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-4 z-20 bg-neutral-950/95 backdrop-blur-md border border-white/10 rounded-lg p-5 flex flex-col gap-3 shadow-2xl"
          >
            <div className="flex justify-between items-start">
              <h4 className="text-sm font-bold text-amber-400">
                Understanding Risk vs Return
              </h4>
              <button
                onClick={() => setShowInfo(false)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-neutral-300 space-y-2 leading-relaxed overflow-y-auto">
              <p>
                This chart helps you evaluate if you are being compensated
                enough for the risk you are taking.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-neutral-400">
                <li>
                  <strong className="text-white">
                    Vertical Axis (Return):
                  </strong>{" "}
                  Higher is better. It estimates total return (Yield + Growth).
                </li>
                <li>
                  <strong className="text-white">
                    Horizontal Axis (Risk/Beta):
                  </strong>{" "}
                  Measures volatility relative to the market.
                  <br />• Beta = 1.0: Same volatility as the market (S&P 500).
                  <br />• Beta &lt; 1.0: Less volatile (Safer).
                  <br />• Beta &gt; 1.0: More volatile (Riskier).
                </li>
              </ul>
              <p className="mt-2 text-amber-300 italic border-l-2 border-amber-500 pl-2">
                Goal: Find assets in the <strong>Top-Left</strong> (High Return,
                Low Risk). Avoid the Bottom-Right.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
            <XAxis
              type="number"
              dataKey="x"
              name="Risk (Beta)"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#404040" }}
              domain={["dataMin - 0.2", "dataMax + 0.2"]}
            >
              <Label
                value="Risk (Beta)"
                offset={0}
                position="bottom"
                fill="#525252"
                fontSize={10}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              name="Expected Return (%)"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#404040" }}
              unit="%"
            >
              <Label
                value="Return (%)"
                angle={-90}
                position="insideLeft"
                fill="#525252"
                fontSize={10}
              />
            </YAxis>
            <ZAxis type="number" dataKey="z" range={[60, 500]} name="Weight" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "#525252" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-neutral-950/90 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl min-w-[150px]">
                      <p className="font-bold text-white mb-2 border-b border-white/10 pb-1">
                        {d.ticker}
                      </p>
                      <div className="text-xs space-y-1.5">
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Risk (Beta):</span>
                          <span
                            className={
                              d.x > 1.2
                                ? "text-rose-400"
                                : d.x < 0.8
                                  ? "text-amber-400"
                                  : "text-amber-400"
                            }
                          >
                            {d.x.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Est. Return:</span>
                          <span className="text-amber-400">
                            {d.y.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Weight:</span>
                          <span className="text-white">{d.z.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* Market Baseline */}
            <ReferenceLine x={1} stroke="#525252" strokeDasharray="3 3">
              <Label
                value="Market (1.0)"
                position="insideTopRight"
                fill="#525252"
                fontSize={10}
                offset={10}
                className="hidden sm:block"
              />
            </ReferenceLine>

            {/* Low Risk Zone Indicator (Arbitrary visual guide) */}
            <ReferenceLine
              x={0.8}
              stroke="#10b981"
              strokeOpacity={0.2}
              strokeDasharray="5 5"
            />

            <Scatter name="Assets" data={data}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.fill}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth={1}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Subtle Quadrant Labels */}
        <div className="absolute top-4 left-10 text-[10px] text-amber-500/30 font-bold uppercase tracking-widest pointer-events-none hidden sm:block">
          High Return / Low Risk
        </div>
      </div>
    </div>
  );
}
