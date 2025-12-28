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
} from 'recharts';
import { motion } from 'framer-motion';
import { Portfolio } from '@/types';
import { getAssetIconUrl } from '@/lib/etf-providers';

interface PortfolioBarChartProps {
  portfolio: Portfolio;
}

// Custom Y-Axis Tick Component
const CustomYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const { value: ticker } = payload; // ticker symbol

  // Infer icon using STOCK logic for individual holdings
  let iconUrl: string | null = null;
  if (ticker === 'Cash' || ticker === 'Other') {
      // No icon
  } else {
      iconUrl = getAssetIconUrl(ticker, ticker, 'STOCK');
  }

  return (
    <g transform={`translate(${x},${y})`}>
      {iconUrl && (
        <image
          x={-80} // Shift icon far left
          y={-10}
          href={iconUrl}
          width={20}
          height={20}
          preserveAspectRatio="xMidYMid slice"
          style={{ clipPath: 'circle(50%)' }}
        />
      )}
      <text
        x={-10} // Text always right-aligned near the axis tick
        y={4}
        textAnchor="end"
        fill="#fff"
        fontSize={12}
        fontWeight="500"
      >
        {ticker}
      </text>
    </g>
  );
};

// Distinct colors for sources
const SOURCE_COLORS = [
    '#10b981', // Direct (Emerald-500)
    '#3b82f6', // Blue-500
    '#8b5cf6', // Violet-500
    '#f59e0b', // Amber-500
    '#ef4444', // Red-500
    '#ec4899', // Pink-500
    '#06b6d4', // Cyan-500
    '#84cc16', // Lime-500
    '#6366f1', // Indigo-500
    '#14b8a6', // Teal-500
    '#f97316', // Orange-500
    '#d946ef', // Fuchsia-500
];

export default function PortfolioBarChart({ portfolio }: PortfolioBarChartProps) {
  // 1. Identify Unique Sources (ETFs + Direct)
  // 2. Build Data Structure
  const { chartData, sources } = useMemo(() => {
    const aggregatedData: {
        [holdingTicker: string]: {
            totalWeight: number;
            name: string;
            isCash: boolean;
            sources: { [source: string]: number }; // source -> weight
        }
    } = {};

    const uniqueSources = new Set<string>();

    portfolio.forEach(item => {
        const itemWeight = item.weight; // Portfolio weight %
        const sourceName = item.ticker; // The ETF or Stock ticker acting as source

        // Check if ETF has holdings data
        if (item.holdings && item.holdings.length > 0) {
            uniqueSources.add(sourceName);

            // Distribute weight among holdings
            let holdingsSumPercent = 0;

            item.holdings.forEach(h => {
                const effectiveWeight = (itemWeight * h.weight) / 100;

                if (!aggregatedData[h.ticker]) {
                    aggregatedData[h.ticker] = {
                        totalWeight: 0,
                        name: h.name,
                        isCash: false,
                        sources: {}
                    };
                }

                aggregatedData[h.ticker].totalWeight += effectiveWeight;
                aggregatedData[h.ticker].sources[sourceName] = (aggregatedData[h.ticker].sources[sourceName] || 0) + effectiveWeight;

                holdingsSumPercent += h.weight;
            });

            // Handle residue (Other/Cash inside ETF)
            const residue = Math.max(0, 100 - holdingsSumPercent);
            if (residue > 1) {
                const effectiveResidue = (itemWeight * residue) / 100;
                const otherKey = 'Other';

                if (!aggregatedData[otherKey]) {
                     aggregatedData[otherKey] = { totalWeight: 0, name: 'Other Assets', isCash: false, sources: {} };
                }
                aggregatedData[otherKey].totalWeight += effectiveResidue;
                aggregatedData[otherKey].sources[sourceName] = (aggregatedData[otherKey].sources[sourceName] || 0) + effectiveResidue;
            }

        } else {
            // It's a Stock or an ETF without holdings data (treat as Direct/Opaque)
            // We label the source as 'Direct' if it's a Stock, or the ETF name if it's an ETF?
            // User example: "10% of nvidia stock... But I also have QQQ".
            // If I hold NVDA directly, source is "Direct".
            // If I hold QQQ directly (and it has no holdings data?), it contributes to "QQQ".

            // Wait, if it has no holdings data, it is the holding itself.
            // If I hold NVDA directly, item.ticker is NVDA.
            // So holdingTicker is NVDA. Source is "Direct"?

            const isStock = item.assetType === 'STOCK'; // We assume assetType exists or infer
            // Actually item doesn't have assetType on PortfolioItem always, but we can infer.
            // If it has no holdings, we treat it as the asset itself.

            const holdingKey = item.ticker;
            const sourceKey = 'Direct'; // Or 'Portfolio'
            uniqueSources.add(sourceKey);

            if (!aggregatedData[holdingKey]) {
                aggregatedData[holdingKey] = {
                    totalWeight: 0,
                    name: item.name,
                    isCash: false, // Unless it's Cash
                    sources: {}
                };
            }

            aggregatedData[holdingKey].totalWeight += itemWeight;
            aggregatedData[holdingKey].sources[sourceKey] = (aggregatedData[holdingKey].sources[sourceKey] || 0) + itemWeight;
        }
    });

    // 2. Portfolio Cash Buffer
    const totalPortfolioAllocated = portfolio.reduce((sum, item) => sum + item.weight, 0);
    const cashBuffer = Math.max(0, 100 - totalPortfolioAllocated);

    if (cashBuffer > 0.01) {
        uniqueSources.add('Direct'); // Cash is direct
        if (!aggregatedData['Cash']) {
             aggregatedData['Cash'] = { totalWeight: 0, name: 'Cash Buffer', isCash: true, sources: {} };
        }
        aggregatedData['Cash'].totalWeight += cashBuffer;
        aggregatedData['Cash'].sources['Direct'] = (aggregatedData['Cash'].sources['Direct'] || 0) + cashBuffer;
    }

    // 3. Convert to Array and Sort
    let data = Object.entries(aggregatedData).map(([ticker, d]) => {
        // Flatten sources into the object for Recharts
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

    // Limit items
    const MAX_ITEMS = 25;
    if (data.length > MAX_ITEMS) {
        data = data.slice(0, MAX_ITEMS);
        // Note: collapsing "Other" in a stacked chart is hard because we lose source breakdown.
        // We'll just truncate for now.
    }

    // Prepare Source List for Legend/Stacking
    // Prioritize 'Direct' first
    const sourceList = Array.from(uniqueSources).sort((a, b) => {
        if (a === 'Direct') return -1;
        if (b === 'Direct') return 1;
        return a.localeCompare(b);
    });

    return { chartData: data, sources: sourceList };

  }, [portfolio]);

  if (portfolio.length === 0) {
    return (
        <div className="w-full h-full min-h-[400px] flex items-center justify-center text-neutral-500 glass-panel rounded-xl">
            No assets in portfolio
        </div>
    );
  }

  // Assign colors
  const colorMap: Record<string, string> = {};
  sources.forEach((src, idx) => {
      colorMap[src] = SOURCE_COLORS[idx % SOURCE_COLORS.length];
  });

  const chartHeight = Math.max(400, chartData.length * 40);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full glass-panel p-6 rounded-xl flex flex-col"
    >
      <div className="flex flex-col gap-1 mb-6">
          <h3 className="text-lg font-bold text-white">Portfolio Look-Through Allocation</h3>
          <p className="text-xs text-neutral-400">Breakdown of individual underlying holdings stacked by source.</p>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
          <div style={{ height: chartHeight, minHeight: 400, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 20 }}
            >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
                <XAxis
                    type="number"
                    domain={[0, 'dataMax']}
                    stroke="#666"
                    tickFormatter={(val) => `${Number(val).toFixed(0)}%`}
                >
                    <Label value="Effective Weight (%)" offset={0} position="insideBottom" fill="#666" fontSize={12} dy={10} />
                </XAxis>
                <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    stroke="#fff"
                    tick={<CustomYAxisTick />}
                    interval={0}
                />
                <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                            <div className="bg-stone-950/90 backdrop-blur-md border border-white/10 p-3 rounded-lg text-xs shadow-xl z-50 min-w-[200px]">
                                <div className="font-bold text-white mb-1 text-sm">{d.name}</div>
                                <div className="text-neutral-400 mb-2">{d.fullName}</div>

                                <div className="flex justify-between gap-4 border-t border-white/10 pt-2 mb-2">
                                    <span className="text-neutral-300">Total Weight:</span>
                                    <span className="text-emerald-400 font-mono font-bold">{d.totalWeight.toFixed(2)}%</span>
                                </div>

                                <div className="flex flex-col gap-1 border-t border-white/10 pt-2">
                                    <span className="text-xs text-neutral-500 font-semibold mb-1">BREAKDOWN</span>
                                    {/* Sort payload by value desc */}
                                    {[...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0)).map((entry: any, idx: number) => (
                                        <div key={idx} className="flex justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                <span className="text-neutral-400">{entry.name}</span>
                                            </div>
                                            <span className="text-neutral-200 font-mono">{Number(entry.value).toFixed(2)}%</span>
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
                    wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }}
                    iconType="circle"
                    formatter={(value) => <span className="text-neutral-400 ml-1">{value}</span>}
                />
                {sources.map((source) => (
                    <Bar
                        key={source}
                        dataKey={source}
                        stackId="a" // Enables stacking
                        fill={colorMap[source]}
                        radius={[0, 4, 4, 0]} // Only last item gets radius? Recharts handles this usually
                        // But for stacked, radius applies to the chunk. We might want radius only on the last chunk.
                        // Recharts <Bar> radius applies to the bar segment.
                        // We can leave it 0 or small.
                    />
                ))}
            </BarChart>
            </ResponsiveContainer>
          </div>
      </div>
    </motion.div>
  );
}
