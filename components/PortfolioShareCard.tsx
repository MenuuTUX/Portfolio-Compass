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
  chartData: { value: number; dividendValue?: number }[];
}

export const PortfolioShareCard = React.forwardRef<HTMLDivElement, ShareCardProps>(
  ({ userName, portfolioName, portfolio, metrics, chartData }, ref) => {

    // 1. Calculate Top Holdings
    const topHoldings = [...portfolio].sort((a, b) => b.weight - a.weight).slice(0, 8); // Reduced to 8 to fit more stats
    const otherCount = Math.max(0, portfolio.length - 8);

    // 2. Calculate Portfolio Stats (Weighted)
    const totalWeight = portfolio.reduce((sum, item) => sum + item.weight, 0) || 1;

    const weightedMER = portfolio.reduce((acc, item) => {
        return acc + ((item.metrics?.mer || 0) * (item.weight / totalWeight));
    }, 0);

    const weightedBeta = portfolio.reduce((acc, item) => {
        return acc + ((item.beta || 1.0) * (item.weight / totalWeight));
    }, 0);

    // 3. Asset Allocation (Equities/Bonds/Other)
    const assetAllocation = portfolio.reduce((acc, item) => {
        const w = item.weight / totalWeight;
        acc.equities += (item.allocation?.equities || 0) * w;
        acc.bonds += (item.allocation?.bonds || 0) * w;
        acc.cash += (item.allocation?.cash || 0) * w;
        return acc;
    }, { equities: 0, bonds: 0, cash: 0 });

    // Normalize if data is missing (default to 100% equity if unknown for now, or just use what we have)
    // If allocation is missing, assume equity for Stocks, mix for ETFs?
    // Let's rely on data presence. If sum < 1, display what we have.

    // 4. Sector Allocation
    const sectorMap: Record<string, number> = {};
    portfolio.forEach(item => {
        if (item.sectors) {
            Object.entries(item.sectors).forEach(([sector, val]) => {
                const normalizedSector = sector.replace(/_/g, ' ').toLowerCase();
                // Simple title case
                const title = normalizedSector.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                sectorMap[title] = (sectorMap[title] || 0) + (val * (item.weight / totalWeight)); // val is usually 0-1
            });
        }
    });

    const topSectors = Object.entries(sectorMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, val]) => ({ name, value: val * 100 })); // Convert to %

    // Chart Logic
    const width = 800;
    const height = 320; // Slightly shorter to fit stats
    const padding = 20;

    const values = chartData.map(d => d.value);
    const divValues = chartData.map(d => d.dividendValue || 0);
    const minVal = 0;
    const maxVal = values.length > 0 ? Math.max(...values) : 100;
    const range = maxVal - minVal || 1;

    let pathD = "", areaD = "", divPathD = "", divAreaD = "";

    if (values.length > 1) {
        const points = values.map((val, i) => {
            const x = (i / (values.length - 1)) * (width - padding * 2) + padding;
            const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
            return `${x},${y}`;
        });
        pathD = `M ${points[0]} L ${points.join(' L ')}`;
        areaD = `${pathD} L ${width-padding},${height} L ${padding},${height} Z`;

        const divPoints = divValues.map((val, i) => {
            const x = (i / (values.length - 1)) * (width - padding * 2) + padding;
            const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
            return `${x},${y}`;
        });
        divPathD = `M ${divPoints[0]} L ${divPoints.join(' L ')}`;
        divAreaD = `${divPathD} L ${width-padding},${height} L ${padding},${height} Z`;
    }

    return (
      <div
        ref={ref}
        className="w-[1080px] h-[1350px] bg-[#050505] text-white p-16 flex flex-col relative overflow-hidden font-sans"
        style={{ fontFamily: 'var(--font-inter), sans-serif' }}
      >
        {/* Backgrounds */}
        <div className="absolute top-[-20%] right-[-20%] w-[1000px] h-[1000px] bg-emerald-500/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-20%] w-[1000px] h-[1000px] bg-blue-600/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />

        {/* HEADER */}
        <div className="flex justify-between items-start mb-10 relative z-10">
          <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/50">
                    <Share2 className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white">Portfolio Compass</h1>
                    <p className="text-emerald-400 font-medium tracking-wide text-sm uppercase">Institutional Analysis</p>
                </div>
          </div>
          <div className="text-right">
             <div className="inline-block px-4 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs font-mono text-neutral-400 mb-2">
                {new Date().toLocaleDateString()}
             </div>
             <h2 className="text-3xl font-bold text-white mb-1">{portfolioName || "My Growth Portfolio"}</h2>
             <p className="text-neutral-400 text-lg">by {userName || "Investor"}</p>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-4 gap-5 mb-8 relative z-10">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">Projected Value</div>
                <div className="text-2xl font-bold text-white tracking-tight">{formatCurrency(metrics.projectedValue)}</div>
                <div className="text-xs text-neutral-400 mt-1">In {metrics.years} Years</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                 <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">Total Growth</div>
                 <div className="text-2xl font-bold text-emerald-400 tracking-tight">+{metrics.percentageGrowth.toFixed(0)}%</div>
                 <div className="text-xs text-neutral-400 mt-1">{metrics.growthType} Model</div>
            </div>
             <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">Dividends</div>
                <div className="text-2xl font-bold text-blue-400 tracking-tight">{formatCurrency(metrics.dividends)}</div>
                 <div className="text-xs text-neutral-400 mt-1">Total Accumulated</div>
            </div>
             <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">CAGR</div>
                <div className="text-2xl font-bold text-white tracking-tight">{(metrics.annualReturn * 100).toFixed(2)}%</div>
                <div className="text-xs text-neutral-400 mt-1">Annual Return</div>
            </div>
        </div>

        {/* PORTFOLIO DNA / STATS ROW (NEW) */}
        <div className="grid grid-cols-3 gap-5 mb-8 relative z-10 h-[120px]">
            {/* Asset Allocation */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-bold text-white uppercase tracking-wider">Asset Class</span>
                </div>
                <div className="flex h-3 w-full rounded-full overflow-hidden bg-white/10 mb-2">
                    <div style={{ width: `${assetAllocation.equities * 100}%` }} className="bg-emerald-500" />
                    <div style={{ width: `${assetAllocation.bonds * 100}%` }} className="bg-blue-500" />
                    <div style={{ width: `${assetAllocation.cash * 100}%` }} className="bg-neutral-500" />
                </div>
                <div className="flex justify-between text-xs text-neutral-400 font-medium">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"/> Equities {(assetAllocation.equities*100).toFixed(0)}%</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"/> Bonds {(assetAllocation.bonds*100).toFixed(0)}%</span>
                </div>
            </div>

            {/* Key Stats */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex justify-between items-center">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-neutral-500 text-xs font-bold uppercase mb-1">
                        <Activity className="w-3 h-3" /> Risk (Beta)
                    </div>
                    <div className="text-2xl font-bold text-white">{weightedBeta.toFixed(2)}</div>
                    <div className="text-xs text-neutral-500">{weightedBeta < 0.8 ? 'Low' : weightedBeta > 1.2 ? 'High' : 'Moderate'}</div>
                </div>
                <div className="w-px h-12 bg-white/10" />
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-neutral-500 text-xs font-bold uppercase mb-1">
                        <DollarSign className="w-3 h-3" /> Cost (MER)
                    </div>
                    <div className="text-2xl font-bold text-white">{weightedMER.toFixed(2)}%</div>
                    <div className="text-xs text-neutral-500">Weighted Avg</div>
                </div>
            </div>

            {/* Top Sectors */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-center">
                 <div className="flex items-center gap-2 mb-3">
                    <PieChart className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-bold text-white uppercase tracking-wider">Top Exposure</span>
                </div>
                <div className="space-y-2">
                    {topSectors.length > 0 ? topSectors.map(s => (
                        <div key={s.name} className="flex justify-between items-center text-xs">
                            <span className="text-neutral-300 truncate max-w-[120px]">{s.name}</span>
                            <div className="flex items-center gap-2 flex-1 justify-end">
                                <div className="h-1.5 bg-white/10 rounded-full w-16 overflow-hidden">
                                    <div className="h-full bg-purple-500" style={{ width: `${s.value}%` }} />
                                </div>
                                <span className="text-white font-mono w-8 text-right">{s.value.toFixed(0)}%</span>
                            </div>
                        </div>
                    )) : (
                        <div className="text-xs text-neutral-500 italic">Sector data unavailable</div>
                    )}
                </div>
            </div>
        </div>

        {/* CHART SECTION */}
        <div className="flex-1 mb-8 relative z-10 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Wealth Trajectory
                </h3>
                <div className="flex gap-4 text-xs font-medium">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        Portfolio Value
                    </div>
                    <div className="flex items-center gap-2 text-blue-400">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        Dividends
                    </div>
                </div>
            </div>

            <div className="relative flex-1 w-full">
                 <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
                    <defs>
                        <linearGradient id="chartGradientMain" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                         <linearGradient id="chartGradientDiv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <line x1={padding} y1={height} x2={width-padding} y2={height} stroke="#333" strokeWidth="1" />
                    {divPathD && <path d={divAreaD} fill="url(#chartGradientDiv)" stroke="none" />}
                    {divPathD && <path d={divPathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                    {pathD && <path d={areaD} fill="url(#chartGradientMain)" stroke="none" />}
                    {pathD && <path d={pathD} fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
                 </svg>
            </div>
        </div>

        {/* HOLDINGS SECTION */}
        <div className="relative z-10 flex-shrink-0">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Top Holdings
                </h3>
                <span className="text-xs text-neutral-500">{portfolio.length} Total Assets</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {topHoldings.map((item, i) => {
                    const iconUrl = getAssetIconUrl(item.ticker, item.name, item.assetType);
                    return (
                        <div key={item.ticker} className="flex items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-xl">
                            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center p-0.5 overflow-hidden shrink-0">
                                {iconUrl ? (
                                    <img src={iconUrl} alt={item.ticker} className="w-full h-full object-contain opacity-90" crossOrigin="anonymous" />
                                ) : (
                                    <span className="text-[10px] font-bold text-neutral-300">{item.ticker.slice(0, 3)}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="font-bold text-white text-sm truncate">{item.ticker}</span>
                                    <span className="font-mono text-emerald-400 text-sm">{item.weight.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(item.weight, 100)}%` }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* FOOTER */}
        <div className="mt-auto pt-6 flex justify-between items-center relative z-10 border-t border-white/10">
             <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-xs text-neutral-400 font-medium">Generated by Portfolio Compass</span>
             </div>
             <span className="text-xs text-neutral-600 font-mono tracking-wider">portfolio-compass.vercel.app</span>
        </div>
      </div>
    );
  }
);

PortfolioShareCard.displayName = "PortfolioShareCard";
