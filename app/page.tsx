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
import { useRemoveStock } from '@/hooks/useRemoveStock';
import { useQueryClient } from '@tanstack/react-query';
import { savePortfolio } from '@/lib/storage';
import Footer from '@/components/Footer';
import { EASE } from '@/components/motion/Reveal';

type ViewMode = 'LANDING' | 'INTRO_QUIZ' | 'APP';
type Tab = 'TRENDING' | 'PORTFOLIO' | 'ETFS' | 'STOCKS';

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('LANDING');
  const [activeTab, setActiveTab] = useState<Tab>('TRENDING');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { data: portfolio = [] } = usePortfolio(
    viewMode === "APP" && activeTab === "PORTFOLIO",
  );
  const addStockMutation = useAddStock();
  const removeStockMutation = useRemoveStock();
  const updatePortfolioItemMutation = useUpdatePortfolioItem();
  const queryClient = useQueryClient();

  const handleStart = () => {
    setViewMode('INTRO_QUIZ');
  };

  const handleViewMarket = () => {
    setViewMode('APP');
  };

  const handleQuizComplete = async (result: QuizResult) => {
    if (result.isSkipped || !result.suggestedPortfolio || result.suggestedPortfolio.length === 0) {
      setViewMode('APP');
      return;
    }

    if (result.suggestedPortfolio.length > 0) {
      savePortfolio(result.suggestedPortfolio);
      await queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      setActiveTab('PORTFOLIO');
    }
    setViewMode('APP');
  };

  const handleAddToPortfolio = async (etf: ETF) => {
    // Pass the already-loaded asset so add works even if DB-backed search is down
    await addStockMutation.mutateAsync({ ticker: etf.ticker, etf });
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

  const handleClearPortfolio = () => {
    savePortfolio([]);
    queryClient.setQueryData(['portfolio'], []);
  };

  const handleImportPortfolio = (items: PortfolioItem[]) => {
    savePortfolio(items);
    queryClient.setQueryData(['portfolio'], items);
    startTransition(() => setActiveTab('PORTFOLIO'));
  };

  const switchTab = (tab: Tab) => startTransition(() => setActiveTab(tab));

  return (
    <main className="min-h-screen bg-canvas overflow-hidden relative">
      <AnimatePresence mode="wait">
        {viewMode === 'LANDING' ? (
          <motion.div
            key="landing"
            id="top"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-y-auto h-screen custom-scrollbar"
          >
            <Hero onStart={handleStart} onViewMarket={handleViewMarket} />
            <PurposeSection />
            <Footer />
          </motion.div>
        ) : viewMode === 'INTRO_QUIZ' ? (
          <motion.div
            key="intro-quiz"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="h-screen flex items-center justify-center overflow-hidden"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
              className="w-full flex items-center justify-center"
            >
              <IntroQuiz onComplete={handleQuizComplete} />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="h-screen flex flex-col bg-canvas p-2 gap-2"
          >
            <SettingsDrawer
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05, ease: EASE }}
              className="flex-1 min-h-0 relative max-lg:overflow-y-auto max-lg:pb-16 custom-scrollbar"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className="lg:h-full min-h-0"
                >
                  {activeTab === 'TRENDING' && (
                    <TrendingTab
                      onAddToPortfolio={handleAddToPortfolio}
                      portfolio={portfolio}
                      onRemoveFromPortfolio={handleRemoveFromPortfolio}
                      onImportPortfolio={handleImportPortfolio}
                      onNavigate={switchTab}
                    />
                  )}
                  {activeTab === 'PORTFOLIO' && (
                    <PortfolioBuilder
                      portfolio={portfolio}
                      onRemove={handleRemoveFromPortfolio}
                      onUpdateWeight={handleUpdateWeight}
                      onUpdateShares={handleUpdateShares}
                      onClear={handleClearPortfolio}
                      onNavigate={switchTab}
                    />
                  )}
                  {activeTab === 'ETFS' && (
                    <ComparisonEngine
                      onAddToPortfolio={handleAddToPortfolio}
                      onRemoveFromPortfolio={handleRemoveFromPortfolio}
                      portfolio={portfolio}
                      assetType="ETF"
                    />
                  )}
                  {activeTab === 'STOCKS' && (
                    <ComparisonEngine
                      onAddToPortfolio={handleAddToPortfolio}
                      onRemoveFromPortfolio={handleRemoveFromPortfolio}
                      portfolio={portfolio}
                      assetType="STOCK"
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>

            <Navigation
              activeTab={activeTab}
              onTabChange={switchTab}
              onBackToLanding={() => setViewMode('LANDING')}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
