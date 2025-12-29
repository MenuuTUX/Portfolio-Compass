import React from 'react';
import { Portfolio } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Share2, TrendingUp, Shield, PieChart, Info, Waves } from 'lucide-react';
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

    // Sort portfolio by weight
    const topHoldings = [...portfolio].sort((a, b) => b.weight - a.weight).slice(0, 10);
    const otherCount = Math.max(0, portfolio.length - 10);

    // Generate SVG path for chart
    const width = 800; // Scaled up width for the larger card
    const height = 400;
    const padding = 20;

    // Normalize data safely
    const values = chartData.map(d => d.value);
    const divValues = chartData.map(d => d.dividendValue || 0);

    const minVal = 0;
    const maxVal = values.length > 0 ? Math.max(...values) : 100;
    const maxDivVal = divValues.length > 0 ? Math.max(...divValues) : 100;

    // Use a shared max range if we want them on same scale, or dual axis logic.
    // Usually dividends are much smaller, so putting them on same scale makes them a flat line.
    // Let's normalize dividends to their own max for visualization shape, but maybe
    // keep them lower visually (e.g. max height is 30% of chart) if we want to show volume.
    // Or just overlay them. Let's try overlaying them scaled to the main chart's height
    // but maybe capping at 50% height for visual distinction if they are huge?
    // Actually, simplest is just plotting them relative to the main value scale
    // if we want to show true contribution. But accumulated dividends are often significant.
    // Let's stick to the same scale (Value Scale) to show true proportion.

    const range = maxVal - minVal || 1;

    let pathD = "";
    let areaD = "";
    let divPathD = "";
    let divAreaD = "";

    if (values.length > 1) {
        // Growth Line
        const points = values.map((val, i) => {
            const x = (i / (values.length - 1)) * (width - padding * 2) + padding;
            const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
            return `${x},${y}`;
        });

        pathD = `M ${points[0]} L ${points.join(' L ')}`;
        areaD = `${pathD} L ${width-padding},${height} L ${padding},${height} Z`;

        // Dividend Line (using same scale)
        const divPoints = divValues.map((val, i) => {
            const x = (i / (values.length - 1)) * (width - padding * 2) + padding;
            const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
            return `${x},${y}`;
        });

        divPathD = `M ${divPoints[0]} L ${divPoints.join(' L ')}`;
        divAreaD = `${divPathD} L ${width-padding},${height} L ${padding},${height} Z`;

    } else if (values.length === 1) {
        // Fallback for single point
        const y = height / 2;
        pathD = `M ${padding},${y} L ${width-padding},${y}`;
        areaD = `${pathD} L ${width-padding},${height} L ${padding},${height} Z`;
    }

    return (
      <div
        ref={ref}
        className="w-[1080px] h-[1350px] bg-[#050505] text-white p-16 flex flex-col relative overflow-hidden font-sans"
        style={{ fontFamily: 'var(--font-inter), sans-serif' }}
      >
        {/* Aesthetic Backgrounds */}
        <div className="absolute top-[-20%] right-[-20%] w-[1000px] h-[1000px] bg-emerald-500/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-20%] w-[1000px] h-[1000px] bg-blue-600/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />

        {/* HEADER */}
        <div className="flex justify-between items-start mb-12 relative z-10">
          <div>
            <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/50">
                    <Share2 className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white">Portfolio Compass</h1>
                    <p className="text-emerald-400 font-medium tracking-wide text-sm uppercase">Institutional Grade Analysis</p>
                </div>
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

        {/* MAIN METRICS ROW */}
        <div className="grid grid-cols-4 gap-6 mb-12 relative z-10">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">Projected Value</div>
                <div className="text-3xl font-bold text-white tracking-tight">{formatCurrency(metrics.projectedValue)}</div>
                <div className="text-xs text-neutral-400 mt-2 flex items-center gap-1">
                    In {metrics.years} Years
                </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                 <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">Total Growth</div>
                 <div className="text-3xl font-bold text-emerald-400 tracking-tight">+{metrics.percentageGrowth.toFixed(0)}%</div>
                 <div className="text-xs text-neutral-400 mt-2">
                    {metrics.growthType} Model
                 </div>
            </div>
             <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">Dividend Income</div>
                <div className="text-3xl font-bold text-blue-400 tracking-tight">{formatCurrency(metrics.dividends)}</div>
                 <div className="text-xs text-neutral-400 mt-2">
                    Avg Yield: {(metrics.yield * 100).toFixed(2)}%
                 </div>
            </div>
             <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">CAGR</div>
                <div className="text-3xl font-bold text-white tracking-tight">{(metrics.annualReturn * 100).toFixed(2)}%</div>
                <div className="text-xs text-neutral-400 mt-2">
                   Annual Return
                </div>
            </div>
        </div>

        {/* CHART SECTION */}
        <div className="flex-1 mb-12 relative z-10 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Wealth Trajectory
                </h3>
                <div className="flex gap-4 text-sm font-medium">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        Portfolio Value
                    </div>
                    <div className="flex items-center gap-2 text-blue-400">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        Accumulated Dividends
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

                    {/* Grid Lines */}
                    <line x1={padding} y1={height} x2={width-padding} y2={height} stroke="#333" strokeWidth="1" />
                    <line x1={padding} y1={padding} x2={padding} y2={height} stroke="#333" strokeWidth="1" />

                    {divPathD && (
                        <>
                            <path d={divAreaD} fill="url(#chartGradientDiv)" stroke="none" />
                            <path d={divPathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                    )}

                    {pathD && (
                        <>
                            <path d={areaD} fill="url(#chartGradientMain)" stroke="none" />
                            <path d={pathD} fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                    )}
                 </svg>
            </div>

            <div className="flex justify-between mt-4 pt-4 border-t border-white/10 text-neutral-400 text-sm font-mono">
                <span>Year 0</span>
                <span>Year {metrics.years / 2}</span>
                <span>Year {metrics.years}</span>
            </div>
        </div>

        {/* HOLDINGS SECTION */}
        <div className="relative z-10">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <PieChart className="w-5 h-5 text-purple-500" />
                Top Holdings
            </h3>

            <div className="grid grid-cols-2 gap-4">
                {topHoldings.map((item, i) => {
                    const iconUrl = getAssetIconUrl(item.ticker, item.name, item.assetType);
                    return (
                        <div key={item.ticker} className="flex items-center gap-4 bg-white/5 border border-white/5 p-4 rounded-xl">
                            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center p-1 overflow-hidden shrink-0">
                                {iconUrl ? (
                                    <img
                                        src={iconUrl}
                                        alt={item.ticker}
                                        className="w-full h-full object-contain opacity-90"
                                        crossOrigin="anonymous"
                                    />
                                ) : (
                                    <span className="text-xs font-bold text-neutral-300">{item.ticker.slice(0, 3)}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-white truncate">{item.ticker}</span>
                                    <span className="font-mono text-emerald-400">{item.weight.toFixed(1)}%</span>
                                </div>
                                <div className="text-xs text-neutral-500 truncate">{item.name}</div>
                            </div>
                            {/* Bar */}
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0 ml-2">
                                <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${Math.min(item.weight, 100)}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            {otherCount > 0 && (
                <div className="mt-4 text-center text-neutral-500 text-sm font-medium">
                    + {otherCount} other positions diversifing this portfolio
                </div>
            )}
        </div>

        {/* FOOTER */}
        <div className="mt-auto pt-8 flex justify-between items-center relative z-10 border-t border-white/10">
             <div className="flex items-center gap-2">
                 <Shield className="w-5 h-5 text-emerald-500" />
                 <span className="text-sm text-neutral-400 font-medium">Verified Analysis by Portfolio Compass</span>
             </div>
             <span className="text-sm text-neutral-500 font-mono tracking-wider">portfolio-compass.vercel.app</span>
        </div>
      </div>
    );
  }
);

PortfolioShareCard.displayName = "PortfolioShareCard";
