"use client";

import { useEffect, useRef } from "react";

interface AsciiBackgroundProps {
  className?: string;
  /** Glyph color, any CSS color. Defaults to Dune ink. */
  color?: string;
  /** 0-1 overall strength of the effect */
  opacity?: number;
}

// Density ramp: leftmost = empty space, rightmost = densest glyph
const RAMP = " .·:;=+*x%#@";
const CELL = 12; // px per character cell
const FPS = 14;

/**
 * Animated ASCII field: a slowly breathing, mirror-symmetric ink pattern
 * (Rorschach-style) rendered as text glyphs on a canvas. Designed to sit
 * behind hero content — pure decoration, pointer-events: none.
 */
export default function AsciiBackground({
  className = "",
  color = "#32302F",
  opacity = 0.55,
}: AsciiBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let raf = 0;
    let last = 0;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${CELL}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "top";
      cols = Math.ceil(width / CELL);
      rows = Math.ceil(height / CELL);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;

      const cx = cols / 2;
      const cy = rows / 2;
      const scale = Math.max(cols, rows);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Mirror both axes for the symmetric ink-blot look
          const u = Math.abs(col - cx) / scale;
          const v = (row - cy) / scale;

          const r = Math.sqrt(u * u + v * v);
          const theta = Math.atan2(v, u);

          // Layered radial waves, slowly breathing
          let value =
            Math.sin(r * 14 - t * 0.9) * 0.9 +
            Math.sin(theta * 5 + t * 0.35) * 0.55 +
            Math.sin((u * 9 + v * 7) * 2.2 + t * 0.6) * 0.45 -
            r * 3.2;

          // Normalize roughly into 0..1
          value = (value + 2.2) / 4.2;
          if (value <= 0.08) continue;

          const idx = Math.min(
            RAMP.length - 1,
            Math.max(0, Math.floor(value * RAMP.length)),
          );
          const ch = RAMP[idx];
          if (ch === " ") continue;

          // Denser glyphs are also slightly more opaque
          ctx.globalAlpha = opacity * (0.25 + 0.75 * value);
          ctx.fillText(ch, col * CELL, row * CELL);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / FPS) return;
      last = now;
      draw(now / 1000);
    };

    resize();
    if (reducedMotion) {
      draw(0); // Single static frame
    } else {
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => {
      resize();
      if (reducedMotion) draw(0);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [color, opacity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    />
  );
}
