'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, Shield, TrendingUp, Scale, X, ArrowRight } from 'lucide-react';
import Image from 'next/image';
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
    const [isOpen, setIsOpen] = useState(false);
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
        setTimeout(() => {
            setAdded(false);
            setIsOpen(false);
        }, 2000);
    };

    const activePortfolio = WEALTHSIMPLE_PORTFOLIOS[selectedType];

    return (
        <>
            {/* Trigger Card */}
            <div className="h-full flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-white/90 font-bold text-lg">Institutional Portfolios</h3>
                </div>

                <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsOpen(true)}
                    className="flex-1 bg-stone-900/50 border border-white/10 rounded-3xl p-6 cursor-pointer hover:bg-stone-900/80 transition-colors group relative overflow-hidden min-h-[200px] flex flex-col justify-between"
                >
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-bl-[100px] pointer-events-none group-hover:bg-yellow-400/10 transition-colors" />

                    <div className="relative z-10">
                        <div className="text-xs uppercase tracking-widest font-bold text-stone-500 mb-2">
                            Featured Provider
                        </div>
                        <div className="w-48 h-12 relative mb-4">
                            <Image
                                src="/logos/wealthsimple.png"
                                alt="Wealthsimple"
                                fill
                                className="object-contain object-left"
                                sizes="200px"
                            />
                        </div>
                        <p className="text-stone-400 text-sm leading-relaxed max-w-[240px]">
                            Explore and copy the exact portfolios used by Canada's leading robo-advisor.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-yellow-400/80 text-sm font-bold group-hover:gap-3 transition-all relative z-10 mt-4">
                        Explore Portfolios <ArrowRight className="w-4 h-4" />
                    </div>
                </motion.div>
            </div>

            {/* Modal / Popup */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        />

                        {/* Modal Container */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="bg-white text-stone-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col relative overflow-hidden shadow-2xl pointer-events-auto">

                                {/* Modal Header */}
                                <div className="p-6 pb-2 flex items-start justify-between">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-widest font-bold text-stone-500 mb-1">
                                            Wealthsimple Portfolios
                                        </div>
                                        <h3 className="text-2xl font-bold font-space tracking-tight">
                                            Invest like the Big Guys
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5 text-stone-500" />
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="px-6 py-2">
                                    <div className="flex p-1 bg-stone-100 rounded-lg">
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
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={selectedType}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            {/* Description */}
                                            <div className="flex items-start gap-3 mb-6 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                                                <div className="p-2 bg-yellow-400/20 rounded-full text-stone-900 shrink-0">
                                                    <activePortfolio.icon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-stone-500 uppercase mb-1">{activePortfolio.risk}</div>
                                                    <div className="text-sm font-medium leading-relaxed text-stone-800">
                                                        {activePortfolio.description}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Holdings List */}
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-stone-400 uppercase sticky top-0 bg-white">
                                                    <tr>
                                                        <th className="pb-2 font-medium pl-2">Asset</th>
                                                        <th className="pb-2 font-medium text-right pr-2">Weight</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-100">
                                                    {activePortfolio.holdings.map((h) => (
                                                        <tr key={h.ticker} className="group/row hover:bg-stone-50 transition-colors">
                                                            <td className="py-3 pl-2">
                                                                <div className="font-bold text-stone-900">{h.ticker}</div>
                                                                <div className="text-xs text-stone-500 truncate max-w-[200px]">{h.name}</div>
                                                            </td>
                                                            <td className="py-3 text-right font-mono text-stone-600 font-medium pr-2">
                                                                {h.weight}%
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* Footer Action */}
                                <div className="p-6 border-t border-stone-100 bg-white">
                                    <button
                                        onClick={handleAdd}
                                        disabled={isLoading || added}
                                        className={`w-full py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                                            added
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-stone-900 text-white hover:bg-stone-800 active:scale-95'
                                        }`}
                                        aria-label="Copy This Portfolio"
                                    >
                                        {added ? (
                                            <>
                                                <Check className="w-5 h-5" /> Added to Portfolio
                                            </>
                                        ) : (
                                            <>
                                                {isLoading ? (
                                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <Plus className="w-5 h-5" />
                                                )}
                                                Copy This Portfolio
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Decorative Gold Accent */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-bl-[100px] pointer-events-none" />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
