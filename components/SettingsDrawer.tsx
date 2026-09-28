"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Download,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  loadPortfolioBackup,
  mergePortfolioBackup,
  parsePortfolioBackup,
  savePortfolio,
  type LocalPortfolioItem,
} from "@/lib/storage";
import { useDialogA11y } from "@/hooks/useDialogA11y";

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
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<LocalPortfolioItem[] | null>(null);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const dialogRef = useDialogA11y<HTMLDivElement>(isOpen, onClose);

  const handleExportPortfolio = () => {
    setStatus(null);
    try {
      // Backups contain only validated local holdings, never quote or API data.
      const holdings = loadPortfolioBackup();
      const blob = new Blob([JSON.stringify(holdings, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `portfolio-compass-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ type: "success", message: `Exported ${holdings.length} local holding${holdings.length === 1 ? "" : "s"}.` });
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not export the portfolio.",
      });
    }
  };

  const handleBackupSelected = async (file?: File) => {
    setImportPreview(null);
    setStatus(null);
    if (!file) return;

    try {
      let contents: unknown;
      try {
        contents = JSON.parse(await file.text());
      } catch {
        throw new Error("This file is not valid JSON.");
      }
      const holdings = parsePortfolioBackup(contents);
      setImportPreview(holdings);
      setStatus({ type: "success", message: "Backup validated. Review the holdings, then choose Merge or Replace to save." });
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not read this backup file.",
      });
    }
  };

  const handleImportPortfolio = async (replace: boolean) => {
    if (!importPreview) return;
    if (replace && !window.confirm("Replace every holding in this browser with the backup?")) return;

    setIsImporting(true);
    setStatus(null);
    try {
      const holdings = replace
        ? importPreview
        : mergePortfolioBackup(loadPortfolioBackup(), importPreview);
      savePortfolio(holdings);
      await queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      setImportPreview(null);
      setStatus({
        type: "success",
        message: `${replace ? "Replaced" : "Merged"} portfolio with ${holdings.length} holding${holdings.length === 1 ? "" : "s"}.`,
      });
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not restore the portfolio.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearPortfolio = async () => {
    if (
      !confirm(
        "Clear every holding from this local portfolio? This cannot be undone.",
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

      setStatus({ type: "success", message: "Portfolio cleared." });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Could not clear the portfolio." });
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
        queryClient.getQueryData<{ ticker?: string }[]>(["portfolio"]) ?? [];
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
        throw new Error(data.error || "Could not refresh market data.");
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
          error instanceof Error ? error.message : "Could not refresh data.",
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
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-drawer-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="app-panel-safe fixed right-0 top-0 h-[100dvh] w-full overflow-y-auto sm:w-96 bg-neutral-900 border-l border-hairline z-[70] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 id="settings-drawer-title" className="text-2xl font-bold text-ink">Settings</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="p-2 hover:bg-surface-soft rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-neutral-200 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-400" />
                  Portfolio backup
                </h3>
                <div className="p-4 rounded-lg bg-neutral-800/50 border border-hairline space-y-4">
                  <p className="text-sm leading-6 text-body">
                    Save or restore tickers, target weights, and share counts.
                    The backup stays on your device until you choose where to save it.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportPortfolio}
                    className="w-full py-2 px-4 bg-surface-soft hover:bg-surface-soft text-white rounded-button font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export backup
                  </button>
                  <label htmlFor="portfolio-backup-file" className="inline-flex min-h-11 items-center text-sm font-medium text-ink">
                    Choose a backup file
                  </label>
                  <input
                    id="portfolio-backup-file"
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      void handleBackupSelected(file);
                    }}
                    className="block w-full text-sm text-neutral-400 file:mr-3 file:rounded-button file:border-0 file:bg-surface-soft file:px-3 file:py-2 file:text-white"
                  />
                  {importPreview && (
                    <div className="space-y-3 rounded-card border border-hairline bg-black/20 p-3">
                      <div>
                        <h4 className="font-medium text-ink">Preview · {importPreview.length} holding{importPreview.length === 1 ? "" : "s"}</h4>
                        <p className="text-sm leading-5 text-body">Merge updates matching tickers and keeps other holdings. Replace removes all current holdings.</p>
                      </div>
                      {importPreview.length > 0 ? (
                        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-body" aria-label="Backup holdings preview">
                          {importPreview.map((item) => (
                            <li key={item.ticker} className="flex justify-between gap-3">
                              <span>{item.ticker}</span>
                              <span>{item.shares} shares · {item.weight}% target</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-body">This backup contains no holdings.</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => void handleImportPortfolio(false)}
                          disabled={isImporting}
                          className="min-h-11 rounded-button border border-hairline-strong px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                        >
                          Merge import
                        </button>
                        <button
                          onClick={() => void handleImportPortfolio(true)}
                          disabled={isImporting}
                          className="min-h-11 rounded-button bg-accent px-3 text-sm font-medium text-[var(--on-accent)] transition-colors hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                        >
                          Replace portfolio
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Data Management Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-neutral-200 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-emerald-400" />
                  Market Data
                </h3>

                <div className="p-4 rounded-lg bg-neutral-800/50 border border-hairline space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-ink font-medium">
                        Refresh market data
                      </h4>
                      <p className="text-sm text-neutral-400">
                        Clear cached quotes and request current data for your
                        portfolio tickers.
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
                        Refresh data
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Delete Local Data
                </h3>

                <div className="p-4 rounded-lg bg-red-900/10 border border-red-500/20 space-y-4">
                  <div>
                    <h4 className="text-ink font-medium">Clear portfolio</h4>
                    <p className="text-sm leading-6 text-body">
                      Remove all holdings saved in this browser. You will be
                      asked to confirm before they are cleared.
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
                        Clear portfolio
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
                    role={status.type === "error" ? "alert" : "status"}
                    aria-live={status.type === "error" ? "assertive" : "polite"}
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
