'use client';

import { useState } from 'react';
import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import ComparisonEngine from '@/components/ComparisonEngine';
import PortfolioBuilder from '@/components/PortfolioBuilder';
import WealthProjector from '@/components/WealthProjector';

export default function Home() {
  const [portfolio, setPortfolio] = useState([]);

  const handleAddToPortfolio = (etf) => {
    setPortfolio(prev => {
      if (prev.find(item => item.ticker === etf.ticker)) return prev;

      // Auto-balance logic: distribute weight evenly initially
      const newPortfolio = [...prev, { ...etf, weight: 0 }];
      const evenWeight = 100 / newPortfolio.length;
      return newPortfolio.map(item => ({ ...item, weight: Number(evenWeight.toFixed(2)) }));
    });
  };

  const handleRemoveFromPortfolio = (ticker) => {
    setPortfolio(prev => {
      const newPortfolio = prev.filter(item => item.ticker !== ticker);
      if (newPortfolio.length === 0) return [];

      const evenWeight = 100 / newPortfolio.length;
      return newPortfolio.map(item => ({ ...item, weight: Number(evenWeight.toFixed(2)) }));
    });
  };

  const handleUpdateWeight = (ticker, weight) => {
    setPortfolio(prev => prev.map(item =>
      item.ticker === ticker ? { ...item, weight } : item
    ));
  };

  const handleClearPortfolio = () => {
    setPortfolio([]);
  };

  return (
    <main className="min-h-screen bg-black">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <Navigation />

      <Hero />

      <ComparisonEngine onAddToPortfolio={handleAddToPortfolio} />

      <PortfolioBuilder
        portfolio={portfolio}
        onRemove={handleRemoveFromPortfolio}
        onUpdateWeight={handleUpdateWeight}
        onClear={handleClearPortfolio}
      />

      <WealthProjector portfolio={portfolio} />

      <footer className="py-12 border-t border-white/10 text-center text-neutral-500 text-sm relative z-10">
        <p>&copy; {new Date().getFullYear()} PortfolioCompass. Institutional Grade Intelligence.</p>
      </footer>
    </main>
  );
}
