'use client';

import { Activity, PieChart, TrendingUp, Briefcase, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type Tab = 'PORTFOLIO' | 'ETFS' | 'STOCKS' | 'GROWTH';

interface NavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'PORTFOLIO', label: 'Portfolio', icon: PieChart },
    { id: 'ETFS', label: 'ETFs', icon: Activity },
    { id: 'STOCKS', label: 'Stocks', icon: BarChart3 },
    { id: 'GROWTH', label: 'Growth', icon: TrendingUp },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <Briefcase className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-white font-bold tracking-tight text-lg hidden sm:block">
              Portfolio<span className="text-emerald-400">Compass</span>
            </span>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-4">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "relative px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                    isActive ? "text-white" : "text-neutral-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white/10 rounded-md"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <tab.icon className={cn("w-4 h-4 relative z-10", isActive && "text-emerald-400")} />
                  <span className="relative z-10 hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
