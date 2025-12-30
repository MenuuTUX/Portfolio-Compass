'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, Shield, TrendingUp, Scale } from 'lucide-react';
import { BatchAddItem } from '@/hooks/useBatchAddPortfolio';

interface InstitutionalPortfoliosProps {
    onBatchAdd: (items: BatchAddItem[]) => void;
    isLoading?: boolean;
}

const WEALTHSIMPLE_PORTFOLIOS = {
    Growth: {
        risk: 'Risk 8-10',
        description: 'Maximize long-term growth with a higher allocation to equities.',
        icon: TrendingUp,
        holdings: [
            { ticker: 'VTI', name: 'Vanguard Total Stock Market', weight: 25 },
            { ticker: 'USMV', name: 'iShares Edge MSCI Min Vol USA', weight: 27 },
            { ticker: 'EFA', name: 'iShares MSCI EAFE', weight: 14 },
            { ticker: 'EEMV', name: 'iShares MSCI Emerging Mkts Min Vol', weight: 14 },
            { ticker: 'XIC.TO', name: 'iShares Core S&P/TSX Capped', weight: 10 },
            { ticker: 'ZFL.TO', name: 'BMO Long Federal Bond Index', weight: 7.5 },
            { ticker: 'GLDM', name: 'SPDR Gold MiniShares', weight: 2.5 },
        ]
    },
    Balanced: {
        risk: 'Risk 4-6',
        description: 'A mix of safety and growth for moderate risk tolerance.',
        icon: Scale,
        holdings: [
            { ticker: 'VTI', name: 'Vanguard Total Stock Market', weight: 15 },
            { ticker: 'USMV', name: 'iShares Edge MSCI Min Vol USA', weight: 15 },
            { ticker: 'EFA', name: 'iShares MSCI EAFE', weight: 10 },
            { ticker: 'EEMV', name: 'iShares MSCI Emerging Mkts Min Vol', weight: 10 },
            { ticker: 'XIC.TO', name: 'iShares Core S&P/TSX Capped', weight: 10 },
            { ticker: 'ZFL.TO', name: 'BMO Long Federal Bond Index', weight: 37.5 },
            { ticker: 'GLDM', name: 'SPDR Gold MiniShares', weight: 2.5 },
        ]
    },
    Conservative: {
        risk: 'Risk 1-3',
        description: 'Preserve capital with a focus on bonds and low volatility.',
        icon: Shield,
        holdings: [
            { ticker: 'VTI', name: 'Vanguard Total Stock Market', weight: 10 },
            { ticker: 'USMV', name: 'iShares Edge MSCI Min Vol USA', weight: 8 },
            { ticker: 'EFA', name: 'iShares MSCI EAFE', weight: 6 },
            { ticker: 'EEMV', name: 'iShares MSCI Emerging Mkts Min Vol', weight: 4 },
            { ticker: 'XIC.TO', name: 'iShares Core S&P/TSX Capped', weight: 7 },
            { ticker: 'ZFL.TO', name: 'BMO Long Federal Bond Index', weight: 62.5 },
            { ticker: 'GLDM', name: 'SPDR Gold MiniShares', weight: 2.5 },
        ]
    }
};

type PortfolioType = keyof typeof WEALTHSIMPLE_PORTFOLIOS;

export default function InstitutionalPortfolios({ onBatchAdd, isLoading = false }: InstitutionalPortfoliosProps) {
    const [selectedType, setSelectedType] = useState<PortfolioType>('Growth');
    const [added, setAdded] = useState(false);

    const handleAdd = () => {
        const portfolio = WEALTHSIMPLE_PORTFOLIOS[selectedType];
        const items: BatchAddItem[] = portfolio.holdings.map(h => ({
            ticker: h.ticker,
            weight: h.weight,
            shares: 0
        }));

        onBatchAdd(items);
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
    };

    const activePortfolio = WEALTHSIMPLE_PORTFOLIOS[selectedType];

    return (
        <div className="w-full bg-white text-stone-900 rounded-2xl p-6 flex flex-col relative overflow-hidden group border border-white/10 shadow-lg">
             {/* Header */}
            <div className="mb-6">
                <div className="text-[10px] uppercase tracking-widest font-bold text-stone-500 mb-1">
                    Wealthsimple Portfolios
                </div>
                <h3 className="text-2xl font-bold font-space tracking-tight">
                    Invest like the Big Guys
                </h3>
                <p className="text-stone-500 text-sm mt-1">
                    Institutional grade logic, one-click away.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-stone-100 rounded-lg mb-6">
                {(Object.keys(WEALTHSIMPLE_PORTFOLIOS) as PortfolioType[]).map((type) => (
                    <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                            selectedType === type
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-500 hover:text-stone-700'
                        }`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={selectedType}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col"
                >
                    {/* Description */}
                    <div className="flex items-start gap-3 mb-6">
                         <div className="p-3 bg-yellow-400/20 rounded-full text-stone-900">
                            <activePortfolio.icon className="w-5 h-5" />
                         </div>
                         <div>
                             <div className="text-xs font-bold text-stone-400 uppercase">{activePortfolio.risk}</div>
                             <div className="text-sm font-medium leading-relaxed">
                                 {activePortfolio.description}
                             </div>
                         </div>
                    </div>

                    {/* Holdings List (Compact) */}
                    <div className="flex-1 overflow-hidden relative mb-6">
                        <div className="absolute inset-0 overflow-y-auto custom-scrollbar pr-2">
                             <table className="w-full text-sm text-left">
                                 <thead className="text-xs text-stone-400 uppercase sticky top-0 bg-white">
                                     <tr>
                                         <th className="pb-2 font-medium">Asset</th>
                                         <th className="pb-2 font-medium text-right">Weight</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-stone-100">
                                     {activePortfolio.holdings.map((h) => (
                                         <tr key={h.ticker} className="group/row hover:bg-stone-50 transition-colors">
                                             <td className="py-2.5">
                                                 <div className="font-bold">{h.ticker}</div>
                                                 <div className="text-[10px] text-stone-500 truncate max-w-[140px]">{h.name}</div>
                                             </td>
                                             <td className="py-2.5 text-right font-mono text-stone-600">
                                                 {h.weight}%
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                        </div>
                         {/* Fade for scroll */}
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                    </div>

                    {/* Action Button - Removed motion.div wrapper from button to simplify testing interactions if that was the issue */}
                    <button
                        onClick={handleAdd}
                        disabled={isLoading || added}
                        className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                            added
                                ? 'bg-emerald-500 text-white'
                                : 'bg-stone-900 text-white hover:bg-stone-800 active:scale-95'
                        }`}
                        aria-label="Copy This Portfolio"
                    >
                        {added ? (
                            <>
                                <Check className="w-4 h-4" /> Added to Portfolio
                            </>
                        ) : (
                            <>
                                {isLoading ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Plus className="w-4 h-4" />
                                )}
                                Copy This Portfolio
                            </>
                        )}
                    </button>

                </motion.div>
            </AnimatePresence>

            {/* Decorative Gold Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-bl-[100px] pointer-events-none" />
        </div>
    );
}
