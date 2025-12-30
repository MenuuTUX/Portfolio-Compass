'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useImportPortfolio } from '@/hooks/useImportPortfolio';
import { Check, ChevronRight, Info, Shield, TrendingUp, Scale, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
type RiskLevel = 'Growth' | 'Balanced' | 'Conservative';

interface Holding {
  ticker: string;
  name: string;
  weight: number;
}

interface PortfolioConfig {
  risk: string;
  description: string;
  holdings: Holding[];
}

const WEALTHSIMPLE_PORTFOLIOS: Record<RiskLevel, PortfolioConfig> = {
  Growth: {
    risk: 'Risk 8-10',
    description: 'Maximize long-term growth with higher equity exposure.',
    holdings: [
      { ticker: 'VTI', name: 'Vanguard Total Stock Market', weight: 25 },
      { ticker: 'USMV', name: 'iShares Edge MSCI Min Vol USA', weight: 27 },
      { ticker: 'EFA', name: 'iShares MSCI EAFE', weight: 14 },
      { ticker: 'EEMV', name: 'iShares MSCI Emerging Mkts Min Vol', weight: 14 },
      { ticker: 'XIC', name: 'iShares Core S&P/TSX Capped', weight: 10 },
      { ticker: 'ZFL', name: 'BMO Long Federal Bond Index', weight: 7.5 },
      { ticker: 'GLDM', name: 'SPDR Gold MiniShares', weight: 2.5 },
    ],
  },
  Balanced: {
    risk: 'Risk 4-6',
    description: 'A balance of growth and protection.',
    holdings: [
      { ticker: 'VTI', name: 'Vanguard Total Stock Market', weight: 15 },
      { ticker: 'USMV', name: 'iShares Edge MSCI Min Vol USA', weight: 15 },
      { ticker: 'EFA', name: 'iShares MSCI EAFE', weight: 10 },
      { ticker: 'EEMV', name: 'iShares MSCI Emerging Mkts Min Vol', weight: 10 },
      { ticker: 'XIC', name: 'iShares Core S&P/TSX Capped', weight: 10 },
      { ticker: 'ZFL', name: 'BMO Long Federal Bond Index', weight: 37.5 },
      { ticker: 'GLDM', name: 'SPDR Gold MiniShares', weight: 2.5 },
    ],
  },
  Conservative: {
    risk: 'Risk 1-3',
    description: 'Prioritize preservation of capital with lower volatility.',
    holdings: [
      { ticker: 'VTI', name: 'Vanguard Total Stock Market', weight: 10 },
      { ticker: 'USMV', name: 'iShares Edge MSCI Min Vol USA', weight: 8 },
      { ticker: 'EFA', name: 'iShares MSCI EAFE', weight: 6 },
      { ticker: 'EEMV', name: 'iShares MSCI Emerging Mkts Min Vol', weight: 4 },
      { ticker: 'XIC', name: 'iShares Core S&P/TSX Capped', weight: 7 },
      { ticker: 'ZFL', name: 'BMO Long Federal Bond Index', weight: 62.5 },
      { ticker: 'GLDM', name: 'SPDR Gold MiniShares', weight: 2.5 },
    ],
  },
};

export default function InstitutionalPortfolios() {
  const [activeTab, setActiveTab] = useState<RiskLevel>('Growth');
  const importPortfolioMutation = useImportPortfolio();
  const [isSuccess, setIsSuccess] = useState(false);

  const handleImport = async () => {
    const portfolio = WEALTHSIMPLE_PORTFOLIOS[activeTab];
    const items = portfolio.holdings.map(h => ({ ticker: h.ticker, weight: h.weight }));

    await importPortfolioMutation.mutateAsync(items);

    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 3000);
  };

  const activeConfig = WEALTHSIMPLE_PORTFOLIOS[activeTab];

  // Helper for Tab Button
  const TabButton = ({ level, icon: Icon }: { level: RiskLevel; icon: any }) => (
    <button
      onClick={() => { setActiveTab(level); setIsSuccess(false); }}
      className={cn(
        "flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium transition-all relative",
        activeTab === level
          ? "text-[#C5A566]"
          : "text-neutral-400 hover:text-neutral-200"
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{level}</span>
      {activeTab === level && (
        <motion.div
          layoutId="activeTabIndicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C5A566]"
        />
      )}
    </button>
  );

  return (
    <div className="w-full bg-stone-950 border border-white/10 rounded-2xl flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-bold text-lg font-space">
            Institutional Portfolios
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-[#C5A566] bg-[#C5A566]/10 px-2 py-0.5 rounded-full font-bold">
            Wealthsimple
            </span>
        </div>
        <p className="text-neutral-400 text-sm">
          Explore portfolios from the big guys. Professional allocation templates.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-white/5">
        <TabButton level="Growth" icon={TrendingUp} />
        <TabButton level="Balanced" icon={Scale} />
        <TabButton level="Conservative" icon={Shield} />
      </div>

      {/* Content */}
      <div className="p-6 flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
            >
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <div className="text-sm text-neutral-500 mb-1 font-mono">{activeConfig.risk}</div>
                        <div className="text-neutral-300 text-sm leading-relaxed">
                            {activeConfig.description}
                        </div>
                    </div>
                </div>

                {/* Holdings List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar -mr-2 pr-2 mb-6">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-neutral-500 uppercase font-medium border-b border-white/5">
                            <tr>
                                <th className="pb-2 pl-1">Ticker</th>
                                <th className="pb-2">Asset</th>
                                <th className="pb-2 text-right pr-1">Weight</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {activeConfig.holdings.map((h) => (
                                <tr key={h.ticker} className="group hover:bg-white/5 transition-colors">
                                    <td className="py-2.5 pl-1 font-mono text-[#C5A566] group-hover:text-white transition-colors">
                                        {h.ticker}
                                    </td>
                                    <td className="py-2.5 text-neutral-300 truncate max-w-[140px]" title={h.name}>
                                        {h.name}
                                    </td>
                                    <td className="py-2.5 text-right pr-1 font-mono text-neutral-400 group-hover:text-white transition-colors">
                                        {h.weight}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleImport}
                    disabled={importPortfolioMutation.isPending || isSuccess}
                    className={cn(
                        "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                        isSuccess
                            ? "bg-emerald-500/20 text-emerald-400 cursor-default"
                            : "bg-[#C5A566] text-black hover:bg-[#D4B679] active:scale-[0.98]"
                    )}
                >
                    {importPortfolioMutation.isPending ? (
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : isSuccess ? (
                        <>
                            <Check className="w-4 h-4" />
                            Added to Portfolio
                        </>
                    ) : (
                        <>
                            Add to Portfolio
                            <ChevronRight className="w-4 h-4 opacity-60" />
                        </>
                    )}
                </button>
            </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
