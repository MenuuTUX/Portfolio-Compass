"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, X } from "lucide-react";
import { DEFAULT_HEATMAP_GROUP, HEATMAP_GROUPS, type HeatmapGroupId } from "@/config/sp500-heatmap";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { EASE } from "./motion/Reveal";
import { squarify } from "@/lib/treemap";
import { cn } from "@/lib/utils";
import type { HeatmapPayload, HeatmapStock } from "@/app/api/market/heatmap/route";

// Layout runs in CSS px against the measured container
const DEFAULT_ASPECT = 170 / 100;
const SECTOR_PAD = 3;
const SECTOR_LABEL_H = 16;
const CLAMP_PCT = 3;
// Smallest logo worth drawing, in CSS px; smaller tiles are folded into a "+N" group
const MIN_LOGO_PX = 18;
const FALLBACK_WIDTH = 700;
const FALLBACK_HEIGHT = FALLBACK_WIDTH / DEFAULT_ASPECT;

type Cell =
  | { kind: "stock"; key: string; stock: HeatmapStock }
  | { kind: "group"; key: string; sector: string; stocks: HeatmapStock[]; changePercent: number };

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toFixed(2)}%`;

/** Neutral grey at 0%, saturating to red/green at ±3%. */
function tileColor(pct: number) {
  const t = Math.min(1, Math.abs(pct) / CLAMP_PCT);
  const from = [42, 42, 42];
  const to = pct >= 0 ? [47, 158, 87] : [199, 68, 55];
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

/** True when the visible pixels of a loaded logo are almost all near-black (lost on a dark tile). */
function isMostlyDark(img: HTMLImageElement) {
  try {
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let visible = 0;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      visible++;
      if (data[i] < 70 && data[i + 1] < 70 && data[i + 2] < 70) dark++;
    }
    return visible > 0 && dark / visible > 0.8;
  } catch {
    return false;
  }
}

/** Logo straight on the tile colour; all-black marks flip to white so they stay visible. */
function LogoTile({ ticker, width }: { ticker: string; width: string }) {
  const [flip, setFlip] = useState(false);
  return (
    <span className="block shrink-0" style={{ width, aspectRatio: "1 / 1" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- same-origin logo route, sized per tile */}
      <img
        src={`/api/logo/${encodeURIComponent(ticker)}`}
        alt=""
        loading="lazy"
        draggable={false}
        onLoad={(e) => setFlip(isMostlyDark(e.currentTarget))}
        className={cn("h-full w-full object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]", flip && "brightness-0 invert")}
      />
    </span>
  );
}

interface SpHeatmapProps {
  onSelectTicker?: (ticker: string) => void;
  className?: string;
  /** Stretch to the parent's height instead of keeping a fixed aspect ratio. */
  fill?: boolean;
}

export default function SpHeatmap({ onSelectTicker, className, fill = false }: SpHeatmapProps) {
  const [group, setGroup] = useState<HeatmapGroupId>(DEFAULT_HEATMAP_GROUP);
  const [payload, setPayload] = useState<HeatmapPayload | null>(null);
  const [failedGroup, setFailedGroup] = useState<HeatmapGroupId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // A payload for another group counts as "still loading"
  const data = payload?.group === group ? payload : null;
  const failed = failedGroup === group;
  const current = HEATMAP_GROUPS.find((g) => g.id === group) ?? HEATMAP_GROUPS[0];
  const [box, setBox] = useState({ w: FALLBACK_WIDTH, h: FALLBACK_HEIGHT });
  const W = box.w;
  const H = box.h;
  const [openGroup, setOpenGroup] = useState<Extract<Cell, { kind: "group" }> | null>(null);
  const closeGroup = useCallback(() => setOpenGroup(null), []);
  const dialogRef = useDialogA11y<HTMLDivElement>(Boolean(openGroup), closeGroup);

  const boxRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const measure = () =>
      setBox({ w: el.clientWidth || FALLBACK_WIDTH, h: el.clientHeight || FALLBACK_HEIGHT });
    new ResizeObserver(measure).observe(el);
    measure();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/market/heatmap?group=${group}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((json: HeatmapPayload) => setPayload(json))
      .catch((err) => {
        if (err?.name !== "AbortError") setFailedGroup(group);
      });
    // Re-pull quietly while the tab is in view; the server caches for 30s
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/market/heatmap?group=${group}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((json: HeatmapPayload | null) => json && setPayload(json))
        .catch(() => {});
    }, 60_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [group]);

  // Close the menu on Escape or an outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-heatmap-menu]")) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [menuOpen]);

  const layout = useMemo(() => {
    if (!data) return [];
    const sectors = squarify(
      data.sectors.map((s) => ({
        item: s,
        value: s.stocks.reduce((sum, st) => sum + st.marketCap, 0),
      })),
      { x: 0, y: 0, w: W, h: H },
    );
    return sectors.map((sector) => {
      const labelH = sector.h > 60 && sector.w > 90 ? SECTOR_LABEL_H : 0;
      const inner = {
        x: sector.x + SECTOR_PAD,
        y: sector.y + SECTOR_PAD + labelH,
        w: sector.w - SECTOR_PAD * 2,
        h: sector.h - SECTOR_PAD * 2 - labelH,
      };
      // A logo needs this many layout units to be legible at the current width
      const minUnits = MIN_LOGO_PX;
      const fits = (w: number, h: number) => Math.min(w * 0.62, h * 0.66) >= minUnits;
      const cells: Cell[] = sector.item.stocks.map((st) => ({ kind: "stock", key: st.ticker, stock: st }));
      const lay = (list: Cell[]) =>
        squarify(
          list.map((c) => ({
            item: c,
            value: c.kind === "stock" ? c.stock.marketCap : c.stocks.reduce((n, st) => n + st.marketCap, 0),
          })),
          inner,
        );

      let tiles = lay(cells);
      const small = tiles.filter((t) => t.item.kind === "stock" && !fits(t.w, t.h));
      if (small.length >= 2) {
        const members = small.map((t) => (t.item as Extract<Cell, { kind: "stock" }>).stock);
        const cap = members.reduce((n, m) => n + m.marketCap, 0);
        const group: Cell = {
          kind: "group",
          key: `${sector.item.name}-group`,
          sector: sector.item.name,
          stocks: [...members].sort((a, b) => b.marketCap - a.marketCap),
          changePercent: members.reduce((n, m) => n + m.changePercent * m.marketCap, 0) / cap,
        };
        const keep = tiles.filter((t) => !small.includes(t)).map((t) => t.item);
        tiles = lay([...keep, group]);
      }
      return { sector, labelH, tiles };
    });
  }, [data, W, H]);

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  const spy = data?.benchmark;
  const up = (spy?.changePercent ?? 0) >= 0;

  return (
    <div className={cn(fill && "flex h-full min-h-0 flex-col", className)}>
      <div className="relative" data-heatmap-menu>
        <h1>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="group inline-flex items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass"
        >
          <span className="text-[32px] font-bold leading-[38px] text-ink">{current.label} today</span>
          <ChevronDown
            className={cn("mt-1 h-6 w-6 text-muted transition-transform duration-150 group-hover:text-ink", menuOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        </h1>
        {menuOpen && (
          <ul
            role="listbox"
            aria-label="Choose a group"
            className="absolute left-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-2xl bg-surface-card/95 p-1.5 ring-1 ring-hairline-strong backdrop-blur-xl"
          >
            {HEATMAP_GROUPS.map((g) => (
              <li key={g.id} role="option" aria-selected={g.id === group}>
                <button
                  type="button"
                  onClick={() => {
                    setGroup(g.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{g.label}</span>
                    <span className="block text-xs text-muted">{g.blurb}</span>
                  </span>
                  {g.id === group && <Check className="h-4 w-4 text-ink" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p
        className={cn(
          "mt-1 text-sm font-medium tabular-nums",
          spy ? (up ? "text-compass" : "text-rose-400") : "text-muted",
        )}
      >
        {spy
          ? `${spy.ticker ?? "Group average"} ${signed(spy.changePercent)} today`
          : failed
            ? "Heatmap unavailable."
            : `Loading ${current.label} heatmap...`}
      </p>

      <div
        ref={boxRef}
        className={cn("relative mt-4 w-full overflow-hidden rounded-xl bg-surface-soft/40", fill && "min-h-0 flex-1")}
        style={fill ? undefined : { aspectRatio: DEFAULT_ASPECT }}
        role="group"
        aria-label={`${current.label} heatmap: members by sector, sized by market cap, coloured by today's change`}
      >
        {layout.map(({ sector, labelH, tiles }) => (
          <div key={sector.item.name}>
            {labelH > 0 && (
              <span
                className="pointer-events-none absolute truncate text-[10px] font-semibold uppercase tracking-wide text-muted"
                style={{
                  left: pct(sector.x + SECTOR_PAD + 2, W),
                  top: pct(sector.y + SECTOR_PAD, H),
                  width: pct(sector.w - SECTOR_PAD * 2, W),
                }}
              >
                {sector.item.name}
              </span>
            )}
            {tiles.map(({ item, x, y, w, h }) => {
              const isGroup = item.kind === "group";
              const change = isGroup ? item.changePercent : item.stock.changePercent;
              // Logo edge in layout units: fits the tile, leaves room for the % line when shown
              const showChange = w > 52 && h > 62;
              const logo = Math.min(w * 0.62, showChange ? h * 0.5 : h * 0.66, 64);
              // Text scales with the tile's shorter side, in CSS px
              const side = Math.min(w, h);
              const pctFont = Math.round(Math.max(9, Math.min(22, side * 0.1)));
              const countFont = Math.round(Math.max(11, Math.min(28, side * 0.14)));
              const label = isGroup
                ? `${item.stocks.length} smaller ${item.sector} stocks, ${signed(change)}`
                : `${item.stock.ticker} ${signed(change)}`;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => (isGroup ? setOpenGroup(item) : onSelectTicker?.(item.stock.ticker))}
                  title={isGroup ? label : `${item.stock.ticker} · ${item.stock.name} · ${signed(change)}`}
                  aria-label={label}
                  aria-haspopup={isGroup ? "dialog" : undefined}
                  className="absolute flex flex-col items-center justify-center overflow-hidden text-white outline-offset-[-2px] transition-[filter] duration-75 hover:brightness-125 focus-visible:outline-2 focus-visible:outline-white"
                  style={{
                    left: pct(x, W),
                    top: pct(y, H),
                    width: pct(w, W),
                    height: pct(h, H),
                    backgroundColor: tileColor(change),
                    boxShadow: "0 0 0 0.5px var(--canvas, #0d0d0d)",
                  }}
                >
                  {isGroup ? (
                    <span className="font-semibold leading-none" style={{ fontSize: countFont }}>
                      +{item.stocks.length}
                    </span>
                  ) : (
                    <LogoTile ticker={item.stock.ticker} width={`${(logo / w) * 100}%`} />
                  )}
                  {showChange && (
                    <span
                      className="mt-1 font-medium leading-none tabular-nums text-white/90"
                      style={{ fontSize: pctFont }}
                    >
                      {signed(change)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
        {!data && !failed && <div className="absolute inset-0 animate-pulse" aria-hidden="true" />}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{data ? `${data.sectors.reduce((n, s) => n + s.stocks.length, 0)} members` : "Members"} · size = market cap</span>
        <span className="flex items-center gap-2" aria-hidden="true">
          -3%
          <span
            className="h-2 w-24 rounded-full"
            style={{ backgroundImage: `linear-gradient(to right, ${tileColor(-3)}, ${tileColor(0)}, ${tileColor(3)})` }}
          />
          +3%
        </span>
      </div>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {openGroup && (
              <motion.div
                key="heatmap-group"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                onClick={closeGroup}
                className="fixed inset-0 z-50 flex items-end justify-center bg-canvas/50 p-4 backdrop-blur-xl sm:items-center"
              >
                <div
                  ref={dialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="heatmap-group-title"
                  onClick={(e) => e.stopPropagation()}
                  className="flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-surface-card/90 ring-1 ring-hairline backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
                    <div>
                      <h2 id="heatmap-group-title" className="text-lg font-semibold text-ink">
                        {openGroup.sector}
                      </h2>
                      <p className="mt-0.5 text-xs text-muted">
                        {openGroup.stocks.length} smaller stocks · {signed(openGroup.changePercent)} combined today
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeGroup}
                      aria-label="Close"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted ring-1 ring-hairline hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <ul className="overflow-y-auto px-3 pb-4 custom-scrollbar">
                    {openGroup.stocks.map((st) => (
                      <li key={st.ticker}>
                        <button
                          type="button"
                          onClick={() => {
                            closeGroup();
                            onSelectTicker?.(st.ticker);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-soft">
                            <LogoTile ticker={st.ticker} width="70%" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ink">{st.ticker}</span>
                            <span className="block truncate text-xs text-muted">{st.name}</span>
                          </span>
                          <span
                            className={cn(
                              "text-sm font-medium tabular-nums",
                              st.changePercent >= 0 ? "text-compass" : "text-rose-400",
                            )}
                          >
                            {signed(st.changePercent)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
