'use client';

import { useState, useTransition } from 'react';
import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import PurposeSection from '@/components/PurposeSection';
import ComparisonEngine from '@/components/ComparisonEngine';
import PortfolioBuilder from '@/components/PortfolioBuilder';
import TrendingTab from '@/components/TrendingTab';
import SettingsDrawer from '@/components/SettingsDrawer';
import IntroQuiz, { QuizResult } from '@/components/IntroQuiz';
import { ETF, PortfolioItem } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useAddStock } from '@/hooks/useAddStock';
import { useUpdatePortfolioItem } from '@/hooks/useUpdatePortfolioItem';
import { useBatchUpdatePortfolio, BatchUpdateItem } from '@/hooks/useBatchUpdatePortfolio';
import { useRemoveStock } from '@/hooks/useRemoveStock';
import { useQueryClient } from '@tanstack/react-query';
import { savePortfolio } from '@/lib/storage';

type ViewMode = 'LANDING' | 'INTRO_QUIZ' | 'APP';
type Tab = 'TRENDING' | 'PORTFOLIO' | 'ETFS' | 'STOCKS';

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('LANDING');
  const [activeTab, setActiveTab] = useState<Tab>('TRENDING');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Use React Query hooks
  const { data: portfolio = [] } = usePortfolio();
  const addStockMutation = useAddStock();
  const removeStockMutation = useRemoveStock();
  const updatePortfolioItemMutation = useUpdatePortfolioItem();
  const batchUpdatePortfolioMutation = useBatchUpdatePortfolio();
  const queryClient = useQueryClient();

  const handleStart = () => {
    setViewMode('INTRO_QUIZ');
  };

  const handleViewMarket = () => {
    setViewMode('APP');
  };

  const handleQuizComplete = async (result: QuizResult) => {
    if (result.suggestedPortfolio && result.suggestedPortfolio.length > 0) {
      savePortfolio(result.suggestedPortfolio);
      // Invalidate to fetch full details (price, name, etc.)
      await queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      setActiveTab('PORTFOLIO');
    }
    setViewMode('APP');
  };

  const handleAddToPortfolio = async (etf: ETF) => {
    await addStockMutation.mutateAsync({ ticker: etf.ticker });
  };

  const handleRemoveFromPortfolio = (ticker: string) => {
    removeStockMutation.mutate(ticker);
  };

  const handleUpdateWeight = (ticker: string, weight: number) => {
    updatePortfolioItemMutation.mutate({ ticker, weight });
  };

  const handleUpdateShares = (ticker: string, shares: number) => {
    updatePortfolioItemMutation.mutate({ ticker, shares });
  };

  const handleBatchUpdate = (updates: BatchUpdateItem[]) => {
    batchUpdatePortfolioMutation.mutate(updates);
  };

  const handleClearPortfolio = () => {
    savePortfolio([]);
    queryClient.setQueryData(['portfolio'], []);
  };

  const handleImportPortfolio = (items: PortfolioItem[]) => {
    // 1. Save to local storage
    savePortfolio(items);
    // 2. Update React Query cache immediately
    queryClient.setQueryData(['portfolio'], items);
    // 3. Navigate to Portfolio tab to show result
    startTransition(() => setActiveTab('PORTFOLIO'));
  };

  return (
    <main className="min-h-screen bg-black overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'LANDING' ? (
          <motion.div
            key="landing"
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="overflow-y-auto h-screen custom-scrollbar"
          >
            <Hero onStart={handleStart} onViewMarket={handleViewMarket} />
            <PurposeSection />
            <footer className="relative w-full py-12 text-center text-stone-600 text-xs border-t border-stone-900 bg-stone-950">
              <p>&copy; {new Date().getFullYear()} PortfolioCompass. Institutional Grade Intelligence.</p>
            </footer>
          </motion.div>
        ) : viewMode === 'INTRO_QUIZ' ? (
          <motion.div
            key="intro-quiz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="h-screen flex items-center justify-center overflow-hidden"
          >
             <IntroQuiz onComplete={handleQuizComplete} />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col h-screen"
          >
            <Navigation
              activeTab={activeTab}
              onTabChange={(tab) => startTransition(() => setActiveTab(tab))}
              onBackToLanding={() => setViewMode('LANDING')}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />

            <SettingsDrawer
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
            />

            <div className="flex-1 pt-16 relative overflow-y-auto custom-scrollbar scroll-smooth">
              <AnimatePresence mode="wait">
                {activeTab === 'TRENDING' && (
                  <TrendingTab
                    key="trending"
                    onAddToPortfolio={handleAddToPortfolio}
                    portfolio={portfolio}
                    onRemoveFromPortfolio={handleRemoveFromPortfolio}
                    onImportPortfolio={handleImportPortfolio}
                  />
                )}
                {activeTab === 'PORTFOLIO' && (
                  <PortfolioBuilder
                    key="portfolio"
                    portfolio={portfolio}
                    onRemove={handleRemoveFromPortfolio}
                    onUpdateWeight={handleUpdateWeight}
                    onUpdateShares={handleUpdateShares}
                    onBatchUpdate={handleBatchUpdate}
                    onClear={handleClearPortfolio}
                  />
                )}
                {activeTab === 'ETFS' && (
                  <ComparisonEngine
                    key="etfs"
                    onAddToPortfolio={handleAddToPortfolio}
                    onRemoveFromPortfolio={handleRemoveFromPortfolio}
                    portfolio={portfolio}
                    assetType="ETF"
                  />
                )}
                {activeTab === 'STOCKS' && (
                  <ComparisonEngine
                    key="stocks"
                    onAddToPortfolio={handleAddToPortfolio}
                    onRemoveFromPortfolio={handleRemoveFromPortfolio}
                    portfolio={portfolio}
                    assetType="STOCK"
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
