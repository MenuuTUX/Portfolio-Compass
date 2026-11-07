"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, m as motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import QueryProvider from "@/components/QueryProvider";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useAddStock } from "@/hooks/useAddStock";
import { useUpdatePortfolioItem } from "@/hooks/useUpdatePortfolioItem";
import { useRemoveStock } from "@/hooks/useRemoveStock";
import { savePortfolio } from "@/lib/storage";
import { EASE } from "@/components/motion/Reveal";
import { PORTFOLIO_QUERY_KEY } from "@/lib/query-client";
import type { ETF, PortfolioItem } from "@/types";

export type Tab = "TRENDING" | "PORTFOLIO" | "ETFS" | "STOCKS";

const loading = () => <div role="status" aria-label="Loading" className="p-6 text-sm text-muted">Loading...</div>;
const ComparisonEngine = dynamic(() => import("@/components/ComparisonEngine"), { loading });
const PortfolioBuilder = dynamic(() => import("@/components/PortfolioBuilder"), { loading });
const TrendingTab = dynamic(() => import("@/components/TrendingTab"), { loading });
const SettingsDrawer = dynamic(() => import("@/components/SettingsDrawer"));

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onBackToLanding: () => void;
};

function View({ activeTab, onTabChange, onBackToLanding }: Props) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { data: portfolio = [], isLoading } = usePortfolio(activeTab === "PORTFOLIO");
  const addStockMutation = useAddStock();
  const removeStockMutation = useRemoveStock();
  const updatePortfolioItemMutation = useUpdatePortfolioItem();
  const queryClient = useQueryClient();

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

  // One write for the whole plan: per-item mutations would each reload and
  // resave storage and could interleave.
  const handleApplyAllocation = (plan: { ticker: string; weight: number; shares: number }[]) => {
    const byTicker = new Map(plan.map((p) => [p.ticker, p]));
    const next = portfolio.map((item) => {
      const p = byTicker.get(item.ticker);
      return p ? { ...item, weight: p.weight, shares: p.shares } : item;
    });
    savePortfolio(next.map(({ ticker, weight, shares }) => ({ ticker, weight, shares })));
    queryClient.setQueryData(PORTFOLIO_QUERY_KEY, next);
  };

  const handleClearPortfolio = () => {
    savePortfolio([]);
    queryClient.setQueryData(PORTFOLIO_QUERY_KEY, []);
  };

  const handleImportPortfolio = (items: PortfolioItem[]) => {
    savePortfolio(items);
    queryClient.setQueryData(PORTFOLIO_QUERY_KEY, items);
    onTabChange("PORTFOLIO");
  };

  return (
    <>
      <SettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

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
            {activeTab === "TRENDING" && (
              <TrendingTab
                onAddToPortfolio={handleAddToPortfolio}
                portfolio={portfolio}
                onRemoveFromPortfolio={handleRemoveFromPortfolio}
                onImportPortfolio={handleImportPortfolio}
                onNavigate={onTabChange}
              />
            )}
            {activeTab === "PORTFOLIO" && (
              <PortfolioBuilder
                portfolio={portfolio}
                isLoading={isLoading}
                onRemove={handleRemoveFromPortfolio}
                onUpdateWeight={handleUpdateWeight}
                onUpdateShares={handleUpdateShares}
                onClear={handleClearPortfolio}
                onApplyAllocation={handleApplyAllocation}
                onNavigate={onTabChange}
              />
            )}
            {activeTab === "ETFS" && (
              <ComparisonEngine
                onAddToPortfolio={handleAddToPortfolio}
                onRemoveFromPortfolio={handleRemoveFromPortfolio}
                portfolio={portfolio}
                assetType="ETF"
              />
            )}
            {activeTab === "STOCKS" && (
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
        onTabChange={onTabChange}
        onBackToLanding={onBackToLanding}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    </>
  );
}

export default function AppView(props: Props) {
  return (
    <QueryProvider>
      <View {...props} />
    </QueryProvider>
  );
}
