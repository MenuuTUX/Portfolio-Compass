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
            <div className="grid grid-cols-4 gap-4 h-full">
                {INSTITUTIONAL_DATA.map((inst) => {
                    const isImageFailed = failedImages.has(inst.id) || !inst.logo;

                    return (
                        <motion.div
                            key={inst.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedInstitution(inst)}
                            className="relative aspect-square cursor-pointer group flex flex-col items-center justify-center gap-2"
                        >
                            {/* App Icon Shape */}
                            <div className={cn(
                                "w-full h-full rounded-2xl overflow-hidden relative flex items-center justify-center border border-white/10 transition-all duration-300 group-hover:border-white/20",
                                "bg-white/5 backdrop-blur-sm"
                            )}>
                                <div className="relative w-3/4 h-3/4 flex items-center justify-center">
                                    {isImageFailed ? (
                                        <div className={cn("text-[10px] font-bold text-center leading-tight", inst.themeColor)}>
                                            {inst.name.replace(' Asset Management', '')}
                                        </div>
                                    ) : (
                                        <Image
                                            src={inst.logo}
                                            alt={inst.name}
                                            fill
                                            className="object-contain object-center p-2"
                                            sizes="100px"
                                            onError={() => handleImageError(inst.id)}
                                        />
                                    )}
                                </div>

                                {/* Hover Overlay */}
                                <div className={`absolute inset-0 bg-gradient-to-tr ${inst.themeGradient} opacity-0 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none mix-blend-overlay`} />
                            </div>

                            {/* Label */}
                            <span className="text-[10px] font-medium text-stone-500 group-hover:text-stone-300 transition-colors text-center w-full truncate px-1 opacity-0 group-hover:opacity-100 absolute -bottom-6">
                                {inst.name.split(' ')[0]}
                            </span>
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
                            <div className="bg-[#0a0a0a] border border-white/10 text-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col relative overflow-hidden shadow-2xl pointer-events-auto glass-panel">

                                {/* Modal Header */}
                                <div className="p-6 pb-2 flex items-start justify-between bg-white/5 border-b border-white/5 z-10 backdrop-blur-md">
                                    <div className="flex-1 pr-4">
                                        <div className="h-8 w-32 relative mb-2 flex items-center">
                                            {(failedImages.has(selectedInstitution.id) || !selectedInstitution.logo) ? (
                                                 <h2 className={cn("text-2xl font-bold tracking-tight", selectedInstitution.themeColor.replace('text-', 'text-'))}>
                                                    {selectedInstitution.name}
                                                 </h2>
                                            ) : (
                                                <div className="relative w-full h-full bg-white rounded-lg p-1">
                                                    <Image
                                                        src={selectedInstitution.logo}
                                                        alt={selectedInstitution.name}
                                                        fill
                                                        className="object-contain object-left p-1"
                                                        onError={() => handleImageError(selectedInstitution.id)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm text-neutral-400 leading-snug">
                                            {selectedInstitution.description}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedInstitution(null)}
                                        className="p-2 hover:bg-white/10 text-neutral-400 hover:text-white rounded-full transition-colors shrink-0"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="px-6 py-2 bg-black/20 z-10 border-b border-white/5">
                                    <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
                                        {(['Growth', 'Balanced', 'Conservative'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setSelectedType(type)}
                                                className={cn(
                                                    "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                                                    selectedType === type
                                                        ? "bg-white/10 text-white shadow-sm border border-white/10"
                                                        : "text-neutral-400 hover:text-neutral-200"
                                                )}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar bg-transparent">
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
                                                    "bg-white/5 border-white/10"
                                                )}>
                                                    <div className={cn("p-2 rounded-full shrink-0 bg-black/40 shadow-sm border border-white/10", selectedInstitution.themeColor)}>
                                                        <ActiveIcon className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-neutral-400 uppercase mb-1">
                                                            {activePortfolio.risk} • {activePortfolio.name}
                                                        </div>
                                                        <div className="text-sm font-medium leading-relaxed text-neutral-300">
                                                            {activePortfolio.description}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Holdings List */}
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-xs text-neutral-500 uppercase sticky top-0 bg-[#0a0a0a] backdrop-blur-md">
                                                        <tr>
                                                            <th className="pb-2 font-medium pl-2">Asset</th>
                                                            <th className="pb-2 font-medium text-right pr-2">Weight</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {activePortfolio.holdings.map((h) => (
                                                            <tr key={h.ticker} className="group/row hover:bg-white/5 transition-colors">
                                                                <td className="py-3 pl-2">
                                                                    <div className="font-bold text-white">{h.ticker}</div>
                                                                    <div className="text-xs text-neutral-500 truncate max-w-[200px] group-hover/row:text-neutral-400 transition-colors">{h.name}</div>
                                                                </td>
                                                                <td className="py-3 text-right font-mono text-emerald-400 font-medium pr-2">
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
                                <div className="p-6 border-t border-white/10 bg-white/5 z-10 backdrop-blur-md">
                                    <button
                                        onClick={handleAdd}
                                        disabled={isLoading || added}
                                        className={cn(
                                            "w-full py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                                            added
                                                ? "bg-emerald-500 text-white"
                                                : "bg-white text-black hover:bg-neutral-200 active:scale-95"
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
