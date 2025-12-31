'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, Shield, TrendingUp, Scale, X, Wallet } from 'lucide-react';
import Image from 'next/image';
import { BatchAddItem } from '@/hooks/useBatchAddPortfolio';
import { INSTITUTIONAL_DATA, Institution } from '@/lib/institutional-portfolios';
import { cn } from '@/lib/utils';

interface InstitutionalPortfoliosProps {
    onBatchAdd: (items: BatchAddItem[]) => void;
    isLoading?: boolean;
}

export default function InstitutionalPortfolios({ onBatchAdd, isLoading = false }: InstitutionalPortfoliosProps) {
    const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
    const [selectedType, setSelectedType] = useState<'Growth' | 'Balanced' | 'Conservative'>('Growth');
    const [added, setAdded] = useState(false);
    const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

    const handleAdd = () => {
        if (!selectedInstitution) return;

        const portfolio = selectedInstitution.portfolios[selectedType];
        const items: BatchAddItem[] = portfolio.holdings.map(h => ({
            ticker: h.ticker,
            weight: h.weight,
            shares: 0
        }));

        onBatchAdd(items);
        setAdded(true);
        setTimeout(() => {
            setAdded(false);
            // Optionally close the modal
            // setSelectedInstitution(null);
        }, 2000);
    };

    const handleImageError = (id: string) => {
        setFailedImages(prev => new Set(prev).add(id));
    };

    const activePortfolio = selectedInstitution?.portfolios[selectedType];

    // Helper to get the correct icon component
    const getIcon = (iconName: string) => {
        switch (iconName) {
            case 'TrendingUp': return TrendingUp;
            case 'Scale': return Scale;
            case 'Shield': return Shield;
            default: return Wallet;
        }
    };

    const ActiveIcon = activePortfolio ? getIcon(activePortfolio.iconName) : Wallet;

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <h3 className="text-white/90 font-bold text-lg">Institutional Portfolios</h3>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-2 gap-3 h-full">
                {INSTITUTIONAL_DATA.map((inst) => {
                    const isImageFailed = failedImages.has(inst.id) || !inst.logo;

                    return (
                        <motion.div
                            key={inst.id}
                            whileHover={{ scale: 1.02, borderColor: 'rgba(255,255,255,0.2)' }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedInstitution(inst)}
                            className="relative bg-stone-900/40 border border-white/5 rounded-lg cursor-pointer hover:bg-stone-900/60 transition-all group overflow-hidden flex items-center justify-center h-20 backdrop-blur-sm"
                        >
                            <div className={cn(
                                "relative w-24 h-8 rounded px-2 flex items-center justify-center transition-transform group-hover:scale-110 duration-300",
                                isImageFailed ? "bg-transparent" : "bg-white/90 shadow-lg"
                            )}>
                                <div className="relative w-full h-full flex items-center justify-center">
                                    {isImageFailed ? (
                                        <div className={cn("text-xs font-bold text-center leading-tight", inst.themeColor)}>
                                            {inst.name.replace(' Asset Management', '')}
                                        </div>
                                    ) : (
                                        <Image
                                            src={inst.logo}
                                            alt={inst.name}
                                            fill
                                            className="object-contain object-center"
                                            sizes="100px"
                                            onError={() => handleImageError(inst.id)}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Hover Gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-tr ${inst.themeGradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none`} />
                        </motion.div>
                    );
                })}
            </div>

            {/* Modal / Popup */}
            <AnimatePresence>
                {selectedInstitution && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedInstitution(null)}
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
                                <div className="p-6 pb-2 flex items-start justify-between bg-white z-10">
                                    <div className="flex-1 pr-4">
                                        <div className="h-8 w-32 relative mb-2 flex items-center">
                                            {(failedImages.has(selectedInstitution.id) || !selectedInstitution.logo) ? (
                                                 <h2 className={cn("text-2xl font-bold tracking-tight", selectedInstitution.themeColor.replace('text-', 'text-'))}>
                                                    {selectedInstitution.name}
                                                 </h2>
                                            ) : (
                                                <Image
                                                    src={selectedInstitution.logo}
                                                    alt={selectedInstitution.name}
                                                    fill
                                                    className="object-contain object-left"
                                                    onError={() => handleImageError(selectedInstitution.id)}
                                                />
                                            )}
                                        </div>
                                        <p className="text-sm text-stone-500 leading-snug">
                                            {selectedInstitution.description}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedInstitution(null)}
                                        className="p-2 hover:bg-stone-100 rounded-full transition-colors shrink-0"
                                    >
                                        <X className="w-5 h-5 text-stone-500" />
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="px-6 py-2 bg-white z-10">
                                    <div className="flex p-1 bg-stone-100 rounded-lg">
                                        {(['Growth', 'Balanced', 'Conservative'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setSelectedType(type)}
                                                className={cn(
                                                    "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                                                    selectedType === type
                                                        ? "bg-white text-stone-900 shadow-sm"
                                                        : "text-stone-500 hover:text-stone-700"
                                                )}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar bg-white">
                                    <AnimatePresence mode="wait">
                                        {activePortfolio && (
                                            <motion.div
                                                key={selectedInstitution.id + selectedType}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                {/* Description */}
                                                <div className={cn(
                                                    "flex items-start gap-3 mb-6 p-4 rounded-xl border",
                                                    "bg-stone-50 border-stone-100"
                                                )}>
                                                    <div className={cn("p-2 rounded-full shrink-0 bg-white shadow-sm", selectedInstitution.themeColor)}>
                                                        <ActiveIcon className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-stone-500 uppercase mb-1">
                                                            {activePortfolio.risk} • {activePortfolio.name}
                                                        </div>
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
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Footer Action */}
                                <div className="p-6 border-t border-stone-100 bg-white z-10">
                                    <button
                                        onClick={handleAdd}
                                        disabled={isLoading || added}
                                        className={cn(
                                            "w-full py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                                            added
                                                ? "bg-emerald-500 text-white"
                                                : "bg-stone-900 text-white hover:bg-stone-800 active:scale-95"
                                        )}
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

                                {/* Decorative Accent */}
                                <div className={cn(
                                    "absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] pointer-events-none bg-gradient-to-bl opacity-50",
                                    selectedInstitution.themeGradient
                                )} />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
