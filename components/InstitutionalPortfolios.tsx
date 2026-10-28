"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Plus,
  Shield,
  TrendingUp,
  Scale,
  X,
  Wallet,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { BatchAddItem } from "@/hooks/useBatchAddPortfolio";
import {
  INSTITUTIONAL_DATA,
  Institution,
} from "@/lib/institutional-portfolios";
import { cn } from "@/lib/utils";
import { COLORS } from "./SectorPieChart";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { EASE } from "./motion/Reveal";

interface InstitutionalPortfoliosProps {
  onBatchAdd: (items: BatchAddItem[]) => Promise<void>;
  isLoading?: boolean;
  /** Panel-friendly list: no card chrome, shorter rows. */
  compact?: boolean;
}

// Maps icon names to existing lucide components (module scope so render
// only selects a component, never creates one)
const PORTFOLIO_ICONS = {
  TrendingUp,
  Scale,
  Shield,
} satisfies Record<string, typeof Wallet>;

const PORTFOLIO_TYPES = ["Growth", "Balanced", "Conservative"] as const;
type PortfolioType = (typeof PORTFOLIO_TYPES)[number];

// Logos drawn in white need a dark tile
const WHITE_LOGOS = new Set(["blackrock"]);

/** Logo on a white tile so dark marks stay legible on the dark UI; initials if it won't load. */
function FirmLogo({
  inst,
  failed,
  onError,
}: {
  inst: Institution;
  failed: boolean;
  onError: (id: string) => void;
}) {
  return (
    <span
      className={cn(
        "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl",
        WHITE_LOGOS.has(inst.id) ? "bg-neutral-900 ring-1 ring-white/15" : "bg-white",
      )}
    >
      {failed || !inst.logo ? (
        <span className="text-sm font-bold text-neutral-700">{inst.name.slice(0, 2).toUpperCase()}</span>
      ) : (
        <Image
          src={inst.logo}
          alt=""
          fill
          sizes="48px"
          className={cn("object-contain object-center", WHITE_LOGOS.has(inst.id) ? "p-1" : "p-2")}
          onError={() => onError(inst.id)}
        />
      )}
    </span>
  );
}

export default function InstitutionalPortfolios({
  onBatchAdd,
  isLoading = false,
  compact = false,
}: InstitutionalPortfoliosProps) {
  const [selectedInstitution, setSelectedInstitution] =
    useState<Institution | null>(null);
  const [added, setAdded] = useState<PortfolioType | null>(null);
  const [loadingType, setLoadingType] = useState<PortfolioType | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const closeInstitutional = useCallback(() => setSelectedInstitution(null), []);
  const dialogRef = useDialogA11y<HTMLDivElement>(Boolean(selectedInstitution), closeInstitutional);

  // Keep the page behind the blur from scrolling
  useEffect(() => {
    if (!selectedInstitution) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selectedInstitution]);

  const handleAdd = async (type: PortfolioType) => {
    if (!selectedInstitution) return;

    const portfolio = selectedInstitution.portfolios[type];
    const items: BatchAddItem[] = portfolio.holdings.map((h) => ({
      ticker: h.ticker,
      weight: h.weight,
      shares: 0,
    }));

    setAddError(null);
    setLoadingType(type);
    try {
      await onBatchAdd(items);
      setAdded(type);
      setTimeout(() => setAdded(null), 2000);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Could not load this portfolio example.");
    } finally {
      setLoadingType(null);
    }
  };

  const handleImageError = (id: string) => {
    setFailedImages((previous) => new Set(previous).add(id));
  };

  return (
    <div className="flex flex-col">
      <h3 className={cn("font-semibold text-ink mb-1 px-1", compact ? "sr-only" : "text-base")}>
        Built-in allocation examples
      </h3>
      <p className={cn("text-xs text-muted leading-relaxed px-1", compact ? "mb-2" : "mb-3")}>
        These saved examples may not match current issuer allocations. Verify
        weights with the issuer before using them.
      </p>

      <ul
        className={cn(
          "divide-y divide-hairline overflow-hidden",
          !compact && "bg-surface-card ring-1 ring-hairline rounded-2xl",
        )}
      >
        {INSTITUTIONAL_DATA.map((inst, index) => {
          const isImageFailed = failedImages.has(inst.id) || !inst.logo;

          return (
            <motion.li
              key={inst.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(index, 14) * 0.03, ease: EASE }}
            >
              <button
                type="button"
                onClick={() => setSelectedInstitution(inst)}
                className={cn("w-full flex items-center gap-3 px-4 text-left rounded-md hover:bg-surface-soft/60 transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-compass", compact ? "px-2 gap-2 h-[42px]" : "py-3 min-h-[56px]")}
              >
                <div className={cn("relative bg-surface-soft overflow-hidden flex items-center justify-center shrink-0", compact ? "w-7 h-7 rounded-full" : "w-10 h-10 rounded-xl")}>
                  {isImageFailed ? (
                    <span className="text-xs font-semibold text-muted">
                      {inst.name.slice(0, 2).toUpperCase()}
                    </span>
                  ) : (
                    <Image
                      src={inst.logo}
                      alt=""
                      fill
                      className="object-contain object-center p-1.5"
                      sizes="40px"
                      onError={() => handleImageError(inst.id)}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("font-bold text-ink truncate", compact ? "text-xs" : "text-sm")}>
                    {inst.name}
                  </div>
                  {!compact && (
                    <div className="text-xs text-muted">
                      Growth, balanced, conservative
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-soft shrink-0" aria-hidden="true" />
              </button>
            </motion.li>
          );
        })}
      </ul>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selectedInstitution && (
              <motion.div
                key="allocation-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                onClick={closeInstitutional}
                className="fixed inset-0 z-50 overflow-y-auto bg-canvas/55 backdrop-blur-2xl backdrop-saturate-150"
              >
                <div
                  ref={dialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="institutional-portfolio-title"
                  onClick={(e) => e.stopPropagation()}
                  className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 pb-10 pt-8 md:px-10 md:pt-12"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        Allocation examples
                      </p>
                      <h2
                        id="institutional-portfolio-title"
                        className="mt-2 text-3xl font-semibold tracking-tight text-ink md:text-5xl"
                      >
                        {selectedInstitution.name}
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                        Built-in examples associated with {selectedInstitution.name}. They may
                        not match current issuer allocations, and this app is not affiliated
                        with or endorsed by the named firm.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeInstitutional}
                      aria-label="Close allocation examples"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-card/70 text-muted ring-1 ring-hairline transition-colors duration-75 hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Every firm, always visible */}
                  <div
                    role="group"
                    aria-label="Choose a firm"
                    className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8"
                  >
                    {INSTITUTIONAL_DATA.map((inst) => {
                      const active = inst.id === selectedInstitution.id;
                      return (
                        <button
                          key={inst.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setSelectedInstitution(inst);
                            setAddError(null);
                          }}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-2xl px-3 py-4 text-center ring-1 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass",
                            active
                              ? "bg-surface-card/90 ring-ink/40"
                              : "bg-surface-card/40 ring-hairline hover:bg-surface-card/70 hover:ring-hairline-strong",
                          )}
                        >
                          <FirmLogo inst={inst} failed={failedImages.has(inst.id)} onError={handleImageError} />
                          <span className={cn("text-xs font-semibold leading-tight", active ? "text-ink" : "text-muted")}>
                            {inst.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {addError && (
                    <p role="alert" className="mt-6 text-sm text-rose-400">
                      {addError}
                    </p>
                  )}

                  {/* All three portfolios side by side */}
                  <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {PORTFOLIO_TYPES.map((type, i) => {
                      const portfolio = selectedInstitution.portfolios[type];
                      const Icon = PORTFOLIO_ICONS[portfolio.iconName] ?? Wallet;
                      const fund = portfolio.name.match(/\(([^)]+)\)/)?.[1];
                      const justAdded = added === type;
                      return (
                        <motion.section
                          key={`${selectedInstitution.id}-${type}`}
                          aria-label={`${type} example`}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.05 + i * 0.06, ease: EASE }}
                          className="flex flex-col rounded-3xl bg-surface-card/70 p-6 ring-1 ring-hairline backdrop-blur-xl"
                        >
                          <div className="flex items-center justify-between">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-soft text-body-strong">
                              <Icon className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-medium text-muted">
                              {portfolio.risk}
                            </span>
                          </div>
                          <h3 className="mt-5 text-2xl font-semibold tracking-tight text-ink">{type}</h3>
                          <p className="mt-1 text-xs text-muted">
                            {fund ? `${fund} · ` : ""}
                            {portfolio.holdings.length} holdings
                          </p>

                          <div
                            className="mt-5 flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
                            role="img"
                            aria-label={`${type} weights`}
                          >
                            {portfolio.holdings.map((h, idx) => (
                              <span
                                key={h.ticker}
                                style={{ width: `${h.weight}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                              />
                            ))}
                          </div>

                          <ul className="mt-5 flex-1 divide-y divide-hairline">
                            {portfolio.holdings.map((h, idx) => (
                              <li key={h.ticker} className="flex items-center gap-3 py-3">
                                <span
                                  aria-hidden="true"
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold text-ink">{h.ticker}</div>
                                  <div className="truncate text-xs text-muted">{h.name}</div>
                                </div>
                                <span className="font-mono text-sm tabular-nums text-ink">{h.weight}%</span>
                              </li>
                            ))}
                          </ul>

                          <button
                            type="button"
                            onClick={() => handleAdd(type)}
                            disabled={isLoading || added !== null}
                            aria-label="Load this allocation example"
                            className={cn(
                              "mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-opacity duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass",
                              justAdded ? "bg-surface-soft text-ink" : "bg-ink text-canvas hover:opacity-90 disabled:opacity-60",
                            )}
                          >
                            {justAdded ? (
                              <>
                                <Check className="h-4 w-4" aria-hidden="true" /> Added to portfolio
                              </>
                            ) : (
                              <>
                                {isLoading && loadingType === type ? (
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-canvas/30 border-t-canvas" />
                                ) : (
                                  <Plus className="h-4 w-4" aria-hidden="true" />
                                )}
                                Load this example
                              </>
                            )}
                          </button>
                        </motion.section>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
