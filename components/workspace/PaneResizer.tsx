"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const STORAGE_PREFIX = "pc:pane-width:";

/**
 * A pane width in px, persisted per key. Clamps to [min, max()] on every set.
 *
 * While a drag is in progress and `paneRef` is attached to the pane element, the
 * width is written straight to that element's style. React state (and so the whole
 * pane) only updates when the drag ends, so pointer moves do not re-render the page.
 * Callers that never attach `paneRef` keep the plain state behaviour.
 */
export function useResizableWidth(
  key: string,
  initial: number,
  min: number,
  max: () => number,
) {
  const [width, setWidthState] = useState(initial);
  const [dragging, setDraggingState] = useState(false);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const liveRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_PREFIX + key));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persisted width after hydration
      if (Number.isFinite(saved) && saved >= min) setWidthState(saved);
    } catch {
      // storage unavailable: keep default
    }
  }, [key, min]);

  const setWidth = useCallback(
    (next: number) => {
      const clamped = Math.round(Math.max(min, Math.min(Math.max(min, max()), next)));
      const pane = paneRef.current;
      if (draggingRef.current && pane) {
        pane.style.width = `${clamped}px`;
        liveRef.current = clamped;
      } else {
        setWidthState(clamped);
      }
      return clamped;
    },
    [min, max],
  );

  const setDragging = useCallback((value: boolean) => {
    draggingRef.current = value;
    setDraggingState(value);
    if (!value && liveRef.current !== null) {
      setWidthState(liveRef.current);
      liveRef.current = null;
    }
  }, []);

  const persist = useCallback(
    (value: number) => {
      try {
        localStorage.setItem(STORAGE_PREFIX + key, String(value));
      } catch {
        // ignore
      }
    },
    [key],
  );

  return {
    width,
    setWidth,
    persist,
    dragging,
    setDragging,
    paneRef,
    reset: () => persist(setWidth(initial)),
  };
}

interface PaneResizerProps {
  label: string;
  /** Current width of the pane being resized. */
  width: number;
  /** +1 if dragging right grows the pane (left pane), -1 if it shrinks it (right pane). */
  direction: 1 | -1;
  onResize: (width: number) => number;
  onCommit: (width: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  onReset: () => void;
  className?: string;
  /** Smallest allowed width, announced to assistive tech. */
  valueMin?: number;
  /** Largest allowed width, announced to assistive tech. */
  valueMax?: number;
}

/** Vertical drag handle that lives in the 8px gutter between two panes. */
export function PaneResizer({
  label,
  width,
  direction,
  onResize,
  onCommit,
  onDraggingChange,
  onReset,
  className,
  valueMin,
  valueMax,
}: PaneResizerProps) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const [active, setActive] = useState(false);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: width };
        setActive(true);
        onDraggingChange(true);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        onResize(start.current.w + direction * (e.clientX - start.current.x));
      }}
      onPointerUp={(e) => {
        if (!start.current) return;
        const next = onResize(start.current.w + direction * (e.clientX - start.current.x));
        start.current = null;
        setActive(false);
        onDraggingChange(false);
        onCommit(next);
      }}
      onPointerCancel={() => {
        start.current = null;
        setActive(false);
        onDraggingChange(false);
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 48 : 16;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const sign = e.key === "ArrowRight" ? 1 : -1;
          onCommit(onResize(width + direction * sign * step));
        }
      }}
      className={cn(
        "group relative h-full w-2 shrink-0 cursor-col-resize touch-none select-none focus-visible:outline-none",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-2 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-colors duration-75",
          active
            ? "bg-compass"
            : "bg-transparent group-hover:bg-hairline-strong group-focus-visible:bg-compass",
        )}
      />
    </div>
  );
}

interface RowResizerProps {
  label: string;
  /** Current height of the pane being resized. */
  height: number;
  /** +1 if dragging down grows the pane (pane above the handle), -1 if dragging up grows it (pane below). */
  direction: 1 | -1;
  onResize: (height: number) => number;
  onCommit: (height: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
  onReset: () => void;
}

/** Horizontal drag handle between two stacked panes. Same behaviour as PaneResizer, on the Y axis. */
export function RowResizer({ label, height, direction, onResize, onCommit, onDraggingChange, onReset }: RowResizerProps) {
  const start = useRef<{ y: number; h: number } | null>(null);
  const [active, setActive] = useState(false);
  const end = (commit: number | null) => {
    start.current = null;
    setActive(false);
    onDraggingChange?.(false);
    if (commit !== null) onCommit(commit);
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuenow={height}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { y: e.clientY, h: height };
        setActive(true);
        onDraggingChange?.(true);
      }}
      onPointerMove={(e) => {
        if (start.current) onResize(start.current.h + direction * (e.clientY - start.current.y));
      }}
      onPointerUp={(e) => {
        if (start.current) end(onResize(start.current.h + direction * (e.clientY - start.current.y)));
      }}
      onPointerCancel={() => end(null)}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 48 : 16;
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const sign = e.key === "ArrowDown" ? 1 : -1;
          onCommit(onResize(height + direction * sign * step));
        }
      }}
      className="group relative h-2 w-full shrink-0 cursor-row-resize touch-none select-none focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full transition-colors duration-75",
          active ? "bg-compass" : "bg-transparent group-hover:bg-hairline-strong group-focus-visible:bg-compass",
        )}
      />
    </div>
  );
}

// Each side pane may take at most 30% of the viewport (and a hard cap), so the
// center chart always keeps room.
export const LEFT_PANE = { initial: 276, min: 200 };
export const RIGHT_PANE = { initial: 360, min: 280 };
export const maxLeftPane = () => Math.min(480, Math.round(window.innerWidth * 0.3));
export const maxRightPane = () => Math.min(640, Math.round(window.innerWidth * 0.3));
