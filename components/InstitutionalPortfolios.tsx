'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useImportPortfolio } from '@/hooks/useImportPortfolio';
import { Check, ChevronRight, TrendingUp, Scale, Shield, X, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// --- Types ---
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

interface ProviderData {
  id: string;
  name: string;
  logo?: string; // Path to local logo or null for text fallback
  themeColor: string;
  isAvailable: boolean;
  portfolios?: Record<string, PortfolioConfig>; // Keyed by Tab Name (e.g., 'Growth')
}

// --- Data ---
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

const PROVIDERS: ProviderData[] = [
  {
    id: 'wealthsimple',
    name: 'Wealthsimple',
    logo: '/logos/wealthsimple.svg',
    themeColor: '#C5A566', // Gold
    isAvailable: true,
    portfolios: WEALTHSIMPLE_PORTFOLIOS,
  },
  {
    id: 'rbc',
    name: 'RBC InvestEase',
    logo: '/logos/rbc-global-asset-management.png',
    themeColor: '#0051A5', // RBC Blue
    isAvailable: false,
  },
  {
    id: 'td',
    name: 'TD Ready Invest',
    logo: '/logos/td-asset-management.png',
    themeColor: '#008C00', // TD Green
    isAvailable: false,
  },
  {
    id: 'bmo',
    name: 'BMO SmartFolio',
    logo: '/logos/bmo-asset-management.png',
    themeColor: '#0079C1', // BMO Blue
    isAvailable: false,
  },
  {
    id: 'scotia',
    name: 'Scotia Smart',
    logo: '/logos/scotia-global-asset-management.png',
    themeColor: '#EC111A', // Scotia Red
    isAvailable: false,
  },
  {
    id: 'cibc',
    name: 'CIBC Investor',
    themeColor: '#C41F3E', // CIBC Red
    isAvailable: false,
  },
  {
    id: 'nb',
    name: 'National Bank',
    logo: '/logos/national-bank-investments.png',
    themeColor: '#E31937', // NB Red
    isAvailable: false,
  }
];

// --- Components ---

function ProviderCard({ provider, onClick }: { provider: ProviderData; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!provider.isAvailable}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all duration-300 group h-32 w-full overflow-hidden",
        provider.isAvailable
          ? "bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10 cursor-pointer"
          : "bg-white/0 border-white/5 opacity-50 cursor-not-allowed"
      )}
    >
      {/* Glow Effect for Available */}
      {provider.isAvailable && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-xl"
          style={{
            background: `radial-gradient(circle at center, ${provider.themeColor}, transparent 70%)`,
          }}
        />
      )}

      {/* Content */}
      <div className="z-10 flex flex-col items-center w-full">
        {provider.logo ? (
          <div className="w-12 h-12 relative mb-2 grayscale group-hover:grayscale-0 transition-all duration-300">
             <Image
               src={provider.logo}
               alt={provider.name}
               fill
               className="object-contain"
               unoptimized
             />
          </div>
        ) : (
            // Text Fallback
            <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-2 font-bold text-xl"
                style={{ backgroundColor: provider.isAvailable ? provider.themeColor : '#333', color: 'black' }}
            >
                {provider.name.charAt(0)}
            </div>
        )}

        <span className={cn(
            "text-xs font-medium text-center truncate w-full px-2",
            provider.isAvailable ? "text-neutral-200 group-hover:text-white" : "text-neutral-500"
        )}>
          {provider.name}
        </span>
      </div>

      {!provider.isAvailable && (
        <div className="absolute top-2 right-2">
            <Lock className="w-3 h-3 text-neutral-600" />
        </div>
      )}
    </button>
  );
}

function PortfolioDetailsModal({ provider, onClose }: { provider: ProviderData; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<RiskLevel>('Growth');
  const importPortfolioMutation = useImportPortfolio();
  const [isSuccess, setIsSuccess] = useState(false);

  // Safely get config
  const activeConfig = provider.portfolios ? provider.portfolios[activeTab] : null;

  if (!activeConfig) return null;

  const handleImport = async () => {
    const items = activeConfig.holdings.map(h => ({ ticker: h.ticker, weight: h.weight }));
    await importPortfolioMutation.mutateAsync(items);
    setIsSuccess(true);
    setTimeout(() => {
        setIsSuccess(false);
        onClose();
    }, 1500);
  };

  const TabButton = ({ level, icon: Icon }: { level: RiskLevel; icon: any }) => (
    <button
      onClick={() => { setActiveTab(level); setIsSuccess(false); }}
      className={cn(
        "flex-1 flex items-center justify-center gap-2 py-3 px-2 text-sm font-medium transition-all relative",
        activeTab === level
          ? "text-white"
          : "text-neutral-500 hover:text-neutral-300"
      )}
    >
      <Icon className={cn("w-4 h-4", activeTab === level && "text-[var(--theme-color)]")} style={ activeTab === level ? { color: provider.themeColor } : {}} />
      <span className="hidden sm:inline">{level}</span>
      {activeTab === level && (
        <motion.div
          layoutId="modalTabIndicator"
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ backgroundColor: provider.themeColor }}
        />
      )}
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal Card */}
      <motion.div
        key="modal-card"
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-stone-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
                {/* Logo or Icon */}
                 {provider.logo ? (
                     <div className="w-8 h-8 relative grayscale-0">
                         <Image
                           src={provider.logo}
                           alt={provider.name}
                           fill
                           className="object-contain"
                           unoptimized
                         />
                     </div>
                 ) : (
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-black"
                        style={{ backgroundColor: provider.themeColor }}
                    >
                        {provider.name.charAt(0)}
                    </div>
                 )}
                 <div>
                    <h3 className="text-white font-bold text-lg font-space leading-none">
                        {provider.name}
                    </h3>
                    <span className="text-xs text-neutral-400">Classic Portfolio Templates</span>
                 </div>
            </div>
            <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white"
                aria-label="Close"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-white/[0.02]">
            <TabButton level="Growth" icon={TrendingUp} />
            <TabButton level="Balanced" icon={Scale} />
            <TabButton level="Conservative" icon={Shield} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="mb-6">
                <div className="text-sm font-mono mb-1" style={{ color: provider.themeColor }}>{activeConfig.risk}</div>
                <div className="text-neutral-300 text-sm leading-relaxed max-w-lg">
                    {activeConfig.description}
                </div>
            </div>

            <table className="w-full text-sm text-left mb-4">
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
                            <td className="py-3 pl-1 font-mono group-hover:text-white transition-colors" style={{ color: provider.themeColor }}>
                                {h.ticker}
                            </td>
                            <td className="py-3 text-neutral-300">
                                {h.name}
                            </td>
                            <td className="py-3 text-right pr-1 font-mono text-neutral-400 group-hover:text-white transition-colors">
                                {h.weight}%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* Footer / Actions */}
        <div className="p-6 border-t border-white/5 bg-white/[0.02]">
            <button
                onClick={handleImport}
                disabled={importPortfolioMutation.isPending || isSuccess}
                className={cn(
                    "w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                    isSuccess
                        ? "bg-emerald-500/20 text-emerald-400 cursor-default"
                        : "text-black hover:opacity-90 active:scale-[0.98]"
                )}
                style={!isSuccess ? { backgroundColor: provider.themeColor } : {}}
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
                        Add {activeTab} Portfolio
                        <ChevronRight className="w-4 h-4 opacity-60" />
                    </>
                )}
            </button>
        </div>

      </motion.div>
    </motion.div>
  );
}

// --- Main Container ---

export default function InstitutionalPortfolios() {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  const selectedProvider = PROVIDERS.find(p => p.id === selectedProviderId);

  return (
    <>
        <div className="w-full h-full bg-stone-950 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-white font-bold text-lg font-space">
                        Institutional Portfolios
                    </h3>
                </div>
                <p className="text-neutral-400 text-sm">
                    Replicate professional allocation strategies from top financial institutions.
                </p>
            </div>

            {/* Grid */}
            <div className="p-6 grid grid-cols-2 gap-4 auto-rows-min">
                {PROVIDERS.map((provider) => (
                    <ProviderCard
                        key={provider.id}
                        provider={provider}
                        onClick={() => setSelectedProviderId(provider.id)}
                    />
                ))}
            </div>
        </div>

        {/* Modal */}
        <AnimatePresence>
            {selectedProvider && (
                <PortfolioDetailsModal
                    key="modal"
                    provider={selectedProvider}
                    onClose={() => setSelectedProviderId(null)}
                />
            )}
        </AnimatePresence>
    </>
  );
}
