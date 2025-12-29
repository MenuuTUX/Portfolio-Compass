import React from 'react';
import { Portfolio } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Share2, TrendingUp, Shield, PieChart, Activity, DollarSign, Layers } from 'lucide-react';
import { getAssetIconUrl } from '@/lib/etf-providers';

export interface ShareCardProps {
  userName?: string;
  portfolioName?: string;
  portfolio: Portfolio;
  metrics: {
    totalValue: number;
    annualReturn: number;
    yield: number;
    projectedValue: number;
    totalInvested: number;
    dividends: number;
    years: number;
    scenario: string;
    growthType: 'Simple' | 'Monte Carlo';
    percentageGrowth: number;
  };
  chartData: {
    value: number;
    dividendValue?: number;
    min?: number; // For Monte Carlo Worst Case
    max?: number; // For Monte Carlo Best Case
  }[];
}

export const PortfolioShareCard = React.forwardRef<HTMLDivElement, ShareCardProps>(
  ({ userName, portfolioName, portfolio, metrics, chartData }, ref) => {

    // 1. Calculate Top Holdings (Increased to 10 for focus)
    const topHoldings = [...portfolio].sort((a, b) => b.weight - a.weight).slice(0, 10);

    // 2. Calculate Portfolio Stats (Weighted)
    const totalWeight = portfolio.reduce((sum, item) => sum + item.weight, 0) || 1;

    const weightedMER = portfolio.reduce((acc, item) => {
        return acc + ((item.metrics?.mer || 0) * (item.weight / totalWeight));
    }, 0);

    const weightedBeta = portfolio.reduce((acc, item) => {
        return acc + ((item.beta || 1.0) * (item.weight / totalWeight));
    }, 0);

    // 3. Asset Allocation
    const assetAllocation = portfolio.reduce((acc, item) => {
        const w = item.weight / totalWeight;
        let e = item.allocation?.equities || 0;
        let b = item.allocation?.bonds || 0;
        let c = item.allocation?.cash || 0;

        if (e > 1 || b > 1 || c > 1) {
             e /= 100;
             b /= 100;
             c /= 100;
        }

        acc.equities += e * w;
        acc.bonds += b * w;
        acc.cash += c * w;
        return acc;
    }, { equities: 0, bonds: 0, cash: 0 });

    // Chart Logic
    const width = 600; // Adjusted for Left Column width
    const height = 300;
    const padding = 10;

    const values = chartData.map(d => d.value);
    const divValues = chartData.map(d => d.dividendValue || 0);

    const hasRange = chartData.some(d => d.min !== undefined && d.max !== undefined);
    const allMax = hasRange
        ? chartData.map(d => d.max || d.value)
        : values;

    const minVal = 0;
    const maxVal = allMax.length > 0 ? Math.max(...allMax) : 100;
    const range = maxVal - minVal || 1;

    let pathD = "", areaD = "";
    let divPathD = "", divAreaD = "";
    let rangeAreaD = "";

    if (values.length > 1) {
        // Main Trend (Median or Simple)
        const points = values.map((val, i) => {
            const x = (i / (values.length - 1)) * (width - padding * 2) + padding;
            const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
            return `${x},${y}`;
        });
        pathD = `M ${points[0]} L ${points.join(' L ')}`;
        areaD = `${pathD} L ${width-padding},${height} L ${padding},${height} Z`;

        // Dividends
        const divPoints = divValues.map((val, i) => {
            const x = (i / (values.length - 1)) * (width - padding * 2) + padding;
            const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
            return `${x},${y}`;
        });
        divPathD = `M ${divPoints[0]} L ${divPoints.join(' L ')}`;
        divAreaD = `${divPathD} L ${width-padding},${height} L ${padding},${height} Z`;

        // Range (Cone) for Monte Carlo
        if (hasRange) {
            const upperPoints = chartData.map((d, i) => {
                const val = d.max || d.value;
                const x = (i / (chartData.length - 1)) * (width - padding * 2) + padding;
                const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
                return `${x},${y}`;
            });
            const lowerPoints = chartData.map((d, i) => {
                const val = d.min || d.value;
                const x = (i / (chartData.length - 1)) * (width - padding * 2) + padding;
                const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
                return `${x},${y}`;
            });

            rangeAreaD = `M ${upperPoints[0].split(',')[0]},${upperPoints[0].split(',')[1]} ` +
                         `L ${upperPoints.join(' L ')} ` +
                         `L ${lowerPoints.reverse().join(' L ')} Z`;
        }
    }

    return (
      <div
        ref={ref}
        className="w-[1080px] h-[1080px] bg-[#0a0a0a] text-white p-10 flex flex-col relative overflow-hidden font-sans"
        style={{ fontFamily: 'var(--font-inter), sans-serif' }}
      >
        {/* Backgrounds */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-900/10 blur-[180px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-indigo-900/10 blur-[180px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.02] pointer-events-none" />

        {/* HEADER */}
        <div className="flex justify-between items-start mb-8 relative z-10 border-b border-white/10 pb-6 shrink-0">
          <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-2xl shadow-emerald-900/20 ring-1 ring-white/10">
                    <Share2 className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Portfolio Compass</h1>
                    <div className="flex items-center gap-2">
                         <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Institutional Grade</span>
                         <span className="text-neutral-500 text-xs font-medium uppercase tracking-wide">Analysis Report</span>
                    </div>
                </div>
          </div>
          <div className="text-right">
             <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">{portfolioName || "Investment Portfolio"}</h2>
             <p className="text-neutral-400 text-sm font-medium">Prepared for <span className="text-white">{userName || "Investor"}</span></p>
          </div>
        </div>

        {/* MAIN CONTENT GRID (2 Columns) */}
        <div className="grid grid-cols-12 gap-8 flex-1 min-h-0 relative z-10">

            {/* LEFT COLUMN: Chart & Metrics (Cols 7/12) */}
            <div className="col-span-7 flex flex-col gap-6 h-full">

                {/* CHART */}
                <div className="bg-[#111] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col relative overflow-hidden flex-shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            Wealth Trajectory
                        </h3>
                        <div className="flex gap-4 text-[10px] font-medium">
                            {hasRange && (
                                <div className="flex items-center gap-1.5 text-emerald-600/60">
                                    <div className="w-2 h-2 rounded bg-emerald-500/20 border border-emerald-500/50"></div>
                                    Range
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 text-emerald-400">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                {hasRange ? "Median" : "Value"}
                            </div>
                        </div>
                    </div>
                    <div className="relative w-full h-[240px] border-l border-b border-white/10 pl-2 pb-2">
                        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
                            <defs>
                                <linearGradient id="chartGradientMain" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {/* Monte Carlo Range */}
                            {hasRange && rangeAreaD && (
                                <path d={rangeAreaD} fill="#10b981" fillOpacity="0.1" stroke="none" />
                            )}
                            {/* Main Line */}
                            {pathD && !hasRange && <path d={areaD} fill="url(#chartGradientMain)" stroke="none" />}
                            {pathD && <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                        </svg>
                    </div>
                </div>

                {/* KEY METRICS GRID */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-white/10 rounded-xl p-5 shadow-lg">
                        <div className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-1">Projected Value</div>
                        <div className="text-2xl font-bold text-white tracking-tight">{formatCurrency(metrics.projectedValue)}</div>
                        <div className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                            {metrics.years} Year Horizon
                        </div>
                    </div>
                    <div className="bg-[#111] border border-white/10 rounded-xl p-5 shadow-lg">
                        <div className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Return</div>
                        <div className="text-2xl font-bold text-emerald-400 tracking-tight">+{metrics.percentageGrowth.toFixed(0)}%</div>
                        <div className="text-[10px] text-neutral-400 mt-1">{metrics.growthType} Model</div>
                    </div>
                    <div className="bg-[#111] border border-white/10 rounded-xl p-5 shadow-lg">
                        <div className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-1">CAGR</div>
                        <div className="text-2xl font-bold text-white tracking-tight">{(metrics.annualReturn * 100).toFixed(2)}%</div>
                    </div>
                    <div className="bg-[#111] border border-white/10 rounded-xl p-5 shadow-lg">
                        <div className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-1">Yield</div>
                        <div className="text-2xl font-bold text-blue-400 tracking-tight">{formatCurrency(metrics.dividends)}</div>
                    </div>
                </div>

                {/* ASSET ALLOCATION (Compact) */}
                <div className="bg-[#111] border border-white/10 rounded-xl p-5 flex flex-col justify-center mt-auto">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Layers className="w-3 h-3 text-neutral-400" />
                            <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider">Allocation</span>
                        </div>
                        <div className="flex gap-3 text-[10px] font-medium text-neutral-400">
                             <span>Eq: {(assetAllocation.equities*100).toFixed(0)}%</span>
                             <span>Fix: {(assetAllocation.bonds*100).toFixed(0)}%</span>
                        </div>
                    </div>
                    <div className="flex h-2 w-full rounded-full overflow-hidden bg-neutral-900">
                        <div style={{ width: `${assetAllocation.equities * 100}%` }} className="bg-emerald-600" />
                        <div style={{ width: `${assetAllocation.bonds * 100}%` }} className="bg-blue-600" />
                        <div style={{ width: `${assetAllocation.cash * 100}%` }} className="bg-neutral-600" />
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: Holdings Focus (Cols 5/12) */}
            <div className="col-span-5 h-full flex flex-col">
                <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-500" />
                        Top Holdings
                    </h3>
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{portfolio.length} ASSETS</span>
                </div>

                <div className="flex-1 bg-[#111] border border-white/10 rounded-2xl p-2 overflow-hidden flex flex-col gap-2">
                    {topHoldings.map((item, i) => {
                        const iconUrl = getAssetIconUrl(item.ticker, item.name, item.assetType);
                        return (
                            <div key={item.ticker} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                                <div className="w-9 h-9 rounded-lg bg-black/40 flex items-center justify-center p-1 overflow-hidden shrink-0 border border-white/5">
                                    {iconUrl ? (
                                        <img src={iconUrl} alt={item.ticker} className="w-full h-full object-contain opacity-90" crossOrigin="anonymous" />
                                    ) : (
                                        <span className="text-[9px] font-bold text-neutral-400">{item.ticker.slice(0, 3)}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-white text-sm truncate">{item.ticker}</span>
                                        <span className="font-mono text-emerald-400 text-sm font-medium">{item.weight.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(item.weight, 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {portfolio.length > 10 && (
                        <div className="text-center text-[10px] text-neutral-500 mt-auto py-2 italic">
                            + {portfolio.length - 10} other assets
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* FOOTER */}
        <div className="mt-auto pt-6 flex justify-between items-center relative z-10 border-t border-white/10 shrink-0">
             <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                 <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Generated by Portfolio Compass</span>
             </div>
             <span className="text-[10px] text-neutral-500 font-mono">portfolio-compass.vercel.app</span>
        </div>
      </div>
    );
  }
);

PortfolioShareCard.displayName = "PortfolioShareCard";
