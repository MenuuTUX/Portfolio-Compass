"use client";

import {
  Activity,
  PieChart,
  TrendingUp,
  BarChart3,
  Settings,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Image from "next/image";

type Tab = "TRENDING" | "PORTFOLIO" | "ETFS" | "STOCKS";

interface NavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onBackToLanding?: () => void;
  onOpenSettings?: () => void;
}

export default function Navigation({
  activeTab,
  onTabChange,
  onBackToLanding,
  onOpenSettings,
}: NavigationProps) {
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "TRENDING", label: "Trending", icon: TrendingUp },
    { id: "ETFS", label: "ETFs", icon: Activity },
    { id: "STOCKS", label: "Stocks", icon: BarChart3 },
    { id: "PORTFOLIO", label: "Portfolio", icon: PieChart },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
            onClick={onBackToLanding}
          >
            <div className="w-12 h-12 relative flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="PortfolioCompass Logo"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <span className="text-white font-bold tracking-tight text-lg hidden md:block">
              Portfolio<span className="text-amber-400">Compass</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-1 sm:space-x-4 overflow-x-auto no-scrollbar py-2 mask-linear-fade">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const isTrending = tab.id === "TRENDING";

                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      "relative px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 overflow-hidden group shrink-0",
                      isActive
                        ? "text-white"
                        : "text-neutral-400 hover:text-white hover:bg-white/5",
                      isTrending &&
                        !isActive &&
                        "text-amber-300 hover:text-amber-200",
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-white/10 rounded-md"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                        }}
                      />
                    )}

                    {/* Shiny effect for Trending tab */}
                    {isTrending && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    )}

                    <tab.icon
                      className={cn(
                        "w-5 h-5 sm:w-4 sm:h-4 relative z-10",
                        isActive && "text-amber-400",
                        isTrending && !isActive && "text-amber-400",
                      )}
                    />
                    <span
                      className={cn(
                        "relative z-10 hidden sm:inline",
                        isTrending && "font-bold tracking-wide",
                      )}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
