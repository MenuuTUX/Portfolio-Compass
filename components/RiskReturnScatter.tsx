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
    // Use market beta when available. Missing values sit at the market baseline.
    const beta = item.beta ?? 1.0;
    const yieldVal = item.metrics?.yield ?? 0;
    const growthVal = item.dividendGrowth5Y ?? 0;
    const dividendSignal = yieldVal + growthVal;

    return {
      ticker: item.ticker,
      name: item.name,
      x: beta,
      y: dividendSignal,
      z: item.weight,
      fill: beta > 1.2 ? "#f43f5e" : beta < 0.8 ? "#10b981" : "#f59e0b",
    };
  });

  return (
    <div className="w-full h-full min-h-[400px] glass-panel p-4 rounded-xl flex flex-col relative group">
      <div className="flex justify-between items-start mb-4 z-10">
        <div>
          <h3 className="text-sm font-medium text-neutral-200">
            Beta and dividend metrics
          </h3>
          <p className="text-xs text-neutral-500">
            Market beta vs yield plus 5-year dividend growth
          </p>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1.5 rounded-full hover:bg-surface-soft text-neutral-400 hover:text-ink transition-colors"
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
            className="absolute inset-4 z-20 bg-stone-950/95 backdrop-blur-md border border-hairline rounded-lg p-5 flex flex-col gap-3 shadow-2xl"
          >
            <div className="flex justify-between items-start">
              <h4 className="text-sm font-bold text-emerald-400">
                Reading this chart
              </h4>
              <button
                onClick={() => setShowInfo(false)}
                className="text-neutral-500 hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-neutral-300 space-y-2 leading-relaxed overflow-y-auto">
              <p>
                This is a screening view. It does not estimate future returns or
                measure every form of investment risk.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-neutral-400">
                <li>
                  <strong className="text-ink">
                    Vertical axis:
                  </strong>{" "}
                  Dividend yield plus five-year dividend growth. Adding the two
                  creates a simple dividend signal, not a total-return forecast.
                </li>
                <li>
                  <strong className="text-ink">
                    Horizontal axis:
                  </strong>{" "}
                  Beta measures historical price sensitivity to a benchmark.
                  <br />Beta = 1.0: moved roughly with the benchmark.
                  <br />Beta &lt; 1.0: moved less than the benchmark.
                  <br />Beta &gt; 1.0: moved more than the benchmark.
                </li>
              </ul>
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
              name="Market Beta"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#404040" }}
              domain={["dataMin - 0.2", "dataMax + 0.2"]}
            >
              <Label
                value="Market Beta"
                offset={0}
                position="bottom"
                fill="#525252"
                fontSize={10}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              name="Dividend Signal (%)"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#404040" }}
              unit="%"
            >
              <Label
                value="Yield + 5Y Dividend Growth (%)"
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
                    <div className="bg-stone-950/90 backdrop-blur-md border border-hairline p-3 rounded-lg shadow-xl min-w-[150px]">
                      <p className="font-bold text-ink mb-2 border-b border-hairline pb-1">
                        {d.ticker}
                      </p>
                      <div className="text-xs space-y-1.5">
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Market Beta:</span>
                          <span
                            className={
                              d.x > 1.2
                                ? "text-rose-400"
                                : d.x < 0.8
                                  ? "text-emerald-400"
                                  : "text-amber-400"
                            }
                          >
                            {d.x.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">
                            Dividend Signal:
                          </span>
                          <span className="text-emerald-400">
                            {d.y.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Weight:</span>
                          <span className="text-ink">{d.z.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* Market beta baseline */}
            <ReferenceLine x={1} stroke="#525252" strokeDasharray="3 3">
              <Label
                value="Beta 1.0"
                position="insideTopRight"
                fill="#525252"
                fontSize={10}
                offset={10}
                className="hidden sm:block"
              />
            </ReferenceLine>

            {/* Visual guide for lower beta values */}
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
                  stroke="rgba(50,48,47,0.1)"
                  strokeWidth={1}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        <div className="absolute top-4 left-10 text-[10px] text-emerald-500/30 font-bold uppercase tracking-widest pointer-events-none hidden sm:block">
          Higher dividend signal / lower beta
        </div>
      </div>
    </div>
  );
}
