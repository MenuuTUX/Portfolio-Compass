"use client";

import { useEffect, useState } from "react";
import { ETF } from "@/types";
import { getJson, syncEtf } from "@/lib/api-client";
import type { FastEtfDetails } from "@/lib/fast-market";
import { startVisibleInterval } from "@/lib/polling";

// Tickers that already ran a background deep-sync this session; avoids
// re-hitting the slow scrape pipeline every time a drawer re-opens
const deepSyncedThisSession = new Set<string>();

// Merge fresh data into an asset without letting empty placeholder fields
// (empty arrays/objects) clobber real values we already have.
export function mergeAssetData(base: ETF, incoming: Partial<ETF>): ETF {
  const usableEntries = Object.entries(incoming).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (
      Object(value) === value &&
      !Array.isArray(value) &&
      Object.keys(Object(value)).length === 0
    ) {
      return false;
    }
    return true;
  });
  const merged: ETF = { ...base, ...Object.fromEntries(usableEntries) };
  if (
    incoming.allocation &&
    !incoming.allocation.equities &&
    !incoming.allocation.bonds &&
    !incoming.allocation.cash &&
    base.allocation
  ) {
    merged.allocation = base.allocation;
  }
  // Keep the longer history so the comparison modal has data to work with
  if (
    incoming.history &&
    base.history &&
    base.history.length > incoming.history.length
  ) {
    merged.history = base.history;
  }
  return merged;
}

/**
 * Returns the asset with fresh data layered on: an instant quote snapshot
 * first, then deep data (sectors, holdings, fundamentals) in the background.
 * Pass null to stay idle.
 */
export function useAssetDetails(etf: ETF | null): ETF | null {
  const [freshEtf, setFreshEtf] = useState<ETF | null>(null);
  const [prevEtf, setPrevEtf] = useState<ETF | null>(etf);

  if (etf !== prevEtf) {
    setPrevEtf(etf);
    setFreshEtf(null);
  }

  useEffect(() => {
    if (!etf) return;
    let cancelled = false;

    const pullQuote = () =>
      getJson<ETF[]>(`/api/market/snapshot?tickers=${etf.ticker}&history=false`, [])
        .then((data) => {
          if (cancelled || !Array.isArray(data) || data.length === 0) return;
          const snap = data.find(
            (item) => item.ticker === etf.ticker.toUpperCase(),
          );
          if (snap) setFreshEtf((prev) => mergeAssetData(prev || etf, snap));
        })
        .catch(() => {});
    void pullQuote();
    const stopQuoteTimer = startVisibleInterval(() => void pullQuote());

    // Fund technicals: Yahoo + gap-fill (fee, holdings, credit quality)
    getJson<FastEtfDetails | null>(`/api/market/etf-details?ticker=${encodeURIComponent(etf.ticker)}`, null)
      .then((fund) => {
        if (cancelled || !fund) return;
        setFreshEtf((prev) => {
          const base = prev || etf;
          const patch: Partial<ETF> = {
            holdingsCount: fund.holdingsCount,
            beta: fund.beta,
            fundClass: fund.fundClass,
            category: fund.category,
            family: fund.family,
            bondMaturity: fund.bondMaturity,
            bondDuration: fund.bondDuration,
            creditQuality: fund.creditQuality,
            metrics: {
              ...base.metrics,
              mer: fund.expenseRatio ?? base.metrics?.mer,
              merSource: fund.expenseRatioSource ?? base.metrics?.merSource,
              merRetrievedAt: fund.expenseRatioRetrievedAt ?? base.metrics?.merRetrievedAt,
              merSourceField: fund.expenseRatioField ?? base.metrics?.merSourceField,
              merInputUnit: fund.expenseRatioInputUnit ?? base.metrics?.merInputUnit,
              merNormalization: fund.expenseRatioNormalization ?? base.metrics?.merNormalization,
              merMeasurementDate: fund.expenseRatioMeasurementDate ?? base.metrics?.merMeasurementDate,
            },
          };
          if (fund.volume) patch.volume = fund.volume;
          if (fund.sectors && Object.keys(fund.sectors).length > 0) {
            patch.sectors = fund.sectors;
          }
          if (fund.holdings?.length) {
            patch.holdings = fund.holdings.map((h) => ({
              ticker: h.ticker,
              name: h.name,
              weight: h.weight,
            }));
          }
          if (fund.allocation) {
            patch.allocation = {
              equities: fund.allocation.equities ?? 0,
              bonds: fund.allocation.bonds ?? 0,
              cash: fund.allocation.cash ?? 0,
            };
          }
          return mergeAssetData(base, patch);
        });
      })
      .catch(() => {});

    // Whatever the DB already knows (sectors, holdings from a past sync)
    getJson<ETF[]>(`/api/etfs/search?query=${etf.ticker}&includeHoldings=true`, [])
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const match = data.find((item) => item.ticker === etf.ticker);
        if (match) setFreshEtf((prev) => mergeAssetData(prev || etf, match));
      })
      .catch(() => {});

    // Background deep sync; merge when it lands
    if (!deepSyncedThisSession.has(etf.ticker)) {
      deepSyncedThisSession.add(etf.ticker);
      syncEtf(etf.ticker)
        .then((res) => (res.ok ? res.json() : null))
        .then((deep) => {
          if (cancelled || !deep?.ticker) return;
          setFreshEtf((prev) => mergeAssetData(prev || etf, deep));
        })
        .catch(() => {
          deepSyncedThisSession.delete(etf.ticker);
        });
    }

    return () => {
      cancelled = true;
      stopQuoteTimer();
    };
  }, [etf]);

  return freshEtf || etf;
}
