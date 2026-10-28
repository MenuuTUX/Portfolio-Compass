"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
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
  const reduceMotion = useReducedMotion();

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

  const rowBtn =
    "ws-pill w-full sm:w-auto shrink-0 disabled:opacity-50";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[60]"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-drawer-title"
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="app-panel-safe fixed right-0 top-0 h-[100dvh] w-full overflow-y-auto sm:w-[420px] bg-surface-card ring-1 ring-hairline z-[70] px-6 sm:rounded-l-2xl shadow-[-24px_0_64px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="settings-drawer-title" className="text-xl font-semibold text-ink">Settings</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="ws-icon-btn -mr-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <RevealGroup className="space-y-8" stagger={0.06} delay={0.1} onMount>
              <RevealItem y={12}>
              <section aria-labelledby="settings-backup">
                <h3 id="settings-backup" className="ws-section-title mb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-muted" aria-hidden />
                  Portfolio backup
                </h3>
                <div className="rounded-2xl ring-1 ring-hairline divide-y divide-hairline overflow-hidden">
                  <div className="p-4 space-y-3">
                    <p className="text-sm leading-6 text-body">
                      Save or restore tickers, target weights, and share counts.
                      The backup stays on your device until you choose where to save it.
                    </p>
                    <button type="button" onClick={handleExportPortfolio} className={rowBtn}>
                      <Download className="w-4 h-4" aria-hidden />
                      Export backup
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    <label htmlFor="portfolio-backup-file" className="block text-sm font-medium text-ink">
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
                      className="block w-full text-sm text-body file:mr-3 file:h-10 file:cursor-pointer file:rounded-full file:border-0 file:bg-hairline-strong file:px-4 file:text-sm file:font-medium file:text-ink"
                    />
                  </div>
                  {importPreview && (
                    <div className="p-4 space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-ink">Preview · {importPreview.length} holding{importPreview.length === 1 ? "" : "s"}</h4>
                        <p className="text-sm leading-5 text-body">Merge updates matching tickers and keeps other holdings. Replace removes all current holdings.</p>
                      </div>
                      {importPreview.length > 0 ? (
                        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-body" aria-label="Backup holdings preview">
                          {importPreview.map((item) => (
                            <li key={item.ticker} className="flex justify-between gap-3">
                              <span className="text-ink">{item.ticker}</span>
                              <span>{item.shares} shares · {item.weight}% target</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-body">This backup contains no holdings.</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void handleImportPortfolio(false)}
                          disabled={isImporting}
                          className="ws-pill disabled:opacity-50"
                        >
                          Merge import
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleImportPortfolio(true)}
                          disabled={isImporting}
                          className="ws-pill ws-pill-primary disabled:opacity-50"
                        >
                          Replace portfolio
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
              </RevealItem>

              <RevealItem y={12}>

              <section aria-labelledby="settings-market">
                <h3 id="settings-market" className="ws-section-title mb-3 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-muted" aria-hidden />
                  Market data
                </h3>
                <div className="rounded-2xl ring-1 ring-hairline p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-ink">Refresh market data</h4>
                    <p className="text-sm text-body">
                      Clear cached quotes and request current data for your portfolio tickers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshData}
                    disabled={isRefreshing}
                    className={rowBtn}
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" aria-hidden />
                        Refresh data
                      </>
                    )}
                  </button>
                </div>
              </section>
              </RevealItem>

              <RevealItem y={12}>

              <section aria-labelledby="settings-delete">
                <h3 id="settings-delete" className="ws-section-title mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" aria-hidden />
                  Delete local data
                </h3>
                <div className="rounded-2xl ring-1 ring-hairline p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-ink">Clear portfolio</h4>
                    <p className="text-sm leading-6 text-body">
                      Remove all holdings saved in this browser. You will be
                      asked to confirm before they are cleared.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPortfolio}
                    disabled={isClearing}
                    className="ws-pill w-full sm:w-auto text-red-400 disabled:opacity-50"
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        Clearing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" aria-hidden />
                        Clear portfolio
                      </>
                    )}
                  </button>
                </div>
              </section>
              </RevealItem>

              <AnimatePresence>
                {status && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
                    role={status.type === "error" ? "alert" : "status"}
                    aria-live={status.type === "error" ? "assertive" : "polite"}
                    className="rounded-2xl ring-1 ring-hairline p-4 flex items-start gap-3"
                  >
                    {status.type === "success" ? (
                      <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" aria-hidden />
                    ) : (
                      <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" aria-hidden />
                    )}
                    <p className="text-sm font-medium text-ink">
                      <span className={status.type === "success" ? "text-emerald-400" : "text-red-400"}>
                        {status.type === "success" ? "Done. " : "Error. "}
                      </span>
                      {status.message}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </RevealGroup>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
