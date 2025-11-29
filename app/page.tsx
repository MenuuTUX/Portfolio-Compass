'use client';

import { useState } from 'react';
import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import ComparisonEngine from '@/components/ComparisonEngine';
import PortfolioBuilder from '@/components/PortfolioBuilder';
import WealthProjector from '@/components/WealthProjector';
import { ETF, Portfolio } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';

type ViewMode = 'LANDING' | 'APP';
type Tab = 'PORTFOLIO' | 'ETFS' | 'STOCKS' | 'GROWTH';

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('LANDING');
  const [activeTab, setActiveTab] = useState<Tab>('PORTFOLIO');
  const [portfolio, setPortfolio] = useState<Portfolio>([]);

  const handleStart = () => {
    setViewMode('APP');
  };

  const handleAddToPortfolio = (etf: ETF) => {
    setPortfolio(prev => {
      if (prev.find(item => item.ticker === etf.ticker)) return prev;

      // Auto-balance logic: distribute weight evenly initially
      const newPortfolio = [...prev, { ...etf, weight: 0 }];
      const evenWeight = 100 / newPortfolio.length;
      return newPortfolio.map(item => ({ ...item, weight: Number(evenWeight.toFixed(2)) }));
    });
  };

  const handleRemoveFromPortfolio = (ticker: string) => {
    setPortfolio(prev => {
      const newPortfolio = prev.filter(item => item.ticker !== ticker);
      if (newPortfolio.length === 0) return [];

      const evenWeight = 100 / newPortfolio.length;
      return newPortfolio.map(item => ({ ...item, weight: Number(evenWeight.toFixed(2)) }));
    });
  };

  const handleUpdateWeight = (ticker: string, weight: number) => {
    setPortfolio(prev => prev.map(item =>
      item.ticker === ticker ? { ...item, weight } : item
    ));
  };

  const handleClearPortfolio = () => {
    setPortfolio([]);
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
          >
            <Hero onStart={handleStart} />
            <footer className="absolute bottom-0 w-full py-6 text-center text-neutral-600 text-xs">
              <p>&copy; {new Date().getFullYear()} PortfolioCompass. Institutional Grade Intelligence.</p>
            </footer>
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col h-screen"
          >
            <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="flex-1 pt-16 relative">
              <AnimatePresence mode="wait">
                {activeTab === 'PORTFOLIO' && (
                  <PortfolioBuilder
                    key="portfolio"
                    portfolio={portfolio}
                    onRemove={handleRemoveFromPortfolio}
                    onUpdateWeight={handleUpdateWeight}
                    onClear={handleClearPortfolio}
                  />
                )}
                {activeTab === 'ETFS' && (
                  <ComparisonEngine key="etfs" onAddToPortfolio={handleAddToPortfolio} />
                )}
                {activeTab === 'STOCKS' && (
                  <ComparisonEngine key="stocks" onAddToPortfolio={handleAddToPortfolio} />
                )}
                {activeTab === 'GROWTH' && (
                  <WealthProjector key="growth" portfolio={portfolio} />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
