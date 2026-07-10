"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { savePortfolio } from "@/lib/storage";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsDrawer({
  isOpen,
  onClose,
}: SettingsDrawerProps) {
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const handleClearPortfolio = async () => {
    if (
      !confirm(
        "Are you sure you want to clear your entire portfolio? This action cannot be undone.",
      )
    ) {
      return;
    }

    setIsClearing(true);
    setStatus(null);

    try {
      // Client-side clear
      savePortfolio([]);
      await queryClient.setQueryData(["portfolio"], []);

      setStatus({ type: "success", message: "Portfolio cleared successfully" });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Failed to clear portfolio" });
    } finally {
      setIsClearing(false);
    }
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    setStatus(null);

    try {
      // Pull tickers from the local portfolio so we refresh what the user sees
      // without needing CRON_SECRET (that protects the admin bulk deep-sync).
      const portfolio =
        (queryClient.getQueryData(["portfolio"]) as
          | { ticker?: string }[]
          | undefined) || [];
      const tickers = Array.from(
        new Set(
          portfolio
            .map((p) => p.ticker)
            .filter((t): t is string => typeof t === "string" && t.length > 0),
        ),
      );

      const res = await fetch("/api/market/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to refresh market data");
      }

      // Drop client caches so portfolio + market tabs re-fetch live quotes
      await queryClient.invalidateQueries();

      setStatus({
        type: "success",
        message:
          data.message ||
          (tickers.length
            ? `Refreshed ${tickers.length} portfolio ticker${tickers.length === 1 ? "" : "s"}.`
            : "Market cache cleared. Browse a tab to load fresh quotes."),
      });
    } catch (error: unknown) {
      console.error(error);
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to refresh data",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-dune/40 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-neutral-900 border-l border-hairline z-[70] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-ink">Settings</h2>
              <button
                onClick={onClose}
                aria-label="Close settings"
                className="p-2 hover:bg-surface-soft rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <div className="space-y-8">
              {/* Data Management Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-neutral-200 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-emerald-400" />
                  Data Management
                </h3>

                <div className="p-4 rounded-lg bg-neutral-800/50 border border-hairline space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-ink font-medium">
                        Refresh market data
                      </h4>
                      <p className="text-sm text-neutral-400">
                        Pull latest prices for your portfolio and clear cached
                        quotes so market tabs reload fresh
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRefreshData}
                    disabled={isRefreshing}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Refresh Now
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </h3>

                <div className="p-4 rounded-lg bg-red-900/10 border border-red-500/20 space-y-4">
                  <div>
                    <h4 className="text-ink font-medium">Clear Portfolio</h4>
                    <p className="text-sm text-neutral-400">
                      Permanently remove all items from your portfolio
                    </p>
                  </div>
                  <button
                    onClick={handleClearPortfolio}
                    disabled={isClearing}
                    className="w-full py-2 px-4 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Clear Portfolio
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status Message */}
              <AnimatePresence>
                {status && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`p-4 rounded-lg flex items-start gap-3 ${
                      status.type === "success"
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border border-red-500/20 text-red-400"
                    }`}
                  >
                    {status.type === "success" ? (
                      <CheckCircle className="w-5 h-5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                    )}
                    <p className="text-sm font-medium">{status.message}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
