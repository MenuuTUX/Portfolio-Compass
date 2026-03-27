import React from "react";
import { Portfolio } from "@/types";
import { formatCurrency } from "@/lib/utils";
import {
  Share2,
  TrendingUp,
  Shield,
  Layers,
  PieChart,
  Activity,
  DollarSign,
} from "lucide-react";
import { getAssetIconUrl } from "@/lib/etf-providers";

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
    growthType: "Simple" | "Monte Carlo";
    percentageGrowth: number;
  };
  chartData: {
    value: number;
    dividendValue?: number;
    min?: number;
    max?: number;
  }[];
  spyData?: {
    value: number;
  }[];
}

export const PortfolioShareCard = React.forwardRef<
  HTMLDivElement,
  ShareCardProps
>(
  (
    { userName, portfolioName, portfolio, metrics, chartData, spyData },
    ref,
  ) => {
    const topHoldings = [...portfolio]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);

    const totalWeight =
      portfolio.reduce((sum, item) => sum + item.weight, 0) || 1;

    const weightedMER = portfolio.reduce((acc, item) => {
      return acc + (item.metrics?.mer || 0) * (item.weight / totalWeight);
    }, 0);

    const weightedBeta = portfolio.reduce((acc, item) => {
      return acc + (item.beta || 1.0) * (item.weight / totalWeight);
    }, 0);

    const assetAllocation = portfolio.reduce(
      (acc, item) => {
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
      },
      { equities: 0, bonds: 0, cash: 0 },
    );

    const sectors = portfolio.reduce(
      (acc, item) => {
        const w = item.weight / totalWeight;
        const itemSectors = item.sectors || {};
        const sectorEntries = Object.entries(itemSectors);

        if (sectorEntries.length > 0) {
          sectorEntries.forEach(([rawName, rawWeight]) => {
            const sName = rawName
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());

            const sWeight = Number(rawWeight) || 0;
            const normalizedSWeight = sWeight > 1 ? sWeight / 100 : sWeight;
            acc[sName] = (acc[sName] || 0) + normalizedSWeight * w;
          });
        } else {
          acc["Unknown"] = (acc["Unknown"] || 0) + w;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const topSectors = Object.entries(sectors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, weight]) => ({ name, weight }));

    const fullWidth = 1000;
    const fullHeight = 280;
    const margin = { top: 30, right: 30, bottom: 40, left: 80 };
    const width = fullWidth - margin.left - margin.right;
    const height = fullHeight - margin.top - margin.bottom;

    const values = chartData.map((d) => d.value);
    const spyValues = spyData ? spyData.map((d) => d.value) : [];

    const hasRange = chartData.some(
      (d) => d.min !== undefined && d.max !== undefined,
    );

    const portfolioMax = hasRange
      ? Math.max(...chartData.map((d) => d.max || d.value))
      : Math.max(...values);
    const spyMax = spyValues.length > 0 ? Math.max(...spyValues) : 0;

    const minVal = 0;
    const maxVal = Math.max(portfolioMax, spyMax) || 100;
    const range = maxVal - minVal || 1;

    const getX = (i: number, len: number) => (i / (len - 1)) * width;
    const getY = (val: number) => height - ((val - minVal) / range) * height;

    let pathD = "",
      areaD = "";
    let rangeAreaD = "";
    let spyPathD = "";

    if (values.length > 1) {
      const points = values.map(
        (val, i) => `${getX(i, values.length)},${getY(val)}`,
      );
      pathD = `M ${points[0]} L ${points.join(" L ")}`;
      areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

      if (hasRange) {
        const upperPoints = chartData.map(
          (d, i) => `${getX(i, chartData.length)},${getY(d.max || d.value)}`,
        );
        const lowerPoints = chartData.map(
          (d, i) => `${getX(i, chartData.length)},${getY(d.min || d.value)}`,
        );

        rangeAreaD =
          `M ${upperPoints[0].split(",")[0]},${upperPoints[0].split(",")[1]} ` +
          `L ${upperPoints.join(" L ")} ` +
          `L ${lowerPoints.reverse().join(" L ")} Z`;
      }

      if (spyValues.length > 1) {
        const spyPoints = spyValues.map(
          (val, i) => `${getX(i, spyValues.length)},${getY(val)}`,
        );
        spyPathD = `M ${spyPoints[0]} L ${spyPoints.join(" L ")}`;
      }
    }

    const yTicks = 5;
    const yTickValues = Array.from(
      { length: yTicks + 1 },
      (_, i) => minVal + range * (i / yTicks),
    );

    const formatYTick = (val: number) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
      return `$${val}`;
    };

    return (
      <div
        ref={ref}
        className="w-[1080px] h-[1350px] bg-[#0a0a0a] text-white p-12 flex flex-col relative overflow-hidden font-sans"
        style={{ fontFamily: "var(--font-inter), sans-serif" }}
      >
        <div className="absolute top-[-20%] right-[-10%] w-[1000px] h-[1000px] bg-amber-900/10 blur-[180px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-neutral-900/20 blur-[180px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.05] pointer-events-none" />

        <div className="flex justify-between items-start mb-12 relative z-10 border-b border-neutral-800 pb-8 shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-lg bg-amber-600 flex items-center justify-center shadow-xl shadow-amber-900/20 border-2 border-amber-500/50">
              <Share2 className="w-8 h-8 text-black" />
            </div>
            <div>
              <h1
                className="text-4xl font-bold tracking-tight text-amber-500 mb-2 font-mono uppercase"
                style={{ fontFamily: "var(--font-share-mono)" }}
              >
                Portfolio_Compass
              </h1>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Professional Analysis
                </span>
                <span className="text-neutral-500 text-xs font-medium uppercase tracking-wide">
                  Portfolio Report
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block px-3 py-1 rounded-full bg-white/5 text-neutral-400 text-xs font-medium mb-2 border border-white/5">
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">
              {portfolioName || "Investment Portfolio"}
            </h2>
            <p className="text-neutral-400 text-base font-medium">
              Prepared for{" "}
              <span className="text-white font-semibold">
                {userName || "Investor"}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8 relative z-10">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-4 right-4 text-amber-500/20 group-hover:text-amber-500/40 transition-colors">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="text-neutral-500 text-[11px] font-bold uppercase tracking-widest mb-2">
              Projected Value
            </div>
            <div className="text-3xl font-bold text-white tracking-tight mb-1">
              {formatCurrency(metrics.projectedValue)}
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
              {metrics.years} Year Horizon
            </div>
          </div>

          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-4 right-4 text-amber-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div className="text-neutral-500 text-[11px] font-bold uppercase tracking-widest mb-2">
              Total Return
            </div>
            <div className="text-3xl font-bold text-amber-400 tracking-tight mb-1">
              +{metrics.percentageGrowth.toFixed(0)}%
            </div>
            <div className="text-xs text-neutral-500 font-medium">
              {metrics.growthType} Model
            </div>
          </div>

          <div className="bg-[#111] border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-4 right-4 text-amber-500/20">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="text-neutral-500 text-[11px] font-bold uppercase tracking-widest mb-2">
              Accumulated Yield
            </div>
            <div className="text-3xl font-bold text-amber-300 tracking-tight mb-1">
              {formatCurrency(metrics.dividends)}
            </div>
            <div className="text-xs text-neutral-500 font-medium">
              Reinvested Dividends
            </div>
          </div>

          <div className="bg-[#111] border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-4 right-4 text-amber-500/20">
              <PieChart className="w-6 h-6" />
            </div>
            <div className="text-neutral-500 text-[11px] font-bold uppercase tracking-widest mb-2">
              CAGR
            </div>
            <div className="text-3xl font-bold text-white tracking-tight mb-1">
              {(metrics.annualReturn * 100).toFixed(2)}%
            </div>
            <div className="text-xs text-neutral-500 font-medium">
              Compound Annual Growth
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 mb-8 relative z-10">
          <div className="col-span-5 bg-[#111] border border-neutral-800 rounded-2xl p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono">
                Asset_Allocation
              </span>
            </div>
            <div className="flex h-4 w-full rounded-sm overflow-hidden bg-neutral-900 mb-4 border border-neutral-800">
              <div
                style={{ width: `${assetAllocation.equities * 100}%` }}
                className="bg-amber-500"
              />
              <div
                style={{ width: `${assetAllocation.bonds * 100}%` }}
                className="bg-neutral-500"
              />
              <div
                style={{ width: `${assetAllocation.cash * 100}%` }}
                className="bg-neutral-800"
              />
            </div>
            <div className="flex justify-between text-xs font-medium font-mono">
              <div className="flex items-center gap-2 text-amber-400">
                <div className="w-2 h-2 rounded-sm bg-amber-500"></div>
                EQUITIES {(assetAllocation.equities * 100).toFixed(0)}%
              </div>
              <div className="flex items-center gap-2 text-neutral-400">
                <div className="w-2 h-2 rounded-sm bg-neutral-500"></div>
                FIXED {(assetAllocation.bonds * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="col-span-3 bg-[#111] border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-red-500" />
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono">
                Risk_Profile
              </span>
            </div>
            <div className="flex justify-between items-end mb-2">
              <span className="text-neutral-400 text-xs font-medium font-mono">BETA</span>
              <span className="text-xl font-bold text-white font-mono">
                {weightedBeta.toFixed(2)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-sm overflow-hidden mb-4">
              <div
                className="h-full bg-red-500 rounded-sm"
                style={{ width: `${Math.min(weightedBeta * 50, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-end">
              <span className="text-neutral-400 text-xs font-medium font-mono">MER</span>
              <span className="text-xl font-bold text-white font-mono">
                {weightedMER.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="col-span-4 bg-[#111] border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono">
                Sector_Exposure
              </span>
            </div>
            <div className="space-y-3">
              {topSectors.map((s, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-neutral-300 font-medium truncate max-w-[140px]">
                    {s.name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/5 text-white font-mono text-xs border border-white/5">
                    {(s.weight * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-8 bg-[#111] border border-white/10 rounded-2xl p-8 relative overflow-hidden flex-1 min-h-[300px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              Wealth Growth vs S&P 500
            </h3>
            <div className="flex gap-6 text-xs font-medium">
              <div className="flex items-center gap-2 text-amber-400">
                <div className="w-3 h-1 rounded-full bg-amber-500"></div>
                Your Portfolio
              </div>
              {spyData && (
                <div className="flex items-center gap-2 text-amber-400">
                  <div className="w-3 h-1 bg-amber-500 border-b border-amber-500 border-dashed"></div>
                  S&P 500 (Benchmark)
                </div>
              )}
              {hasRange && (
                <div className="flex items-center gap-2 text-amber-400/50">
                  <div className="w-3 h-3 rounded bg-amber-500/10 border border-amber-500/30"></div>
                  90% Confidence Interval
                </div>
              )}
            </div>
          </div>

          <div className="relative w-full h-[220px]">
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${fullWidth} ${fullHeight}`}
              className="overflow-visible"
            >
              <defs>
                <linearGradient
                  id="chartGradientMain2"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
              </defs>

              <g transform={`translate(${margin.left}, ${margin.top})`}>
                {yTickValues.map((val, i) => {
                  const yPos = getY(val);
                  return (
                    <g key={`y-${i}`}>
                      <line
                        x1={0}
                        y1={yPos}
                        x2={width}
                        y2={yPos}
                        stroke="#333"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={-10}
                        y={yPos}
                        dy="0.32em"
                        textAnchor="end"
                        fill="#666"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {formatYTick(val)}
                      </text>
                    </g>
                  );
                })}

                <text
                  x={-40}
                  y={height / 2}
                  transform={`rotate(-90, -50, ${height / 2})`}
                  textAnchor="middle"
                  fill="#555"
                  fontSize="10"
                  fontWeight="bold"
                  letterSpacing="1"
                >
                  PORTFOLIO VALUE (USD)
                </text>

                <g transform={`translate(0, ${height + 15})`}>
                  <text
                    x={0}
                    y={0}
                    dy="0.71em"
                    textAnchor="start"
                    fill="#666"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    Year 0
                  </text>
                  <text
                    x={width / 2}
                    y={0}
                    dy="0.71em"
                    textAnchor="middle"
                    fill="#666"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    Year {metrics.years / 2}
                  </text>
                  <text
                    x={width}
                    y={0}
                    dy="0.71em"
                    textAnchor="end"
                    fill="#666"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    Year {metrics.years}
                  </text>

                  <text
                    x={width / 2}
                    y={20}
                    dy="0.71em"
                    textAnchor="middle"
                    fill="#555"
                    fontSize="10"
                    fontWeight="bold"
                    letterSpacing="1"
                  >
                    TIME HORIZON
                  </text>
                </g>

                {hasRange && rangeAreaD && (
                  <path
                    d={rangeAreaD}
                    fill="#f59e0b"
                    fillOpacity="0.08"
                    stroke="none"
                    style={{ filter: "blur(4px)" }}
                  />
                )}

                {spyPathD && (
                  <path
                    d={spyPathD}
                    fill="none"
                    stroke="#737373"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.8"
                  />
                )}

                {pathD && !hasRange && (
                  <path
                    d={areaD}
                    fill="url(#chartGradientMain2)"
                    stroke="none"
                  />
                )}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </g>
            </svg>
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex justify-between items-center mb-5 border-b border-white/10 pb-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Top Holdings
            </h3>
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
              {portfolio.length} TOTAL ASSETS
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {topHoldings.map((item) => {
              const iconUrl = getAssetIconUrl(
                item.ticker,
                item.name,
                item.assetType,
              );
              return (
                <div
                  key={item.ticker}
                  className="flex items-center gap-4 bg-[#151515] border border-white/10 p-4 rounded-xl"
                >
                  <div className="w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center p-1.5 overflow-hidden shrink-0 border border-white/5">
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt={item.ticker}
                        className="w-full h-full object-contain opacity-90"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-neutral-400">
                        {item.ticker.slice(0, 3)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-bold text-white text-base truncate">
                        {item.ticker}
                      </span>
                      <span className="font-mono text-amber-400 text-sm font-bold">
                        {item.weight.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-600 rounded-full"
                        style={{ width: `${Math.min(item.weight, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-auto pt-8 flex justify-between items-center relative z-10 border-t border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.6)]" />
            <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest font-mono">
              Generated by Portfolio Compass
            </span>
          </div>
          <span className="text-xs text-neutral-500 font-mono">
            portfolio-compass.vercel.app
          </span>
        </div>
      </div>
    );
  },
);

PortfolioShareCard.displayName = "PortfolioShareCard";
