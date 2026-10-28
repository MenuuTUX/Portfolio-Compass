"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "pc:pane-width:";

/** A pane width in px, persisted per key. Clamps to [min, max()] on every set. */
export function useResizableWidth(
  key: string,
  initial: number,
  min: number,
  max: () => number,
) {
  const [width, setWidthState] = useState(initial);
  const [dragging, setDragging] = useState(false);

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
      setWidthState(clamped);
      return clamped;
    },
    [min, max],
  );

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

  return { width, setWidth, persist, dragging, setDragging, reset: () => persist(setWidth(initial)) };
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
}: PaneResizerProps) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const [active, setActive] = useState(false);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
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

// Each side pane may take at most 30% of the viewport (and a hard cap), so the
// center chart always keeps room.
export const LEFT_PANE = { initial: 276, min: 200 };
export const RIGHT_PANE = { initial: 360, min: 280 };
export const maxLeftPane = () => Math.min(480, Math.round(window.innerWidth * 0.3));
export const maxRightPane = () => Math.min(640, Math.round(window.innerWidth * 0.3));
