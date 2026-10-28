"use client";

import { useEffect, useMemo, useState } from "react";

export const TIME_RANGES = ["1D", "1W", "1M", "1Y", "5Y", "MAX"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export type FastPoint = { date: string; price: number };

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export interface ChartPoint {
  date: string;
  /** Price, or percent change from the first point when comparing. */
  price: number;
  originalPrice?: number;
  spyPrice?: number | null;
  originalSpyPrice?: number | null;
}

export interface AssetChartState {
  ticker: string | null;
  range: TimeRange;
  setRange: (range: TimeRange) => void;
  compare: boolean;
  setCompare: (value: boolean) => void;
  /** OHLC bars; fetched only while candles are wanted and not comparing. */
  candles: Candle[];
  wantCandles: boolean;
  setWantCandles: (value: boolean) => void;
  /** Raw series for the selected ticker. */
  series: FastPoint[];
  /** Series ready to plot (percent-normalised when comparing with SPY). */
  data: ChartPoint[];
  loading: boolean;
  retry: () => void;
  percentageChange: number;
  absoluteChange: number | null;
  isPositive: boolean;
}

/**
 * Fetches chart data from the fast market endpoint, one round trip per
 * (ticker, range), and derives the plotted series and range change.
 * Pass a null ticker to stay idle.
 */
export function useAssetChart(
  ticker: string | null,
  fallbackChangePercent = 0,
): AssetChartState {
  const [range, setRange] = useState<TimeRange>("1M");
  const [compare, setCompare] = useState(false);
  const [wantCandles, setWantCandles] = useState(false);
  const [candleState, setCandleState] = useState<{ key: string; bars: Candle[] }>({
    key: "",
    bars: [],
  });
  const [nonce, setNonce] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const [seriesState, setSeriesState] = useState<{
    main: FastPoint[];
    spy: FastPoint[];
  }>({ main: [], spy: [] });
  const [prevTicker, setPrevTicker] = useState(ticker);

  // Reset when the ticker changes (adjust-during-render, no setState-in-effect)
  if (ticker !== prevTicker) {
    setPrevTicker(ticker);
    setSeriesState({ main: [], spy: [] });
  }

  const tickerKey = ticker?.toUpperCase() ?? "";
  const chartKey = ticker ? `${tickerKey}|${range}|${compare}|${nonce}` : "";
  const loading = !!ticker && loadedKey !== chartKey;

  useEffect(() => {
    if (!tickerKey) return;
    let cancelled = false;
    const controller = new AbortController();
    const tickers = compare ? `${tickerKey},SPY` : tickerKey;
    const key = `${tickerKey}|${range}|${compare}|${nonce}`;

    fetch(
      `/api/market/chart?tickers=${encodeURIComponent(tickers)}&range=${range}`,
      { signal: controller.signal },
    )
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(res.statusText)),
      )
      .then((data) => {
        if (cancelled) return;
        setSeriesState({
          main: data.series?.[tickerKey] || [],
          spy: data.series?.SPY || [],
        });
      })
      .catch((err) => {
        if (!cancelled && err?.name !== "AbortError") {
          console.error("Chart fetch failed:", err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(key);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tickerKey, range, compare, nonce]);

  const candleKey = ticker && wantCandles ? `${tickerKey}|${range}|${nonce}` : "";

  useEffect(() => {
    if (!candleKey) return;
    const controller = new AbortController();
    fetch(
      `/api/market/chart?tickers=${encodeURIComponent(tickerKey)}&range=${range}&ohlc=1`,
      { signal: controller.signal },
    )
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(res.statusText)),
      )
      .then((data) => setCandleState({ key: candleKey, bars: data.candles || [] }))
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Candle fetch failed:", err);
          setCandleState({ key: candleKey, bars: [] });
        }
      });
    return () => controller.abort();
  }, [candleKey, tickerKey, range]);

  const candles = candleState.key === candleKey ? candleState.bars : [];

  const series = seriesState.main;

  const data = useMemo<ChartPoint[]>(() => {
    if (series.length === 0) return [];
    const spyHistory = seriesState.spy;

    if (compare && spyHistory.length > 0) {
      // Both series share range/interval, so align by nearest timestamp
      const tolerance =
        range === "1D" || range === "1W"
          ? 30 * 60 * 1000
          : 3 * 24 * 60 * 60 * 1000;
      const spyTimes = spyHistory.map((p) => new Date(p.date).getTime());
      const spyPriceAt = (target: number) => {
        let best = 0;
        let minDiff = Math.abs(spyTimes[0] - target);
        for (let i = 1; i < spyTimes.length; i++) {
          const diff = Math.abs(spyTimes[i] - target);
          if (diff < minDiff) {
            minDiff = diff;
            best = i;
          }
        }
        return minDiff <= tolerance ? spyHistory[best].price : null;
      };

      const start = series[0].price;
      const spyStart =
        spyPriceAt(new Date(series[0].date).getTime()) || spyHistory[0].price;
      let lastSpy = spyStart;

      return series.map((h) => {
        let spyRaw = spyPriceAt(new Date(h.date).getTime());
        if (spyRaw !== null) lastSpy = spyRaw;
        else spyRaw = lastSpy;
        return {
          date: h.date,
          price: ((h.price - start) / start) * 100,
          originalPrice: h.price,
          spyPrice: spyRaw ? ((spyRaw - spyStart) / spyStart) * 100 : null,
          originalSpyPrice: spyRaw,
        };
      });
    }

    return series;
  }, [series, seriesState.spy, compare, range]);

  const { percentageChange, absoluteChange, isPositive } = useMemo(() => {
    if (series.length < 2) {
      // No usable history: fall back to the asset's daily change
      return {
        percentageChange: fallbackChangePercent,
        absoluteChange: null,
        isPositive: fallbackChangePercent >= 0,
      };
    }
    const start = series[0].price;
    const end = series[series.length - 1].price;
    const pct = ((end - start) / start) * 100;
    return {
      percentageChange: pct,
      absoluteChange: end - start,
      isPositive: pct >= 0,
    };
  }, [series, fallbackChangePercent]);

  return {
    ticker,
    range,
    setRange,
    compare,
    setCompare,
    candles,
    wantCandles,
    setWantCandles,
    series,
    data,
    loading,
    retry: () => setNonce((n) => n + 1),
    percentageChange,
    absoluteChange,
    isPositive,
  };
}
