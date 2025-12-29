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

    // 1. Calculate Top Holdings
    const topHoldings = [...portfolio].sort((a, b) => b.weight - a.weight).slice(0, 8);

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
        // Check if allocation values are 0-100 or 0-1
        // Usually Yahoo Finance / Scrapers return 0-1 decimals, but some might be %.
        // We'll normalize to 0-1 here.
        let e = item.allocation?.equities || 0;
        let b = item.allocation?.bonds || 0;
        let c = item.allocation?.cash || 0;

        // Heuristic: if any value > 1, assume percentage and divide by 100
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

    // 4. Sector Allocation
    const sectorMap: Record<string, number> = {};
    portfolio.forEach(item => {
        if (item.sectors) {
            Object.entries(item.sectors).forEach(([sector, val]) => {
                const normalizedSector = sector.replace(/_/g, ' ').toLowerCase();
                const title = normalizedSector.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                sectorMap[title] = (sectorMap[title] || 0) + (val * (item.weight / totalWeight));
            });
        }
    });

    const topSectors = Object.entries(sectorMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, val]) => ({ name, value: val * 100 }));

    // Chart Logic
    const width = 800;
    const height = 320;
    const padding = 20;

    const values = chartData.map(d => d.value);
    const divValues = chartData.map(d => d.dividendValue || 0);

    // Determine bounds considering Monte Carlo ranges if available
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

            // Create a closed shape: Move to first upper, Line to last upper, Line to last lower, Line to first lower, Close
            rangeAreaD = `M ${upperPoints[0].split(',')[0]},${upperPoints[0].split(',')[1]} ` +
                         `L ${upperPoints.join(' L ')} ` +
                         `L ${lowerPoints.reverse().join(' L ')} Z`;
        }
    }

    return (
      <div
        ref={ref}
        className="w-[1080px] h-[1350px] bg-[#0a0a0a] text-white p-12 flex flex-col relative overflow-hidden font-sans"
        style={{ fontFamily: 'var(--font-inter), sans-serif' }}
      >
        {/* Subtle Professional Backgrounds - Toned down */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-900/10 blur-[180px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-indigo-900/10 blur-[180px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.02] pointer-events-none" />

        {/* HEADER */}
        <div className="flex justify-between items-start mb-10 relative z-10 border-b border-white/10 pb-6">
          <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-2xl shadow-emerald-900/20 ring-1 ring-white/10">
                    <Share2 className="w-8 h-8 text-white" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-1">Portfolio Compass</h1>
                    <div className="flex items-center gap-2">
                         <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Institutional Grade</span>
                         <span className="text-neutral-500 text-xs font-medium uppercase tracking-wide">Analysis Report</span>
                    </div>
                </div>
          </div>
          <div className="text-right">
             <div className="inline-block px-3 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-neutral-400 mb-3">
                {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
             </div>
             <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">{portfolioName || "Investment Portfolio"}</h2>
             <p className="text-neutral-400 text-lg font-medium">Prepared for <span className="text-white">{userName || "Investor"}</span></p>
          </div>
        </div>

        {/* METRICS GRID - More Professional Card Style */}
        <div className="grid grid-cols-4 gap-6 mb-8 relative z-10">
            <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp className="w-12 h-12" />
                </div>
                <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">Projected Value</div>
                <div className="text-3xl font-bold text-white tracking-tight">{formatCurrency(metrics.projectedValue)}</div>
                <div className="text-xs text-neutral-400 mt-2 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {metrics.years} Year Horizon
                </div>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Activity className="w-12 h-12" />
                </div>
                 <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">Total Return</div>
                 <div className="text-3xl font-bold text-emerald-400 tracking-tight">+{metrics.percentageGrowth.toFixed(0)}%</div>
                 <div className="text-xs text-neutral-400 mt-2 font-medium">{metrics.growthType} Model</div>
            </div>

             <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <DollarSign className="w-12 h-12" />
                </div>
                <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">Accumulated Yield</div>
                <div className="text-3xl font-bold text-blue-400 tracking-tight">{formatCurrency(metrics.dividends)}</div>
                 <div className="text-xs text-neutral-400 mt-2 font-medium">Reinvested Dividends</div>
            </div>

             <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <PieChart className="w-12 h-12" />
                </div>
                <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">CAGR</div>
                <div className="text-3xl font-bold text-white tracking-tight">{(metrics.annualReturn * 100).toFixed(2)}%</div>
                <div className="text-xs text-neutral-400 mt-2 font-medium">Compound Annual Growth</div>
            </div>
        </div>

        {/* RISK & ALLOCATION BAR */}
        <div className="grid grid-cols-12 gap-6 mb-8 relative z-10 h-[140px]">
            {/* Asset Allocation */}
            <div className="col-span-5 bg-[#111] border border-white/10 rounded-xl p-6 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Asset Allocation</span>
                </div>
                <div className="flex h-4 w-full rounded-md overflow-hidden bg-neutral-900 mb-3 border border-white/5">
                    <div style={{ width: `${assetAllocation.equities * 100}%` }} className="bg-emerald-600" />
                    <div style={{ width: `${assetAllocation.bonds * 100}%` }} className="bg-blue-600" />
                    <div style={{ width: `${assetAllocation.cash * 100}%` }} className="bg-neutral-600" />
                </div>
                <div className="flex justify-between text-xs text-neutral-400 font-medium px-1">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-emerald-600"/> Equities {(assetAllocation.equities*100).toFixed(0)}%</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-blue-600"/> Fixed Income {(assetAllocation.bonds*100).toFixed(0)}%</span>
                </div>
            </div>

            {/* Risk & Cost */}
            <div className="col-span-3 bg-[#111] border border-white/10 rounded-xl p-6 flex flex-col justify-center">
                 <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Risk Profile</span>
                </div>
                 <div className="flex justify-between items-end mb-2">
                    <span className="text-neutral-400 text-xs font-medium">Beta</span>
                    <span className="text-xl font-bold text-white">{weightedBeta.toFixed(2)}</span>
                </div>
                <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-rose-500" style={{ width: `${Math.min(weightedBeta * 50, 100)}%` }} />
                </div>
                 <div className="flex justify-between items-end">
                    <span className="text-neutral-400 text-xs font-medium">MER</span>
                    <span className="text-xl font-bold text-white">{weightedMER.toFixed(2)}%</span>
                </div>
            </div>

            {/* Top Exposure */}
            <div className="col-span-4 bg-[#111] border border-white/10 rounded-xl p-6 flex flex-col justify-center">
                 <div className="flex items-center gap-2 mb-4">
                    <PieChart className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Sector Exposure</span>
                </div>
                <div className="space-y-2.5">
                    {topSectors.length > 0 ? topSectors.map(s => (
                        <div key={s.name} className="flex justify-between items-center text-xs">
                            <span className="text-neutral-300 truncate max-w-[140px] font-medium">{s.name}</span>
                            <span className="text-white font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{s.value.toFixed(0)}%</span>
                        </div>
                    )) : (
                        <div className="text-xs text-neutral-500 italic">Sector data unavailable</div>
                    )}
                </div>
            </div>
        </div>

        {/* CHART SECTION */}
        <div className="flex-1 mb-8 relative z-10 bg-[#111] border border-white/10 rounded-2xl p-8 shadow-xl flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Wealth Trajectory
                </h3>
                <div className="flex gap-6 text-xs font-medium">
                    {hasRange && (
                        <div className="flex items-center gap-2 text-emerald-600/60">
                            <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50"></div>
                            Uncertainty Range
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-emerald-400">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        {hasRange ? "Median Outcome" : "Portfolio Value"}
                    </div>
                    <div className="flex items-center gap-2 text-blue-400">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        Dividends
                    </div>
                </div>
            </div>

            <div className="relative flex-1 w-full border-l border-b border-white/10 pl-2 pb-2 min-h-0">
                 <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
                    <defs>
                        <linearGradient id="chartGradientMain" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                         <linearGradient id="chartGradientDiv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Grid Lines (Subtle) */}
                    <line x1={padding} y1={height * 0.25} x2={width-padding} y2={height * 0.25} stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1={padding} y1={height * 0.5} x2={width-padding} y2={height * 0.5} stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1={padding} y1={height * 0.75} x2={width-padding} y2={height * 0.75} stroke="#222" strokeWidth="1" strokeDasharray="4 4" />

                    {/* Monte Carlo Range (The Vague "Cone") */}
                    {hasRange && rangeAreaD && (
                        <path d={rangeAreaD} fill="#10b981" fillOpacity="0.1" stroke="none" />
                    )}

                    {/* Dividend Layer */}
                    {divPathD && <path d={divAreaD} fill="url(#chartGradientDiv)" stroke="none" />}
                    {divPathD && <path d={divPathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" />}

                    {/* Main Value Layer */}
                    {pathD && !hasRange && <path d={areaD} fill="url(#chartGradientMain)" stroke="none" />}
                    {pathD && <path d={pathD} fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
                 </svg>
            </div>
        </div>

        {/* HOLDINGS SECTION */}
        <div className="relative z-10 flex-shrink-0">
            <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    Top Holdings
                </h3>
                <span className="text-xs text-neutral-500 uppercase tracking-widest font-bold">{portfolio.length} Total Assets</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {topHoldings.map((item, i) => {
                    const iconUrl = getAssetIconUrl(item.ticker, item.name, item.assetType);
                    return (
                        <div key={item.ticker} className="flex items-center gap-4 bg-[#111] border border-white/10 p-4 rounded-xl shadow-sm">
                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center p-1 overflow-hidden shrink-0 border border-white/5">
                                {iconUrl ? (
                                    <img src={iconUrl} alt={item.ticker} className="w-full h-full object-contain opacity-90" crossOrigin="anonymous" />
                                ) : (
                                    <span className="text-[10px] font-bold text-neutral-300">{item.ticker.slice(0, 3)}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-white text-base truncate">{item.ticker}</span>
                                    <span className="font-mono text-emerald-400 text-sm font-medium">{item.weight.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(item.weight, 100)}%` }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* FOOTER */}
        <div className="mt-auto pt-8 flex justify-between items-center relative z-10 border-t border-white/10">
             <div className="flex items-center gap-3">
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                 <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider">Generated by Portfolio Compass</span>
             </div>
             <span className="text-xs text-neutral-500 font-mono">portfolio-compass.vercel.app</span>
        </div>
      </div>
    );
  }
);

PortfolioShareCard.displayName = "PortfolioShareCard";
