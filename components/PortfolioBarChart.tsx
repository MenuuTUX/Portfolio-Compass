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

  // We need 'name' and 'assetType' to fetch the icon correctly.
  // However, YAxis tick only receives the value (ticker).
  // We can infer or pass a lookup map.
  // For simplicity, we'll try to guess or use the ticker.
  // Ideally, we pass the icon URL in the payload or lookup.
  // Since we can't easily pass rich objects to ticks in Recharts 2.x without custom logic,
  // we will try to resolve the icon here or use a simplified approach.

  // Actually, we can assume it's a Stock or ETF.
  // For 'Cash', we use a static icon or null.

  let iconUrl: string | null = null;
  if (ticker === 'Cash' || ticker === 'Other') {
      // No icon or specific icon
  } else {
      // We don't have the full name here easily unless we pass a lookup map.
      // But getAssetIconUrl supports fallback to ticker icon.
      iconUrl = getAssetIconUrl(ticker, ticker, 'STOCK');
      // Treating as STOCK ensures we look for Ticker Icon first, which is what we want for holdings.
      // (Most holdings are stocks).
  }

  return (
    <g transform={`translate(${x},${y})`}>
      {iconUrl && (
        <image
          x={-35}
          y={-10}
          href={iconUrl}
          width={20}
          height={20}
          preserveAspectRatio="xMidYMid slice"
          style={{ clipPath: 'circle(50%)' }} // Attempt circular clip via style, might not work in all SVGs
        />
      )}
      <text
        x={iconUrl ? -10 : -5}
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
    const aggregatedWeights: { [ticker: string]: { weight: number; name: string; isCash: boolean } } = {};
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
                } else {
                    aggregatedWeights[h.ticker] = {
                        weight: effectiveWeight,
                        name: h.name,
                        isCash: false
                    };
                }
                holdingsSumPercent += h.weight;
            });

            // Handle unmapped residue within ETF (often Cash or Other)
            // If holdings sum to < 100%, the rest is effectively 'Other' or 'Cash' inside the ETF
            // We'll treat it as 'Other' for now to distinguish from Portfolio Cash
            /*
               Actually, usually it's "Other". But let's check if we want to be that granular.
               For QQQ, holdings sum to ~100%.
               Let's ignore residue inside ETF for simplicity unless it's large,
               OR attribute it to "Other".
            */
            const residue = Math.max(0, 100 - holdingsSumPercent);
            if (residue > 1) {
                const effectiveResidue = (itemWeight * residue) / 100;
                 if (aggregatedWeights['Other']) {
                    aggregatedWeights['Other'].weight += effectiveResidue;
                } else {
                    aggregatedWeights['Other'] = { weight: effectiveResidue, name: 'Other Assets', isCash: false };
                }
            }

            totalMappedWeight += itemWeight;

        } else {
            // It's a Stock or an ETF without holdings data (treat as opaque asset)
            if (aggregatedWeights[item.ticker]) {
                aggregatedWeights[item.ticker].weight += itemWeight;
            } else {
                aggregatedWeights[item.ticker] = {
                    weight: itemWeight,
                    name: item.name,
                    isCash: false
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
        } else {
             aggregatedWeights['Cash'] = { weight: cashBuffer, name: 'Cash Buffer', isCash: true };
        }
    }

    // 3. Convert to Array
    let chartData = Object.entries(aggregatedWeights).map(([ticker, data]) => ({
        name: ticker, // Ticker is the key
        fullName: data.name,
        weight: data.weight,
        isCash: data.isCash,
        fill: data.isCash ? '#525252' : '#10b981'
    }));

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
                margin={{ top: 5, right: 30, left: 50, bottom: 20 }} // Increased left margin for icons
            >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
                <XAxis
                    type="number"
                    domain={[0, 'dataMax']}
                    stroke="#666"
                    tickFormatter={(val) => `${val}%`}
                >
                    <Label value="Effective Weight (%)" offset={0} position="insideBottom" fill="#666" fontSize={12} dy={10} />
                </XAxis>
                <YAxis
                    type="category"
                    dataKey="name"
                    width={50}
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
                        <div className="bg-stone-950/90 backdrop-blur-md border border-white/10 p-3 rounded-lg text-xs shadow-xl z-50 min-w-[150px]">
                        <div className="font-bold text-white mb-1 text-sm">{d.name}</div>
                        <div className="text-neutral-400 mb-2">{d.fullName}</div>
                        <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
                            <span className="text-neutral-400">Weight:</span>
                            <span className="text-emerald-400 font-mono font-bold">{d.weight.toFixed(2)}%</span>
                        </div>
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
