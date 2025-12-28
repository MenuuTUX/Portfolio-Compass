'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Label,
  Legend,
  ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { AlertTriangle, Info } from 'lucide-react';
import { Portfolio } from '@/types';
import { TickIcon } from './TickIcon';

interface PortfolioBarChartProps {
  portfolio: Portfolio;
}

// Biopunk / Neon Aesthetic Palette
const PALETTE = {
  emerald: { main: '#10b981', dark: '#047857' },
  blue: { main: '#3b82f6', dark: '#1d4ed8' },
  violet: { main: '#8b5cf6', dark: '#6d28d9' },
  cyan: { main: '#06b6d4', dark: '#0e7490' },
  rose: { main: '#f43f5e', dark: '#be123c' },
  amber: { main: '#f59e0b', dark: '#b45309' },
  fuchsia: { main: '#d946ef', dark: '#a21caf' },
  sky: { main: '#0ea5e9', dark: '#0369a1' },
  indigo: { main: '#6366f1', dark: '#4338ca' },
  lime: { main: '#84cc16', dark: '#4d7c0f' },
  teal: { main: '#14b8a6', dark: '#0f766e' },
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

// Risk Colors (Neon)
const RISK_COLORS = {
  SAFE: '#10b981', // Emerald
  WARN: '#facc15', // Yellow/Amber
  HIGH: '#fb923c', // Orange
  CRIT: '#f43f5e', // Rose
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

  const totalWeight = riskMap?.[ticker] || 0;
  const isHighRisk = totalWeight > 10;
  const isCriticalRisk = totalWeight > 20;

  return (
    <g transform={`translate(${x},${y})`}>
      <TickIcon ticker={ticker} x={0} y={0} />

      {isCriticalRisk && (
        <g transform="translate(-115, -9)">
          <circle cx={7} cy={7} r={10} fill={RISK_COLORS.CRIT} fillOpacity={0.2} />
          <AlertTriangle size={14} color={RISK_COLORS.CRIT} />
        </g>
      )}

      <text
        x={-10}
        y={4}
        textAnchor="end"
        fill={isCriticalRisk ? RISK_COLORS.CRIT : isHighRisk ? RISK_COLORS.HIGH : '#e5e5e5'}
        fontSize={12}
        fontWeight={isHighRisk ? '600' : '400'}
        className="font-mono tracking-tight"
      >
        {ticker}
      </text>
    </g>
  );
};

export default function PortfolioBarChart({ portfolio }: PortfolioBarChartProps) {
  const { chartData, sources, riskMap } = useMemo(() => {
    const aggregatedData: {
      [holdingTicker: string]: {
        totalWeight: number;
        name: string;
        isCash: boolean;
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
              sources: {},
            };
          }
          aggregatedData[h.ticker].totalWeight += effectiveWeight;
          aggregatedData[h.ticker].sources[sourceName] =
            (aggregatedData[h.ticker].sources[sourceName] || 0) + effectiveWeight;
          holdingsSumPercent += h.weight;
        });

        const residue = Math.max(0, 100 - holdingsSumPercent);
        if (residue > 1) {
          const effectiveResidue = (itemWeight * residue) / 100;
          const otherKey = 'Other';
          if (!aggregatedData[otherKey]) {
            aggregatedData[otherKey] = {
              totalWeight: 0,
              name: 'Other Assets',
              isCash: false,
              sources: {},
            };
          }
          aggregatedData[otherKey].totalWeight += effectiveResidue;
          aggregatedData[otherKey].sources[sourceName] =
            (aggregatedData[otherKey].sources[sourceName] || 0) + effectiveResidue;
        }
      } else {
        const holdingKey = item.ticker;
        const sourceKey = 'Direct';
        uniqueSources.add(sourceKey);

        if (!aggregatedData[holdingKey]) {
          aggregatedData[holdingKey] = {
            totalWeight: 0,
            name: item.name,
            isCash: false,
            sources: {},
          };
        }
        aggregatedData[holdingKey].totalWeight += itemWeight;
        aggregatedData[holdingKey].sources[sourceKey] =
          (aggregatedData[holdingKey].sources[sourceKey] || 0) + itemWeight;
      }
    });

    const totalPortfolioAllocated = portfolio.reduce((sum, item) => sum + item.weight, 0);
    const cashBuffer = Math.max(0, 100 - totalPortfolioAllocated);

    if (cashBuffer > 0.01) {
      uniqueSources.add('Direct');
      if (!aggregatedData['Cash']) {
        aggregatedData['Cash'] = {
          totalWeight: 0,
          name: 'Cash Buffer',
          isCash: true,
          sources: {},
        };
      }
      aggregatedData['Cash'].totalWeight += cashBuffer;
      aggregatedData['Cash'].sources['Direct'] =
        (aggregatedData['Cash'].sources['Direct'] || 0) + cashBuffer;
    }

    let data = Object.entries(aggregatedData).map(([ticker, d]) => {
      const flat: any = {
        name: ticker,
        fullName: d.name,
        totalWeight: d.totalWeight,
        isCash: d.isCash,
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
      if (a === 'Direct') return -1;
      if (b === 'Direct') return 1;
      return a.localeCompare(b);
    });

    const rMap: Record<string, number> = {};
    data.forEach((d) => {
      rMap[d.name] = d.totalWeight;
    });

    return { chartData: data, sources: sourceList, riskMap: rMap };
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
            <h3 className="text-xl font-bold text-white tracking-tight">Portfolio Look-Through</h3>
            <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-neutral-400">Safe</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    <span className="text-neutral-400">Warning</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                    <span className="text-neutral-400">Critical</span>
                </div>
            </div>
        </div>
        <p className="text-sm text-neutral-500 font-light">
          Breakdown of individual underlying holdings stacked by source.
        </p>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar pr-2">
        <div style={{ height: chartHeight, minHeight: 400, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 100, bottom: 20 }}
              barSize={20} // Sleek bars
            >
              <defs>
                {/* Direct/Risk Gradients */}
                <linearGradient id="gradDirectSafe" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={RISK_COLORS.SAFE} stopOpacity={0.8}/>
                    <stop offset="100%" stopColor={RISK_COLORS.SAFE} stopOpacity={1}/>
                </linearGradient>
                <linearGradient id="gradDirectWarn" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={RISK_COLORS.WARN} stopOpacity={0.8}/>
                    <stop offset="100%" stopColor={RISK_COLORS.WARN} stopOpacity={1}/>
                </linearGradient>
                <linearGradient id="gradDirectHigh" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={RISK_COLORS.HIGH} stopOpacity={0.8}/>
                    <stop offset="100%" stopColor={RISK_COLORS.HIGH} stopOpacity={1}/>
                </linearGradient>
                <linearGradient id="gradDirectCrit" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={RISK_COLORS.CRIT} stopOpacity={0.8}/>
                    <stop offset="100%" stopColor={RISK_COLORS.CRIT} stopOpacity={1}/>
                </linearGradient>

                {/* Source Gradients */}
                {SOURCE_COLORS.map((color, idx) => (
                    <linearGradient key={`gradSource${idx}`} id={`gradSource${idx}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={color.main} stopOpacity={0.7} />
                        <stop offset="100%" stopColor={color.main} stopOpacity={1} />
                    </linearGradient>
                ))}
              </defs>

              <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#ffffff" strokeOpacity={0.05} />

              <XAxis
                type="number"
                domain={[0, 'dataMax']}
                stroke="#525252"
                tickFormatter={(val) => `${Number(val).toFixed(0)}%`}
                tick={{ fill: '#737373', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              >
              </XAxis>

              <YAxis
                type="category"
                dataKey="name"
                width={120}
                stroke="transparent"
                tick={<CustomYAxisTick riskMap={riskMap} />}
                interval={0}
              />

              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-stone-950/95 backdrop-blur-xl border border-white/10 p-4 rounded-xl text-xs shadow-2xl z-50 min-w-[220px]">
                        <div className="font-bold text-white mb-0.5 text-base tracking-tight">{d.name}</div>
                        <div className="text-neutral-500 mb-3 font-medium">{d.fullName}</div>

                        <div className="flex justify-between gap-6 border-t border-white/5 pt-3 mb-3">
                          <span className="text-neutral-400 font-medium">Total Weight</span>
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
                            <span className="leading-snug">Concentration exceeds recommended limit ({d.totalWeight > 20 ? '20%' : '10%'}).</span>
                          </div>
                        )}

                        <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                          <span className="text-[10px] uppercase tracking-wider text-neutral-600 font-bold mb-1">Source Breakdown</span>
                          {[...payload]
                            .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
                            .map((entry: any, idx: number) => (
                              <div key={idx} className="flex justify-between gap-4 items-center">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-1.5 h-1.5 rounded-full shadow-sm"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-neutral-300 font-medium">{entry.name}</span>
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
                wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', opacity: 0.8 }}
                iconType="circle"
                iconSize={8}
              />

              {/* Aesthetic Reference Lines */}
              <ReferenceLine x={5} stroke={RISK_COLORS.WARN} strokeDasharray="2 4" strokeOpacity={0.4} />
              <ReferenceLine x={10} stroke={RISK_COLORS.HIGH} strokeDasharray="2 4" strokeOpacity={0.5} />
              <ReferenceLine x={20} stroke={RISK_COLORS.CRIT} strokeDasharray="2 4" strokeOpacity={0.6} />

              {sources.map((source, index) => {
                const isLast = index === sources.length - 1;
                const radius: [number, number, number, number] = isLast ? [0, 4, 4, 0] : [0, 0, 0, 0];

                if (source === 'Direct') {
                  return (
                    <Bar
                      key={source}
                      dataKey={source}
                      stackId="a"
                      radius={radius}
                    >
                      {chartData.map((entry, i) => {
                          let fillId = "url(#gradDirectSafe)";
                          if (entry.totalWeight > 20) fillId = "url(#gradDirectCrit)";
                          else if (entry.totalWeight > 10) fillId = "url(#gradDirectHigh)";
                          else if (entry.totalWeight > 5) fillId = "url(#gradDirectWarn)";

                          return <Cell key={`cell-${i}`} fill={fillId} strokeWidth={0} />;
                      })}
                    </Bar>
                  );
                }

                // Assign a color from palette cyclically
                // Note: SOURCE_COLORS index must exclude 'Direct' logic if we want consistency,
                // but here 'sources' includes Direct.
                // We should map based on source name hash or index to keep it consistent?
                // The current index is fine as long as order is stable.
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
