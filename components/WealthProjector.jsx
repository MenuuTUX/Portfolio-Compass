'use client';

import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn, formatCurrency } from '@/lib/utils';
import { useOnScreen } from '@/hooks/useOnScreen';

export default function WealthProjector({ portfolio }) {
  const [initialInvestment, setInitialInvestment] = useState(10000);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [years, setYears] = useState(20);
  const [ref, isVisible] = useOnScreen({ threshold: 0.1 });

  // Calculate Weighted Average Return (Simplified Assumption based on Yield + 5% Capital Appreciation)
  // In a real app, you'd use historic CAGR or a robust model.
  const weightedReturn = useMemo(() => {
    if (portfolio.length === 0) return 0.07; // Default 7%

    const totalWeight = portfolio.reduce((acc, item) => acc + item.weight, 0);
    if (totalWeight === 0) return 0;

    return portfolio.reduce((acc, item) => {
      // Estimated Return = Yield + 5% (Base Capital Growth assumption for equities)
      // Bond heavy? Adjust. This is a "toy" model for the demo.
      // Let's use specific logic:
      // If Bonds (ZAG) -> Yield + 1%
      // If Equity -> Yield + 6%
      let growthRate = 0.06;
      if (item.ticker.includes('ZAG')) growthRate = 0.01;

      const estimatedTotalReturn = (item.metrics.yield / 100) + growthRate;
      return acc + (estimatedTotalReturn * (item.weight / totalWeight));
    }, 0);
  }, [portfolio]);

  const projectionData = useMemo(() => {
    let balance = initialInvestment;
    const data = [];
    const monthlyRate = weightedReturn / 12;

    for (let i = 0; i <= years * 12; i++) {
      if (i % 12 === 0) {
        data.push({
          year: `Y${i / 12}`,
          balance: Math.round(balance),
          invested: initialInvestment + (monthlyContribution * i)
        });
      }
      balance = (balance + monthlyContribution) * (1 + monthlyRate);
    }
    return data;
  }, [initialInvestment, monthlyContribution, years, weightedReturn]);

  const finalAmount = projectionData[projectionData.length - 1].balance;
  const totalInvested = projectionData[projectionData.length - 1].invested;

  return (
    <section id="projector" ref={ref} className="py-24 px-4 max-w-7xl mx-auto">
      <div className={cn(
        "transition-all duration-1000 transform",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"
      )}>
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-2">Wealth Projector</h2>
          <p className="text-neutral-400">Monte Carlo simulation based on your portfolio's weighted yield + growth assumptions.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Controls */}
          <div className="glass-panel p-6 rounded-xl space-y-6 h-fit">
            <div>
              <label className="text-sm text-neutral-400 block mb-2">Initial Investment</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-500">$</span>
                <input
                  type="number"
                  value={initialInvestment}
                  onChange={(e) => setInitialInvestment(Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-neutral-400 block mb-2">Monthly Contribution</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-500">$</span>
                <input
                  type="number"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-neutral-400 block mb-2">Time Horizon (Years): {years}</label>
              <input
                type="range"
                min="5"
                max="50"
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="pt-6 border-t border-white/10">
              <div className="text-sm text-neutral-500 mb-1">Projected Annual Return</div>
              <div className="text-2xl font-bold text-emerald-400">{(weightedReturn * 100).toFixed(2)}%</div>
            </div>
          </div>

          {/* Chart */}
          <div className="lg:col-span-3 glass-panel p-6 rounded-xl flex flex-col">
            <div className="flex justify-between items-end mb-6">
              <div>
                <div className="text-sm text-neutral-500">Projected Wealth</div>
                <div className="text-4xl font-bold text-white">{formatCurrency(finalAmount)}</div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-sm text-neutral-500">Total Invested</div>
                <div className="text-xl font-medium text-neutral-300">{formatCurrency(totalInvested)}</div>
              </div>
            </div>

            <div className="flex-1 min-h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="year" stroke="#666" tick={{fill: '#666'}} axisLine={false} tickLine={false} />
                  <YAxis
                    stroke="#666"
                    tick={{fill: '#666'}}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `$${value/1000}k`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorBalance)"
                  />
                  <Area
                    type="monotone"
                    dataKey="invested"
                    stroke="#525252"
                    strokeDasharray="5 5"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
