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
  Label,
} from "recharts";
import { PortfolioItem } from "@/types";
import { Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getSourcedYield, isUnverifiedProviderYield } from "@/lib/yield-provenance";

interface RiskReturnScatterProps {
  items: PortfolioItem[];
}

export default function RiskReturnScatter({ items }: RiskReturnScatterProps) {
  const [showInfo, setShowInfo] = useState(false);
  const excludedYahooYieldCount = items.filter((item) =>
    isUnverifiedProviderYield(item.metrics?.yieldSource),
  ).length;

  const data = items.flatMap((item) => {
    const beta = item.beta;
    const yieldPercent = getSourcedYield(item.metrics, item.dividendYield);
    if (isUnverifiedProviderYield(item.metrics?.yieldSource) || beta == null || yieldPercent == null ||
        !Number.isFinite(beta) || !Number.isFinite(yieldPercent)) return [];
    return [{
      ticker: item.ticker,
      name: item.name,
      x: beta,
      y: yieldPercent,
      z: item.weight,
    }];
  });

  return (
    <div className="w-full h-full min-h-[400px] glass-panel p-4 rounded-card flex flex-col relative group">
      <div className="flex justify-between items-start mb-4 z-10">
        <div>
          <h3 className="text-sm font-medium text-neutral-200">
            Beta and sourced yield
          </h3>
          <p className="text-xs text-neutral-500">
            Reported beta vs sourced yield; Yahoo quote yields are excluded
            {data.length < items.length && ` · ${items.length - data.length} unavailable`}
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
            className="absolute inset-4 z-20 bg-stone-950/95 backdrop-blur-md border border-hairline rounded-card p-5 flex flex-col gap-3"
          >
            <div className="flex justify-between items-start">
              <h4 className="text-sm font-bold text-data-up">
                Reading this chart
              </h4>
              <button
                onClick={() => setShowInfo(false)}
                className="text-neutral-500 hover:text-ink"
                aria-label="Close chart explanation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-neutral-300 space-y-2 leading-relaxed overflow-y-auto">
              <p>
                This is a screening view of reported fields, not a return
                forecast or a complete measure of risk. Assets missing either
                field are omitted. Beta depends on the provider&apos;s benchmark
                and lookback period.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-neutral-400">
                <li>
                  <strong className="text-ink">
                    Vertical axis:
                  </strong>{" "}
                    Sourced dividend or distribution yield. It can change, is not a
                    measure of total return, and Yahoo quote yields are excluded
                    because their issuer-equivalent definition is unverified.
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
              name="Reported Beta"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#404040" }}
              domain={["dataMin - 0.2", "dataMax + 0.2"]}
            >
              <Label
                value="Reported Beta"
                offset={0}
                position="bottom"
                fill="#525252"
                fontSize={10}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              name="Sourced Yield (%)"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#404040" }}
              unit="%"
            >
              <Label
                value="Sourced Yield (%)"
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
                    <div className="bg-stone-950/90 backdrop-blur-md border border-hairline p-3 rounded-card min-w-[150px]">
                      <p className="font-bold text-ink mb-2 border-b border-hairline pb-1">
                        {d.ticker}
                      </p>
                      <div className="text-xs space-y-1.5">
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Reported Beta:</span>
                          <span className="text-ink">
                            {d.x.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">
                            Sourced Yield:
                          </span>
                          <span className="text-ink">
                            {d.y.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Target Weight:</span>
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

            <Scatter name="Assets" data={data} fill="#2b7fff" />
          </ScatterChart>
        </ResponsiveContainer>

        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
            {excludedYahooYieldCount > 0
              ? "No sourced yield and beta are available. Yahoo quote yields are excluded because their definition is unverified."
              : "Sourced beta and yield are unavailable for these holdings."}
          </div>
        )}
      </div>
    </div>
  );
}
