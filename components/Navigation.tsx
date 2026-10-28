"use client";

import {
  Activity,
  ArrowLeft,
  PieChart,
  TrendingUp,
  BarChart3,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion/Reveal";

type Tab = "TRENDING" | "PORTFOLIO" | "ETFS" | "STOCKS";

interface NavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onBackToLanding?: () => void;
  onOpenSettings?: () => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "TRENDING", label: "Markets", icon: TrendingUp },
  { id: "ETFS", label: "ETFs", icon: Activity },
  { id: "STOCKS", label: "Stocks", icon: BarChart3 },
  { id: "PORTFOLIO", label: "Portfolio", icon: PieChart },
];

/**
 * Advanced-workspace status bar. Desktop: thin footer row under the panels.
 * Below lg: fixed 64px bottom tab bar (the page adds pb-16 to the main region).
 */
export default function Navigation({
  activeTab,
  onTabChange,
  onBackToLanding,
  onOpenSettings,
}: NavigationProps) {
  return (
    <>
      <motion.nav
        aria-label="Primary"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12, ease: EASE }}
        className="hidden lg:flex h-8 shrink-0 items-center justify-between gap-4 px-1 text-xs"
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToLanding}
            className={cn(
              "group flex h-7 items-center gap-1.5 rounded-md px-2 text-muted transition-colors duration-[120ms] hover:text-ink",
              focusRing,
            )}
          >
            <ArrowLeft
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5"
              aria-hidden="true"
            />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-0.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative h-7 rounded-md px-3 transition-colors duration-[120ms]",
                    isActive ? "text-ink" : "text-muted hover:text-ink",
                    focusRing,
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="status-bar-tab-pill"
                      className="absolute inset-0 rounded-md bg-surface-soft"
                      transition={{ duration: 0.24, ease: EASE }}
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted">Educational data, not advice</span>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Settings"
              title="Settings"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-[120ms] hover:bg-white/5 hover:text-ink",
                focusRing,
              )}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </motion.nav>

      <nav
        aria-label="Primary mobile"
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-16 flex flex-row items-center justify-around px-2 bg-canvas border-t border-hairline"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg transition-colors duration-[120ms]",
                isActive
                  ? "bg-surface-soft text-ink"
                  : "text-muted hover:bg-white/5 hover:text-ink",
                focusRing,
              )}
            >
              <tab.icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs">{tab.label}</span>
            </button>
          );
        })}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className={cn(
              "flex flex-1 min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg text-muted transition-colors duration-[120ms] hover:bg-white/5 hover:text-ink",
              focusRing,
            )}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs">Settings</span>
          </button>
        )}
      </nav>
    </>
  );
}
