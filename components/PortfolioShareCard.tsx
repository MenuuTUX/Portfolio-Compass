import React from 'react';
import { Portfolio } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Share2, TrendingUp, Shield, PieChart } from 'lucide-react';

export interface ShareCardProps {
  userName?: string;
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
  };
  chartData: { value: number; label?: string }[];
}

export const PortfolioShareCard = React.forwardRef<HTMLDivElement, ShareCardProps>(
  ({ userName, portfolio, metrics, chartData }, ref) => {

    // Sort portfolio by weight
    const topHoldings = [...portfolio].sort((a, b) => b.weight - a.weight).slice(0, 8);
    const otherCount = Math.max(0, portfolio.length - 8);

    // Generate SVG path for chart
    const width = 600;
    const height = 150;
    const padding = 10;

    // Normalize data safely
    const values = chartData.map(d => d.value);
    const minVal = values.length > 0 ? Math.min(...values) : 0;
    const maxVal = values.length > 0 ? Math.max(...values) : 100;
    const range = maxVal - minVal || 1;

    let pathD = "";
    let areaD = "";

    if (values.length > 1) {
        const points = values.map((val, i) => {
            const x = (i / (values.length - 1)) * (width - padding * 2) + padding;
            const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
            return `${x},${y}`;
        });

        pathD = `M ${points[0]} L ${points.join(' L ')}`;
        areaD = `${pathD} L ${width-padding},${height} L ${padding},${height} Z`;
    } else if (values.length === 1) {
        // Fallback for single point (horizontal line)
        const y = height / 2;
        pathD = `M ${padding},${y} L ${width-padding},${y}`;
        areaD = `${pathD} L ${width-padding},${height} L ${padding},${height} Z`;
    }

    return (
      <div
        ref={ref}
        className="w-[800px] bg-[#0a0a0a] text-white p-8 rounded-xl border border-neutral-800 shadow-2xl font-sans relative overflow-hidden"
        style={{ fontFamily: 'var(--font-inter), sans-serif' }}
      >
        {/* Background Elements */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-900/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-900/10 blur-[80px] rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex justify-between items-start mb-8 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                    <Share2 className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Portfolio Compass</h1>
            </div>
            <p className="text-neutral-400 text-sm">Investment Strategy Report</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-emerald-400">{userName || "Investor"}'s Portfolio</h2>
            <p className="text-neutral-500 text-sm">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8 relative z-10">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="text-neutral-400 text-xs uppercase tracking-wider mb-1">Total Value</div>
                <div className="text-xl font-bold text-white">{formatCurrency(metrics.totalValue)}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="text-neutral-400 text-xs uppercase tracking-wider mb-1">Proj. Return</div>
                <div className="text-xl font-bold text-emerald-400">{(metrics.annualReturn * 100).toFixed(2)}%</div>
            </div>
             <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="text-neutral-400 text-xs uppercase tracking-wider mb-1">Avg. Yield</div>
                <div className="text-xl font-bold text-blue-400">{(metrics.yield * 100).toFixed(2)}%</div>
            </div>
             <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="text-neutral-400 text-xs uppercase tracking-wider mb-1">{metrics.scenario}</div>
                <div className="text-xl font-bold text-white">{formatCurrency(metrics.projectedValue)}</div>
                <div className="text-xs text-neutral-500">after {metrics.years} years</div>
            </div>
        </div>

        {/* Layout: Chart & Holdings */}
        <div className="grid grid-cols-3 gap-8 relative z-10">
            {/* Left: Chart & Growth */}
            <div className="col-span-2 flex flex-col gap-6">
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 h-full relative overflow-hidden">
                    <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Wealth Projection
                    </h3>

                    <div className="w-full h-[150px] relative">
                         <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {pathD && (
                                <>
                                    <path d={areaD} fill="url(#chartGradient)" stroke="none" />
                                    <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </>
                            )}
                         </svg>
                    </div>

                    <div className="flex justify-between mt-4 pt-4 border-t border-white/10 text-sm">
                        <div>
                            <span className="text-neutral-400 block text-xs">Total Invested</span>
                            <span className="text-white font-medium">{formatCurrency(metrics.totalInvested)}</span>
                        </div>
                         <div>
                            <span className="text-neutral-400 block text-xs text-right">Est. Dividends</span>
                            <span className="text-blue-400 font-medium">{formatCurrency(metrics.dividends)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Holdings */}
            <div className="col-span-1">
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 h-full">
                     <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-purple-500" />
                        Top Allocations
                    </h3>
                    <div className="space-y-3">
                        {topHoldings.map(item => (
                            <div key={item.ticker} className="flex items-center gap-2 text-sm">
                                <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
                                    {item.ticker.slice(0, 3)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between mb-1">
                                        <span className="truncate text-neutral-300 text-xs">{item.ticker}</span>
                                        <span className="text-white font-mono text-xs">{item.weight.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full"
                                            style={{ width: `${Math.min(item.weight, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {otherCount > 0 && (
                            <div className="text-center text-xs text-neutral-500 mt-2 italic">
                                + {otherCount} other assets
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center relative z-10">
             <div className="flex items-center gap-2">
                 <Shield className="w-4 h-4 text-emerald-500" />
                 <span className="text-xs text-neutral-400">Generated by Portfolio Compass</span>
             </div>
             <span className="text-xs text-neutral-600 font-mono">portfolio-compass.vercel.app</span>
        </div>
      </div>
    );
  }
);

PortfolioShareCard.displayName = "PortfolioShareCard";
