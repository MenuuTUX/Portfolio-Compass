"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import {
  Activity,
  BarChart3,
  Home,
  PieChart,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";

type AppTab = "TRENDING" | "PORTFOLIO" | "ETFS" | "STOCKS";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: AppTab) => void;
  onOpenSettings: () => void;
  onBackToLanding: () => void;
}

const actions = [
  {
    id: "trending",
    label: "Market overview",
    description: "See daily movers and example allocations",
    icon: TrendingUp,
    run: (props: CommandPaletteProps) => props.onNavigate("TRENDING"),
  },
  {
    id: "portfolio",
    label: "Open portfolio",
    description: "Review holdings, weights, and scenarios",
    icon: PieChart,
    run: (props: CommandPaletteProps) => props.onNavigate("PORTFOLIO"),
  },
  {
    id: "etfs",
    label: "Explore funds",
    description: "Search and compare fund details",
    icon: Activity,
    run: (props: CommandPaletteProps) => props.onNavigate("ETFS"),
  },
  {
    id: "stocks",
    label: "Explore stocks",
    description: "Compare individual securities",
    icon: BarChart3,
    run: (props: CommandPaletteProps) => props.onNavigate("STOCKS"),
  },
  {
    id: "settings",
    label: "Open settings",
    description: "Back up holdings and refresh quotes",
    icon: Settings,
    run: (props: CommandPaletteProps) => props.onOpenSettings(),
  },
  {
    id: "landing",
    label: "Back to landing",
    description: "Return to the introduction",
    icon: Home,
    run: (props: CommandPaletteProps) => props.onBackToLanding(),
  },
];

export default function CommandPalette(props: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogA11y<HTMLDivElement>(props.isOpen, props.onClose);
  const reduceMotion = useReducedMotion();

  const filteredActions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return actions;

    return actions.filter((action) =>
      `${action.label} ${action.description}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  useEffect(() => {
    if (!props.isOpen) return;
    const frame = requestAnimationFrame(() => {
      setQuery("");
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [props.isOpen]);

  const runAction = (action: (typeof actions)[number]) => {
    props.onClose();
    action.run(props);
  };

  return (
    <AnimatePresence>
      {props.isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Close command menu"
            className="fixed inset-0 z-[80] cursor-default bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={props.onClose}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            className="fixed left-1/2 top-[15vh] z-[90] w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-2xl bg-surface-card ring-1 ring-hairline shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
            initial={{ opacity: 0, y: reduceMotion ? 0 : -8, scale: reduceMotion ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
              <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") props.onClose();
                  if (event.key === "Enter" && filteredActions[0]) {
                    event.preventDefault();
                    runAction(filteredActions[0]);
                  }
                }}
                placeholder="What do you want to open?"
                className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
                aria-label="Search commands"
              />
              <kbd className="hidden rounded-md bg-surface-soft px-1.5 py-0.5 text-xs text-muted sm:inline">
                ESC
              </kbd>
            </div>

            <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
              {filteredActions.length > 0 ? (
                <RevealGroup stagger={0.03} delay={0.06} onMount>
                {filteredActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <RevealItem key={action.id} y={8} duration={0.4}>
                    <button
                      type="button"
                      onClick={() => runAction(action)}
                      className="group flex w-full items-center gap-3 min-h-11 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-soft focus-visible:bg-surface-soft"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-muted transition-colors group-hover:text-ink">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">
                          {action.label}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {action.description}
                        </span>
                      </span>
                    </button>
                    </RevealItem>
                  );
                })}
                </RevealGroup>
              ) : (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  No commands match. Try portfolio, funds, stocks, or settings.
                </p>
              )}
            </div>

            <div className="border-t border-hairline px-4 py-2 text-xs text-muted">
              Press Enter to open the first result
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
