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

export default function PortfolioBarChart({ portfolio }: PortfolioBarChartProps) {
  const data = useMemo(() => {
    // Structure to track weight and contributors
    const aggregatedWeights: {
        [ticker: string]: {
            weight: number;
            name: string;
            isCash: boolean;
            contributors: { etf: string; weight: number }[]
        }
    } = {};

    let totalMappedWeight = 0;

    // 1. Unwrap Holdings
    portfolio.forEach(item => {
        const itemWeight = item.weight; // Portfolio weight %

        // Check if ETF has holdings data
        if (item.holdings && item.holdings.length > 0) {
            // Distribute weight among holdings
            let holdingsSumPercent = 0;

            item.holdings.forEach(h => {
                // Effective Weight = (Portfolio Weight) * (Holding Weight %) / 100
                const effectiveWeight = (itemWeight * h.weight) / 100;

                if (aggregatedWeights[h.ticker]) {
                    aggregatedWeights[h.ticker].weight += effectiveWeight;
                    aggregatedWeights[h.ticker].contributors.push({ etf: item.ticker, weight: effectiveWeight });
                } else {
                    aggregatedWeights[h.ticker] = {
                        weight: effectiveWeight,
                        name: h.name,
                        isCash: false,
                        contributors: [{ etf: item.ticker, weight: effectiveWeight }]
                    };
                }
                holdingsSumPercent += h.weight;
            });

            // Handle unmapped residue within ETF (often Cash or Other)
            const residue = Math.max(0, 100 - holdingsSumPercent);
            if (residue > 1) {
                const effectiveResidue = (itemWeight * residue) / 100;
                 if (aggregatedWeights['Other']) {
                    aggregatedWeights['Other'].weight += effectiveResidue;
                    // We don't track contributors for generic 'Other' as closely, but we could
                    aggregatedWeights['Other'].contributors.push({ etf: item.ticker, weight: effectiveResidue });
                } else {
                    aggregatedWeights['Other'] = {
                        weight: effectiveResidue,
                        name: 'Other Assets',
                        isCash: false,
                        contributors: [{ etf: item.ticker, weight: effectiveResidue }]
                    };
                }
            }

            totalMappedWeight += itemWeight;

        } else {
            // It's a Stock or an ETF without holdings data (treat as opaque asset)
            if (aggregatedWeights[item.ticker]) {
                aggregatedWeights[item.ticker].weight += itemWeight;
                aggregatedWeights[item.ticker].contributors.push({ etf: '(Direct)', weight: itemWeight });
            } else {
                aggregatedWeights[item.ticker] = {
                    weight: itemWeight,
                    name: item.name,
                    isCash: false,
                    contributors: [{ etf: '(Direct)', weight: itemWeight }]
                };
            }
            totalMappedWeight += itemWeight;
        }
    });

    // 2. Calculate Portfolio Cash Buffer
    // This is the unallocated portion of the top-level portfolio
    const totalPortfolioAllocated = portfolio.reduce((sum, item) => sum + item.weight, 0);
    const cashBuffer = Math.max(0, 100 - totalPortfolioAllocated);

    if (cashBuffer > 0.01) {
        if (aggregatedWeights['Cash']) {
             aggregatedWeights['Cash'].weight += cashBuffer;
             aggregatedWeights['Cash'].contributors.push({ etf: 'Portfolio Cash', weight: cashBuffer });
        } else {
             aggregatedWeights['Cash'] = {
                 weight: cashBuffer,
                 name: 'Cash Buffer',
                 isCash: true,
                 contributors: [{ etf: 'Portfolio Cash', weight: cashBuffer }]
             };
        }
    }

    // 3. Convert to Array and Sort Contributors
    let chartData = Object.entries(aggregatedWeights).map(([ticker, data]) => {
        // Sort contributors by weight desc
        data.contributors.sort((a, b) => b.weight - a.weight);

        return {
            name: ticker, // Ticker is the key
            fullName: data.name,
            weight: data.weight,
            isCash: data.isCash,
            contributors: data.contributors,
            fill: data.isCash ? '#525252' : '#10b981'
        };
    });

    // 4. Sort and Top N
    chartData.sort((a, b) => b.weight - a.weight);

    // If too many items, slice and group
    const MAX_ITEMS = 25;
    if (chartData.length > MAX_ITEMS) {
        const top = chartData.slice(0, MAX_ITEMS);
        const others = chartData.slice(MAX_ITEMS);
        const othersWeight = others.reduce((sum, item) => sum + item.weight, 0);

        if (othersWeight > 0.01) {
            top.push({
                name: 'Other',
                fullName: 'Other Holdings',
                weight: othersWeight,
                isCash: false,
                contributors: [], // Too complex to list all
                fill: '#737373'
            });
        }
        return top;
    }

    return chartData;
  }, [portfolio]);

  if (portfolio.length === 0) {
    return (
        <div className="w-full h-full min-h-[400px] flex items-center justify-center text-neutral-500 glass-panel rounded-xl">
            No assets in portfolio
        </div>
    );
  }

  // Calculate dynamic height based on item count to ensure bars are readable
  const chartHeight = Math.max(400, data.length * 40);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full glass-panel p-6 rounded-xl flex flex-col"
    >
      <div className="flex flex-col gap-1 mb-6">
          <h3 className="text-lg font-bold text-white">Portfolio Look-Through Allocation</h3>
          <p className="text-xs text-neutral-400">Breakdown of individual underlying holdings across all ETFs.</p>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
          {/* We use a fixed width container inside overflow for the chart */}
          <div style={{ height: chartHeight, minHeight: 400, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 20 }} // Increased left margin for icons
            >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
                <XAxis
                    type="number"
                    domain={[0, 'dataMax']}
                    stroke="#666"
                    tickFormatter={(val) => `${Number(val).toFixed(0)}%`} // Fixed decimal issue
                >
                    <Label value="Effective Weight (%)" offset={0} position="insideBottom" fill="#666" fontSize={12} dy={10} />
                </XAxis>
                <YAxis
                    type="category"
                    dataKey="name"
                    width={100} // Increased width for YAxis to prevent overlap
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
                                <span className="text-emerald-400 font-mono font-bold">{d.weight.toFixed(2)}%</span>
                            </div>

                            {d.contributors && d.contributors.length > 0 && (
                                <div className="flex flex-col gap-1 border-t border-white/10 pt-2">
                                    <span className="text-xs text-neutral-500 font-semibold mb-1">CONTRIBUTION SOURCE</span>
                                    {d.contributors.slice(0, 5).map((c: any, idx: number) => (
                                        <div key={idx} className="flex justify-between gap-4">
                                            <span className="text-neutral-400">{c.etf}</span>
                                            <span className="text-neutral-200 font-mono">{c.weight.toFixed(2)}%</span>
                                        </div>
                                    ))}
                                    {d.contributors.length > 5 && (
                                        <div className="text-xs text-neutral-600 italic mt-1">
                                            + {d.contributors.length - 5} more...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                    }
                    return null;
                }}
                />
                <Bar
                    dataKey="weight"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                    isAnimationActive={false}
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                </Bar>
            </BarChart>
            </ResponsiveContainer>
          </div>
      </div>
    </motion.div>
  );
}
